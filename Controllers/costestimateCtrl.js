import { pool } from "../Config/dbConnect.js";
import { getNextNumber } from "./NumberSequenceCtrl.js";

export const parseAmountByCurrency = (amount, currency) => {
  if (!amount) return 0;

  let cleaned = amount.toString().trim();

  switch (currency) {
    case "INR":
    case "USD":
    case "GBP":
    case "AED":
    case "SAR":
    case "JPY":
      cleaned = cleaned.replace(/,/g, "");
      break;

    case "EUR":
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      break;

    default:
      cleaned = cleaned.replace(/[,.]/g, "");
  }

  const value = Number(cleaned);

  if (isNaN(value)) {
    throw new Error("Invalid amount format for currency: " + currency);
  }

  return value;
};



const calculateInvoiceFlags = (ce_po_status, ce_invoice_status) => {
  let to_be_invoiced = 0;
  let invoice = 0;
  let invoiced = 0;

  const poStatus = ce_po_status || "pending";
  const invoiceStatus = ce_invoice_status || "pending";

  if (poStatus === "pending" && invoiceStatus === "pending") {
    to_be_invoiced = 1;
  }

  if (poStatus === "received" && invoiceStatus === "pending") {
    invoice = 1;
  }

  if (poStatus === "received" && invoiceStatus === "received") {
    invoiced = 1;
  }

  return { to_be_invoiced, invoice, invoiced };
};

export const createEstimate = async (req, res) => {
  try {
    const {
      client_id,
      project_id,
      estimate_date,
      valid_until,
      currency,
      ce_status,
      ce_po_status,
      ce_invoice_status,
      vat_rate,
      notes,
      line_items
    } = req.body;

    if (!client_id || !estimate_date || !currency) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    if (!Array.isArray(line_items) || line_items.length === 0) {
      return res.status(400).json({ message: "Line items required" });
    }

    const statusFlags = calculateInvoiceFlags(
      ce_po_status,
      ce_invoice_status
    );

    const estimateNo = await getNextNumber("estimate_no");

    let subtotal = 0;
    const parsedItems = line_items.map(item => {
      const rate = parseAmountByCurrency(item.rate, currency);
      const qty = Number(item.quantity);
      const amount = rate * qty;
      subtotal += amount;

      return { description: item.description, quantity: qty, rate, amount };
    });

    const vatAmount = (subtotal * (vat_rate || 0)) / 100;
    const totalAmount = subtotal + vatAmount;

    const [result] = await pool.query(
      `INSERT INTO estimates (
        estimate_no, client_id, project_id,
        estimate_date, valid_until, currency,
        ce_status, ce_po_status, ce_invoice_status,
        to_be_invoiced, invoice, invoiced,
        line_items, vat_rate, subtotal,
        vat_amount, total_amount, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        estimateNo,
        client_id,
        project_id || null,
        estimate_date,
        valid_until || null,
        currency,
        ce_status,
        ce_po_status || "pending",
        ce_invoice_status || "pending",
        statusFlags.to_be_invoiced,
        statusFlags.invoice,
        statusFlags.invoiced,
        JSON.stringify(parsedItems),
        vat_rate || 0,
        subtotal,
        vatAmount,
        totalAmount,
        notes || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Estimate created successfully",
      id: result.insertId,
      estimate_no: estimateNo,
      status_flags: statusFlags
    });

  } catch (error) {
    console.error("Create Estimate Error:", error);
    res.status(500).json({ message: error.message });
  }
};


// export const getEstimatesByProjectId = async (req, res) => {
//   try {
//     const { projectId } = req.params;

//     const [rows] = await pool.query(`
//       SELECT 
//         e.*,
//         p.project_name,
//         p.project_no,
//         cs.name AS client_name
//       FROM estimates e
//       LEFT JOIN projects p ON p.id = e.project_id
//       LEFT JOIN clients_suppliers cs 
//         ON cs.id = e.client_id AND cs.type = 'client'
//       WHERE e.project_id = ?
//       ORDER BY e.id DESC
//     `, [projectId]);

//     const data = rows.map(row => {
//       const flags = calculateInvoiceFlags(
//         row.ce_po_status,
//         row.ce_invoice_status
//       );

//       // 🔥 SAME STATUS LOGIC
//       const computedStatus =
//         row.ce_invoice_status === "received"
//           ? "Inactive"
//           : "Draft";

//       return {
//         ...row,
//         ce_status: computedStatus,
//         ...flags,
//         line_items: row.line_items ? JSON.parse(row.line_items) : []
//       };
//     });

//     res.json({
//       success: true,
//       count: data.length,
//       data
//     });

//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

export const getEstimatesByProjectId = async (req, res) => {
  try {
    const { projectId } = req.params;

    const [rows] = await pool.query(`
      SELECT 
        e.*,
        p.project_name,
        p.project_no,
        cs.name AS client_name
      FROM estimates e
      LEFT JOIN projects p ON p.id = e.project_id
      LEFT JOIN clients_suppliers cs 
        ON cs.id = e.client_id AND cs.type = 'client'
      WHERE e.project_id = ?
      ORDER BY e.id DESC
    `, [projectId]);

    const data = rows.map(row => {
      const flags = calculateInvoiceFlags(
        row.ce_po_status,
        row.ce_invoice_status
      );

      return {
        ...row,               // ✅ ce_status DB se as-it-is
        ...flags,
        line_items: row.line_items
          ? JSON.parse(row.line_items)
          : []
      };
    });

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



export const getAllEstimates = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.*,
        p.project_name,
        p.project_no,
        cs.name AS client_name
      FROM estimates e
      LEFT JOIN projects p ON p.id = e.project_id
      LEFT JOIN clients_suppliers cs 
        ON cs.id = e.client_id 
        AND cs.type = 'client'
      ORDER BY e.id DESC
    `);

    const data = rows.map(row => {
      const flags = calculateInvoiceFlags(
        row.ce_po_status,
        row.ce_invoice_status // 👈 untouched
      );

      return {
        ...row, // 👈 ce_status DB se jaisa hai waisa hi aayega
        ...flags,
        line_items: row.line_items
          ? JSON.parse(row.line_items)
          : []
      };
    });

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error("Get All Estimates Error:", error);
    res.status(500).json({ message: error.message });
  }
};




export const getPdfDataById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[row]] = await pool.query(`
      SELECT 
        e.estimate_no,
        e.estimate_date,
        e.currency,
        e.line_items,
        e.subtotal,
        e.vat_rate,
        e.vat_amount,
        e.total_amount,
        e.notes,
        e.currency,

        p.project_name,
        p.project_no,

        cs.name AS client_name,
        cs.short_name AS client_short_name,
        cs.address AS client_address,     -- ✅ existing column
        cs.phone AS client_phone,         -- ✅ existing column

        ci.company_logo AS company_logo ,  -- ✅ company logo
        ci.company_name AS company_name   -- ✅ additional company info if needed
      FROM estimates e

      LEFT JOIN projects p 
        ON p.id = e.project_id

      LEFT JOIN clients_suppliers cs 
        ON cs.id = e.client_id 
        AND cs.type = 'client'

      LEFT JOIN company_information ci 
        ON 1 = 1                          -- ✅ single company row

      WHERE e.id = ?
    `, [id]);

    if (!row) {
      return res.status(404).json({ success: false, message: "Estimate not found" });
    }

    const lineItems = JSON.parse(row.line_items);

    res.json({
      success: true,
      data: {
        company_name: row.company_name,
        company_logo: row.company_logo,

        estimate_no: row.estimate_no,
        estimate_date: row.estimate_date,

        client: {
          name: row.client_name,
          short_name: row.client_short_name,
          address: row.client_address,
          phone: row.client_phone
        },

        project: {
          project_name: row.project_name,
          project_no: row.project_no
        },

        items: lineItems,

        summary: {
          currency: row.currency,
          subtotal: row.subtotal,
          vat_rate: row.vat_rate,
          vat_amount: row.vat_amount,
          total_amount: row.total_amount
        },

        notes: row.notes
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



export const getEstimateById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[estimate]] = await pool.query(`
      SELECT 
        e.*,

        /* Project details */
        p.project_name,
        p.project_no,

        /* Client details */
        cs.name AS client_name

      FROM estimates e

      LEFT JOIN projects p 
        ON p.id = e.project_id

      LEFT JOIN clients_suppliers cs 
        ON cs.id = e.client_id 
        AND cs.type = 'client'

      WHERE e.id = ?
    `, [id]);

    if (!estimate) {
      return res.status(404).json({ message: "Estimate not found" });
    }

    estimate.line_items = JSON.parse(estimate.line_items);

    res.json({
      success: true,
      data: estimate
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateEstimate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      estimate_date,
      valid_until,
      currency,
      ce_status,
      ce_po_status,
      ce_invoice_status,
      vat_rate,
      notes,
      line_items
    } = req.body;

    let subtotal = 0;
    const parsedItems = line_items.map(item => {
      const rate = parseAmountByCurrency(item.rate, currency);
      const qty = Number(item.quantity);
      const amount = rate * qty;
      subtotal += amount;

      return { description: item.description, quantity: qty, rate, amount };
    });

    const vatAmount = (subtotal * (vat_rate || 0)) / 100;
    const totalAmount = subtotal + vatAmount;

    const statusFlags = calculateInvoiceFlags(
      ce_po_status,
      ce_invoice_status
    );

    await pool.query(
      `UPDATE estimates SET
        estimate_date = ?, valid_until = ?, currency = ?, ce_status = ?,
        ce_po_status = ?, ce_invoice_status = ?,
        to_be_invoiced = ?, invoice = ?, invoiced = ?,
        line_items = ?, vat_rate = ?, subtotal = ?,
        vat_amount = ?, total_amount = ?, notes = ?
      WHERE id = ?`,
      [
        estimate_date,
        valid_until,
        currency,
        ce_status,
        ce_po_status,
        ce_invoice_status,
        statusFlags.to_be_invoiced,
        statusFlags.invoice,
        statusFlags.invoiced,
        JSON.stringify(parsedItems),
        vat_rate,
        subtotal,
        vatAmount,
        totalAmount,
        notes,
        id
      ]
    );

    console.log(`🔍 Cost Estimate ${id} updated. Total Amount: ${totalAmount}`);

    // 🔄 SYNC AMOUNT TO PURCHASE ORDERS (all POs linked to this estimate)
    let poSynced = false;
    try {
      const [linkedPOs] = await pool.query(
        `SELECT id, po_amount FROM purchase_orders WHERE cost_estimation_id = ?`,
        [id]
      );

      if (linkedPOs && linkedPOs.length > 0) {
        console.log(`📋 Found ${linkedPOs.length} PO(s) linked to Cost Estimate ${id}`);

        for (const po of linkedPOs) {
          try {
            await pool.query(
              `UPDATE purchase_orders SET po_amount = ? WHERE id = ?`,
              [totalAmount, po.id]
            );
            console.log(`✅ PO ${po.id} updated with amount: ${totalAmount}`);
            poSynced = true;
          } catch (poError) {
            console.error(`❌ Error updating PO ${po.id}:`, poError);
          }
        }
      } else {
        console.log(`⚠️ No PO found for Cost Estimate ${id}`);
      }
    } catch (poSyncError) {
      console.error("❌ Error syncing POs:", poSyncError);
    }

    // 🔄 SYNC AMOUNT TO INVOICES (all invoices linked to this estimate)
    let invoiceSynced = false;
    try {
      const [linkedInvoices] = await pool.query(
        `SELECT id, total_amount FROM invoices WHERE estimate_id = ?`,
        [id]
      );

      if (linkedInvoices && linkedInvoices.length > 0) {
        console.log(`📋 Found ${linkedInvoices.length} Invoice(s) linked to Cost Estimate ${id}`);

        for (const inv of linkedInvoices) {
          try {
            // Recalculate invoice amounts based on new estimate data
            await pool.query(
              `UPDATE invoices SET
                subtotal = ?,
                vat_amount = ?,
                total_amount = ?,
                line_items = ?,
                vat_rate = ?
              WHERE id = ?`,
              [
                subtotal,
                vatAmount,
                totalAmount,
                JSON.stringify(parsedItems),
                vat_rate || 0,
                inv.id
              ]
            );
            console.log(`✅ Invoice ${inv.id} updated with amount: ${totalAmount}`);
            invoiceSynced = true;
          } catch (invError) {
            console.error(`❌ Error updating Invoice ${inv.id}:`, invError);
          }
        }
      } else {
        console.log(`⚠️ No Invoice found for Cost Estimate ${id}`);
      }
    } catch (invSyncError) {
      console.error("❌ Error syncing Invoices:", invSyncError);
    }

    // Build response message
    let syncMessage = "Estimate updated successfully.";
    if (poSynced) {
      syncMessage += " PO(s) amount synced.";
    }
    if (invoiceSynced) {
      syncMessage += " Invoice(s) amount synced.";
    }

    res.json({
      success: true,
      message: syncMessage,
      status_flags: statusFlags
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteEstimate = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    // 1️⃣ Delete related purchase orders
    await connection.query(
      "DELETE FROM purchase_orders WHERE cost_estimation_id = ?",
      [id]
    );

    // 2️⃣ Delete estimate
    await connection.query(
      "DELETE FROM estimates WHERE id = ?",
      [id]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Estimate deleted successfully"
    });

  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
};

export const duplicateEstimate = async (req, res) => {
  try {
    const { id } = req.params;

    const [[estimate]] = await pool.query(`SELECT * FROM estimates WHERE id = ?`, [id]);
    if (!estimate) {
      return res.status(404).json({ success: false, message: "Estimate not found" });
    }

    const nextEstimateNo = await getNextNumber("estimate_no");

    // When duplicating, we keep the same financials and line items, but reset workflow flags.
    const ce_po_status = "pending";
    const ce_invoice_status = "pending";
    const statusFlags = calculateInvoiceFlags(ce_po_status, ce_invoice_status);

    const [result] = await pool.query(
      `INSERT INTO estimates (
        estimate_no, client_id, project_id,
        estimate_date, valid_until, currency,
        ce_status, ce_po_status, ce_invoice_status,
        to_be_invoiced, invoice, invoiced,
        line_items, vat_rate, subtotal,
        vat_amount, total_amount, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        nextEstimateNo,
        estimate.client_id,
        estimate.project_id || null,
        estimate.estimate_date,
        estimate.valid_until || null,
        estimate.currency,
        estimate.ce_status || "Draft",
        ce_po_status,
        ce_invoice_status,
        statusFlags.to_be_invoiced,
        statusFlags.invoice,
        statusFlags.invoiced,
        estimate.line_items, // already JSON string in DB
        estimate.vat_rate || 0,
        estimate.subtotal || 0,
        estimate.vat_amount || 0,
        estimate.total_amount || 0,
        estimate.notes || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Estimate duplicated successfully",
      id: result.insertId,
      estimate_no: nextEstimateNo
    });
  } catch (error) {
    console.error("Duplicate Estimate Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
