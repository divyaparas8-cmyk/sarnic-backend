import { pool } from "../Config/dbConnect.js";
import { getNextNumber } from "./NumberSequenceCtrl.js";

/* ======================================
   PARSE AMOUNT BY CURRENCY
====================================== */
export const parseAmountByCurrency = (amount, currency) => {
  if (amount === null || amount === undefined) return 0;

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

/* ======================================
   INVOICE PAYMENT FLAGS
====================================== */
const calculateInvoicePaymentFlags = (invoice_status, payment_status) => {
  let to_be_paid = false;
  let paid = false;

  const iStatus = invoice_status;
  const pStatus = payment_status || "Unpaid";

  if (iStatus === "Active" && pStatus === "Unpaid") {
    to_be_paid = true;
  }

  if (pStatus === "Paid") {
    paid = true;
  }

  return { to_be_paid, paid };
};

/* ======================================
   CREATE INVOICE (FINAL)
====================================== */
// export const createInvoice = async (req, res) => {
//   try {
//     const {
//       client_id,
//       project_id,
//       estimate_id,          // 🔥 MUST come from frontend
//       purchase_order_id,
//       invoice_date,
//       due_date,
//       currency,
//       document_type,
//       invoice_status,
//       payment_status,
//       vat_rate,
//       notes,
//       line_items
//     } = req.body;

//     /* ================= VALIDATION ================= */
//     if (!client_id || !invoice_date || !currency) {
//       return res.status(400).json({ message: "Required fields missing" });
//     }

//     if (!Array.isArray(line_items) || line_items.length === 0) {
//       return res.status(400).json({ message: "Line items required" });
//     }

//     /* ================= INVOICE NUMBER ================= */
//     const [[row]] = await pool.query(
//       "SELECT MAX(invoice_no) AS maxNo FROM invoices"
//     );
//     const invoiceNo = (row.maxNo || 5000) + 1;

//     /* ================= CALCULATE TOTALS ================= */
//     let subtotal = 0;

//     const parsedItems = line_items.map(item => {
//       const rate = parseAmountByCurrency(item.rate, currency);
//       const qty = Number(item.quantity);

//       if (isNaN(qty) || qty <= 0) {
//         throw new Error("Invalid quantity");
//       }

//       const amount = rate * qty;
//       subtotal += amount;

//       return {
//         description: item.description,
//         quantity: qty,
//         rate,
//         amount
//       };
//     });

//     const vatAmount = (subtotal * (vat_rate || 0)) / 100;
//     const totalAmount = subtotal + vatAmount;

//     /* ================= PAYMENT FLAGS ================= */
//     const paymentFlags = calculateInvoicePaymentFlags(
//       invoice_status,
//       payment_status
//     );

//     /* ================= CREATE INVOICE ================= */
//     const [result] = await pool.query(
//       `INSERT INTO invoices (
//         invoice_no,
//         client_id,
//         project_id,
//         estimate_id,
//         purchase_order_id,
//         invoice_date,
//         due_date,
//         currency,
//         document_type,
//         invoice_status,
//         payment_status,
//         to_be_paid,
//         paid,
//         line_items,
//         vat_rate,
//         subtotal,
//         vat_amount,
//         total_amount,
//         notes
//       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//       [
//         invoiceNo,
//         client_id,
//         project_id || null,
//         estimate_id || null,
//         purchase_order_id || null,
//         invoice_date,
//         due_date || null,
//         currency,
//         document_type || "Tax Invoice",
//         invoice_status,
//         payment_status || "Unpaid",
//         paymentFlags.to_be_paid,
//         paymentFlags.paid,
//         JSON.stringify(parsedItems),
//         vat_rate || 0,
//         subtotal,
//         vatAmount,
//         totalAmount,
//         notes || null
//       ]
//     );

//     /* ================= UPDATE COST ESTIMATE STATUS ================= */
//     if (estimate_id) {
//       // Fetch current PO status of estimate
//       const [[estimate]] = await pool.query(
//         `SELECT ce_po_status FROM estimates WHERE id = ?`,
//         [estimate_id]
//       );

//       if (!estimate) {
//         return res.status(404).json({
//           message: "Linked cost estimate not found"
//         });
//       }

//       const ce_po_status = estimate.ce_po_status || "pending";

//       // Invoice created => invoice received
//       let to_be_invoiced = false;
//       let invoice = false;
//       let invoiced = true;

//       await pool.query(
//         `UPDATE estimates SET
//           ce_status = 'Completed',
//           ce_invoice_status = 'received',
//           to_be_invoiced = ?,
//           invoice = ?,
//           invoiced = ?
//          WHERE id = ?`,
//         [
//           to_be_invoiced,
//           invoice,
//           invoiced,
//           estimate_id
//         ]
//       );
//     }

//     /* ================= RESPONSE ================= */
//     res.status(201).json({
//       success: true,
//       message: "Invoice created & cost estimate updated successfully",
//       id: result.insertId,
//       invoice_no: invoiceNo,
//       payment_flags: paymentFlags
//     });

//   } catch (error) {
//     console.error("Create Invoice Error:", error);
//     res.status(500).json({ message: error.message });
//   }
// };
export const createInvoice = async (req, res) => {
  try {
    const {
      client_id,
      project_id,
      estimate_id,          // 🔥 MUST come from frontend
      purchase_order_id,
      invoice_date,
      due_date,
      currency,
      document_type,
      invoice_status,
      payment_status,
      vat_rate,
      notes,
      line_items
    } = req.body;

    /* ================= VALIDATION ================= */
    if (!client_id || !invoice_date || !currency) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    if (!Array.isArray(line_items) || line_items.length === 0) {
      return res.status(400).json({ message: "Line items required" });
    }

    /* ================= CHECK DUPLICATE PO/ESTIMATE INVOICE ================= */
    if (purchase_order_id) {
      const [[existingInvoice]] = await pool.query(
        `SELECT id FROM invoices WHERE purchase_order_id = ? LIMIT 1`,
        [purchase_order_id]
      );

      if (existingInvoice) {
        return res.status(400).json({
          message: "Invoice already exists for this Cost Estimate"
        });
      }
    }

    if (estimate_id) {
      const [[existingEstInvoice]] = await pool.query(
        `SELECT id FROM invoices WHERE estimate_id = ? LIMIT 1`,
        [estimate_id]
      );

      if (existingEstInvoice) {
        return res.status(400).json({
          message: "Invoice already exists for this Cost Estimate"
        });
      }
    }

    /* ================= INVOICE NUMBER ================= */
    const invoiceNo = await getNextNumber("invoice_no");

    /* ================= CALCULATE TOTALS ================= */
    let subtotal = 0;

    const parsedItems = line_items.map(item => {
      const rate = parseAmountByCurrency(item.rate, currency);
      const qty = Number(item.quantity);

      if (isNaN(qty) || qty <= 0) {
        throw new Error("Invalid quantity");
      }

      const amount = rate * qty;
      subtotal += amount;

      return {
        description: item.description,
        quantity: qty,
        rate,
        amount
      };
    });

    const vatAmount = (subtotal * (vat_rate || 0)) / 100;
    const totalAmount = subtotal + vatAmount;

    /* ================= PAYMENT FLAGS ================= */
    const paymentFlags = calculateInvoicePaymentFlags(
      invoice_status,
      payment_status
    );

    /* ================= CREATE INVOICE ================= */
    const [result] = await pool.query(
      `INSERT INTO invoices (
        invoice_no,
        client_id,
        project_id,
        estimate_id,
        purchase_order_id,
        invoice_date,
        due_date,
        currency,
        document_type,
        invoice_status,
        payment_status,
        to_be_paid,
        paid,
        line_items,
        vat_rate,
        subtotal,
        vat_amount,
        total_amount,
        notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        invoiceNo,
        client_id,
        project_id || null,
        estimate_id || null,
        purchase_order_id || null,
        invoice_date,
        due_date || null,
        currency,
        document_type || "Tax Invoice",
        invoice_status,
        payment_status || "Unpaid",
        paymentFlags.to_be_paid,
        paymentFlags.paid,
        JSON.stringify(parsedItems),
        vat_rate || 0,
        subtotal,
        vatAmount,
        totalAmount,
        notes || null
      ]
    );

    /* ================= UPDATE COST ESTIMATE STATUS ================= */
    if (estimate_id) {
      const [[estimate]] = await pool.query(
        `SELECT ce_po_status FROM estimates WHERE id = ?`,
        [estimate_id]
      );

      if (!estimate) {
        return res.status(404).json({
          message: "Linked cost estimate not found"
        });
      }

      const ce_po_status = estimate.ce_po_status || "pending";

      let to_be_invoiced = false;
      let invoice = false;
      let invoiced = true;

      await pool.query(
        `UPDATE estimates SET
          ce_status = 'Completed',
          ce_invoice_status = 'received',
          to_be_invoiced = ?,
          invoice = ?,
          invoiced = ?
         WHERE id = ?`,
        [
          to_be_invoiced,
          invoice,
          invoiced,
          estimate_id
        ]
      );
    }

    /* ================= RESPONSE ================= */
    res.status(201).json({
      success: true,
      message: "Invoice created & cost estimate updated successfully",
      id: result.insertId,
      invoice_no: invoiceNo,
      payment_flags: paymentFlags
    });

  } catch (error) {
    console.error("Create Invoice Error:", error);
    res.status(500).json({ message: error.message });
  }
};


/* ======================================
   GET ALL INVOICES
====================================== */
export const getAllInvoices = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        i.*,
        p.project_name,
        p.project_no,
        cs.name AS client_name,
        COALESCE(po.po_number, po_est.po_number) AS po_number,
        es.estimate_no AS ce_no
      FROM invoices i
      LEFT JOIN projects p ON p.id = i.project_id
      LEFT JOIN clients_suppliers cs 
        ON cs.id = i.client_id AND cs.type = 'client'
      LEFT JOIN purchase_orders po
        ON po.id = i.purchase_order_id
      LEFT JOIN estimates es
        ON es.id = i.estimate_id
      LEFT JOIN purchase_orders po_est
        ON po_est.cost_estimation_id = i.estimate_id
      ORDER BY i.id DESC
    `);

    const data = rows.map(r => ({
      ...r,
      line_items: r.line_items ? JSON.parse(r.line_items) : []
    }));

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================
   CREATE INVOICE FROM ESTIMATE
====================================== */
export const createInvoiceFromEstimate = async (req, res) => {
  try {
    const { estimateId } = req.params;

    const [[estimate]] = await pool.query(
      "SELECT * FROM estimates WHERE id = ?",
      [estimateId]
    );

    if (!estimate) {
      return res.status(404).json({ message: "Estimate not found" });
    }

    const invoicePayload = {
      client_id: estimate.client_id,
      project_id: estimate.project_id,
      estimate_id: estimate.id,
      invoice_date: new Date(),
      currency: estimate.currency,
      vat_rate: estimate.vat_rate,
      line_items: JSON.parse(estimate.line_items),
      invoice_status: "Active",
      payment_status: "Unpaid",
      notes: estimate.notes
    };

    req.body = invoicePayload;
    return createInvoice(req, res);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ======================================
   DELETE INVOICE
====================================== */
// export const deleteInvoice = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const [result] = await pool.query(
//       "DELETE FROM invoices WHERE id = ?",
//       [id]
//     );

//     if (result.affectedRows === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Invoice not found"
//       });
//     }

//     res.json({
//       success: true,
//       message: "Invoice deleted successfully"
//     });

//   } catch (error) {
//     console.error("Delete Invoice Error:", error);
//     res.status(500).json({ message: error.message });
//   }
// };

export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔹 Get estimate_id before delete
    const [[invoice]] = await pool.query(
      `SELECT estimate_id FROM invoices WHERE id = ?`,
      [id]
    );

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found"
      });
    }

    const [result] = await pool.query(
      "DELETE FROM invoices WHERE id = ?",
      [id]
    );

    /* ================= ADD ONLY THIS ================= */
    if (invoice.estimate_id) {
      const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM invoices WHERE estimate_id = ?`,
        [invoice.estimate_id]
      );

      const hasInvoice = countRow.cnt > 0;

      await pool.query(
        `UPDATE estimates SET
          ce_status = ?
         WHERE id = ?`,
        [
          hasInvoice ? 'Completed' : 'Active',
          invoice.estimate_id
        ]
      );
    }
    /* ================= END ADD ================= */

    res.json({
      success: true,
      message: "Invoice deleted successfully"
    });

  } catch (error) {
    console.error("Delete Invoice Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ======================================
   GET INVOICE BY ID
====================================== */
export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[invoice]] = await pool.query(`
      SELECT 
        i.*,
        p.project_name,
        p.project_no,
        cs.name AS client_name
      FROM invoices i
      LEFT JOIN projects p ON p.id = i.project_id
      LEFT JOIN clients_suppliers cs 
        ON cs.id = i.client_id AND cs.type = 'client'
      WHERE i.id = ?
    `, [id]);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    invoice.line_items = invoice.line_items
      ? JSON.parse(invoice.line_items)
      : [];

    res.json({
      success: true,
      data: invoice
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// export const getInvoicepdfById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const [[row]] = await pool.query(`
//       SELECT 
//         i.invoice_no,
//         i.invoice_date,
//         i.currency,
//         i.estimate_id,
//         i.purchase_order_id,
//         i.line_items,
//         i.subtotal,
//         i.vat_rate,
//         i.vat_amount,
//         i.total_amount,

//         p.project_no,

//         cs.name AS client_name,
//         cs.address AS client_address,
//         cs.phone AS client_phone,
//         cs.tax_id AS tax_id,

//         -- ✅ COMPANY INFO
//         ci.company_name,
//         ci.company_stamp,
//         ci.address AS company_address,
//         ci.phone AS company_phone,
//         ci.email AS company_email,
//         ci.trn AS company_trn,
//         ci.company_logo,

//         -- ✅ BANK INFO
//         ci.bank_account_name,
//         ci.bank_name,
//         ci.iban,
//         ci.swift_code,              -- ✅ comma added here

//         -- ✅ ESTIMATE INFO
//         es.estimate_no AS ce_no     -- ✅ now valid

//       FROM invoices i

//       LEFT JOIN projects p 
//         ON p.id = i.project_id

//       LEFT JOIN clients_suppliers cs 
//         ON cs.id = i.client_id 
//         AND cs.type = 'client'

//       LEFT JOIN company_information ci 
//         ON 1 = 1

//       LEFT JOIN estimates es
//         ON es.id = i.estimate_id

//       WHERE i.id = ?
//     `, [id]);

//     if (!row) {
//       return res.status(404).json({ success: false, message: "Invoice not found" });
//     }

//     const items = row.line_items ? JSON.parse(row.line_items) : [];

//     res.json({
//       success: true,
//       data: {
//         invoice_no: row.invoice_no,
//         invoice_date: row.invoice_date,
//         ce_no: row.ce_no,
//         po_no: row.purchase_order_id,
//         project_no: row.project_no,
//         currency: row.currency,

//         company: {
//           name: row.company_name,
//           stamp: row.company_stamp,
//           address: row.company_address,
//           phone: row.company_phone,
//           email: row.company_email,
//           trn: row.company_trn,
//           logo: row.company_logo
//         },

//         client: {
//           name: row.client_name,
//           address: row.client_address,
//           phone: row.client_phone,
//           tax_id: row.tax_id
//         },

//         bank: {
//           account_name: row.bank_account_name,
//           bank_name: row.bank_name,
//           iban: row.iban,
//           swift_code: row.swift_code
//         },

//         items,

//         summary: {
//           subtotal: row.subtotal,
//           vat_rate: row.vat_rate,
//           vat_amount: row.vat_amount,
//           total: row.total_amount,
//           currency: row.currency
//         }
//       }
//     });

//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
export const getInvoicepdfById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[row]] = await pool.query(`
      SELECT 
        i.invoice_no,
        i.invoice_date,
        i.currency,
        i.estimate_id,
        i.purchase_order_id,
        i.line_items,
        i.subtotal,
        i.vat_rate,
        i.vat_amount,
        i.total_amount,

        p.project_no,
        p.project_name,

        cs.name AS client_name,
        cs.short_name AS client_short_name,
        cs.address AS client_address,
        cs.phone AS client_phone,
        cs.tax_id AS tax_id,

        -- COMPANY INFO
        ci.company_name,
        ci.company_stamp,
        ci.address AS company_address,
        ci.phone AS company_phone,
        ci.email AS company_email,
        ci.trn AS company_trn,
        ci.company_logo,

        -- BANK INFO
        ci.bank_account_name,
        ci.bank_name,
        ci.iban,
        ci.swift_code,

        -- ESTIMATE INFO
        es.estimate_no AS ce_no,
        
        -- ✅ PO INFO (FIX: FALLBACK TO ESTIMATE PO)
        REPLACE(COALESCE(po.po_number, po_est.po_number), 'PO-', '') AS po_no

      FROM invoices i

      LEFT JOIN projects p 
        ON p.id = i.project_id

      LEFT JOIN clients_suppliers cs 
        ON cs.id = i.client_id 
        AND cs.type = 'client'

      LEFT JOIN company_information ci 
        ON 1 = 1

      LEFT JOIN estimates es
        ON es.id = i.estimate_id

      -- ✅ DIRECT PO JOIN
      LEFT JOIN purchase_orders po
        ON po.id = i.purchase_order_id

      -- ✅ FALLBACK PO JOIN (VIA ESTIMATE)
      LEFT JOIN purchase_orders po_est
        ON po_est.cost_estimation_id = i.estimate_id

      WHERE i.id = ?
    `, [id]);

    if (!row) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const items = row.line_items ? JSON.parse(row.line_items) : [];

    res.json({
      success: true,
      data: {
        invoice_no: row.invoice_no,
        invoice_date: row.invoice_date,
        ce_no: row.ce_no,

        // ✅ NOW CORRECT PO NUMBER
        po_no: row.po_no,
        project_name: row.project_name,

        project_no: row.project_no,
        currency: row.currency,

        company: {
          name: row.company_name,
          stamp: row.company_stamp,
          address: row.company_address,
          phone: row.company_phone,
          email: row.company_email,
          trn: row.company_trn,
          logo: row.company_logo
        },

        client: {
          name: row.client_name,
          short_name: row.client_short_name,
          address: row.client_address,
          phone: row.client_phone,
          tax_id: row.tax_id
        },

        bank: {
          account_name: row.bank_account_name,
          bank_name: row.bank_name,
          iban: row.iban,
          swift_code: row.swift_code
        },

        items,

        summary: {
          subtotal: row.subtotal,
          vat_rate: row.vat_rate,
          vat_amount: row.vat_amount,
          total: row.total_amount,
          currency: row.currency
        }
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


/* ======================================
   GET INVOICES BY PROJECT
====================================== */
export const getInvoicesByProjectId = async (req, res) => {
  try {
    const { projectId } = req.params;

    const [rows] = await pool.query(`
      SELECT 
        i.*,
        p.project_name,
        p.project_no,
        cs.name AS client_name,
        COALESCE(po.po_number, po_est.po_number) AS po_number,
        es.estimate_no AS ce_no
      FROM invoices i
      LEFT JOIN projects p 
        ON p.id = i.project_id
      LEFT JOIN clients_suppliers cs 
        ON cs.id = i.client_id 
        AND cs.type = 'client'
      LEFT JOIN purchase_orders po
        ON po.id = i.purchase_order_id
      LEFT JOIN estimates es
        ON es.id = i.estimate_id
      LEFT JOIN purchase_orders po_est
        ON po_est.cost_estimation_id = i.estimate_id
      WHERE i.project_id = ?
      ORDER BY i.id DESC
    `, [projectId]);

    const data = rows.map(row => ({
      ...row,
      line_items: row.line_items ? JSON.parse(row.line_items) : []
    }));

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ======================================
   UPDATE INVOICE
====================================== */
export const updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      invoice_date,
      due_date,
      currency,
      document_type,
      invoice_status,
      payment_status,
      vat_rate,
      notes,
      line_items
    } = req.body;

    if (!id || !currency) {
      return res.status(400).json({ message: "Invoice id & currency required" });
    }

    if (!Array.isArray(line_items) || line_items.length === 0) {
      return res.status(400).json({ message: "Line items required" });
    }

    let subtotal = 0;

    const parsedItems = line_items.map(item => {
      const rate = parseAmountByCurrency(item.rate, currency);
      const qty = Number(item.quantity);

      if (isNaN(qty) || qty <= 0) {
        throw new Error("Invalid quantity");
      }

      const amount = rate * qty;
      subtotal += amount;

      return {
        description: item.description,
        quantity: qty,
        rate,
        amount
      };
    });

    const vatAmount = (subtotal * (vat_rate || 0)) / 100;
    const totalAmount = subtotal + vatAmount;

    const flags = calculateInvoicePaymentFlags(
      invoice_status,
      payment_status
    );

    // First, get the invoice to check linked PO and Estimate
    const [[invoice]] = await pool.query(
      `SELECT estimate_id, purchase_order_id FROM invoices WHERE id = ?`,
      [id]
    );

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    console.log(`📋 Invoice ${id} - PO ID: ${invoice.purchase_order_id}, Estimate ID: ${invoice.estimate_id}`);
    console.log(`💰 New Invoice Amount: ${totalAmount}`);

    // Update Invoice
    await pool.query(
      `UPDATE invoices SET
        invoice_date = ?,
        due_date = ?,
        currency = ?,
        document_type = ?,
        invoice_status = ?,
        payment_status = ?,
        to_be_paid = ?,
        paid = ?,
        line_items = ?,
        vat_rate = ?,
        subtotal = ?,
        vat_amount = ?,
        total_amount = ?,
        notes = ?
      WHERE id = ?`,
      [
        invoice_date,
        due_date,
        currency,
        document_type,
        invoice_status,
        payment_status || "Unpaid",
        flags.to_be_paid,
        flags.paid,
        JSON.stringify(parsedItems),
        vat_rate || 0,
        subtotal,
        vatAmount,
        totalAmount,
        notes || null,
        id
      ]
    );

    // 🔄 SYNC AMOUNT TO PURCHASE ORDER (if linked)
    let poIdsToUpdate = [];
    let poSynced = false;

    console.log(`🔍 Invoice ${id} - PO ID: ${invoice.purchase_order_id}, Estimate ID: ${invoice.estimate_id}`);
    console.log(`💰 Invoice Total Amount: ${totalAmount}`);

    // Case 1: Direct PO link in invoice
    if (invoice.purchase_order_id) {
      poIdsToUpdate.push(invoice.purchase_order_id);
      console.log(`✅ Found direct PO link: ${invoice.purchase_order_id}`);
    }

    // Case 2: Find PO via Cost Estimate (always check this, even if direct link exists)
    if (invoice.estimate_id) {
      const [linkedPOs] = await pool.query(
        `SELECT id, po_amount FROM purchase_orders WHERE cost_estimation_id = ?`,
        [invoice.estimate_id]
      );
      if (linkedPOs && linkedPOs.length > 0) {
        linkedPOs.forEach(po => {
          if (!poIdsToUpdate.includes(po.id)) {
            poIdsToUpdate.push(po.id);
            console.log(`🔗 Found PO ${po.id} linked via Cost Estimate ${invoice.estimate_id}`);
            console.log(`📊 Current PO Amount: ${po.po_amount}, New Amount: ${totalAmount}`);
          }
        });
      } else {
        console.log(`⚠️ No PO found for Cost Estimate ${invoice.estimate_id}`);
      }
    }

    // Update ALL found POs
    if (poIdsToUpdate.length > 0) {
      for (const poId of poIdsToUpdate) {
        try {
          // Verify PO exists before updating
          const [[poCheck]] = await pool.query(
            `SELECT id, po_amount FROM purchase_orders WHERE id = ?`,
            [poId]
          );

          if (!poCheck) {
            console.error(`❌ PO ${poId} not found in database!`);
            continue;
          }

          console.log(`📋 PO ${poId} exists. Current amount: ${poCheck.po_amount}, Updating to: ${totalAmount}`);

          // Update PO
          await pool.query(
            `UPDATE purchase_orders SET po_amount = ? WHERE id = ?`,
            [totalAmount, poId]
          );

          // Verify update
          const [[poVerify]] = await pool.query(
            `SELECT po_amount FROM purchase_orders WHERE id = ?`,
            [poId]
          );

          // Compare amounts (handle float precision)
          const expectedAmount = parseFloat(totalAmount);
          const actualAmount = parseFloat(poVerify?.po_amount || 0);

          if (poVerify && Math.abs(expectedAmount - actualAmount) < 0.01) {
            console.log(`✅ PO ${poId} successfully updated! New amount: ${poVerify.po_amount}`);
            poSynced = true;
          } else {
            console.error(`❌ PO ${poId} update failed! Expected: ${totalAmount} (${expectedAmount}), Got: ${poVerify?.po_amount} (${actualAmount})`);
          }
        } catch (poError) {
          console.error(`❌ Error updating PO ${poId}:`, poError);
          // Continue with other POs
        }
      }
    } else {
      console.log(`⚠️ No PO found to sync for invoice ${id}`);
    }

    // 🔄 SYNC AMOUNT TO COST ESTIMATE (if linked)
    if (invoice.estimate_id) {
      try {
        await pool.query(
          `UPDATE estimates SET
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
            invoice.estimate_id
          ]
        );
        console.log(`✅ Cost Estimate ${invoice.estimate_id} updated with amount: ${totalAmount}`);
      } catch (ceError) {
        console.error("❌ Error updating Cost Estimate:", ceError);
        // Don't fail the whole request, just log the error
      }
    }

    // Build sync status message
    let syncMessage = "Invoice updated successfully.";
    if (poSynced && poIdsToUpdate.length > 0) {
      syncMessage += ` ${poIdsToUpdate.length} PO(s) amount synced.`;
    }
    if (invoice.estimate_id) {
      syncMessage += " Cost Estimate amount synced.";
    }

    res.json({
      success: true,
      message: syncMessage
    });

  } catch (error) {
    console.error("Update Invoice Error:", error);
    res.status(500).json({ message: error.message });
  }
};
