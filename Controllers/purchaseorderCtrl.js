import { pool } from "../Config/dbConnect.js";
import fs from "fs";
import cloudinary from "../cloudinary/cloudinary.js";
import imagekit from "../imagekit.js";


const calculateReceivablePOFlags = (ce_po_status, ce_invoice_status) => {
  let to_be_invoiced = 0;
  let invoiced = 0;

  // PO received but invoice NOT created
  if (ce_po_status === "received" && ce_invoice_status === "pending") {
    to_be_invoiced = 1;
  }

  // Invoice created
  if (ce_po_status === "received" && ce_invoice_status === "received") {
    invoiced = 1;
  }

  return { to_be_invoiced, invoiced };
};

export const createPurchaseOrder = async (req, res) => {
  try {
    const {
      po_number,
      project_id,
      client_id,
      po_amount,
      po_date,
      cost_estimation_id
    } = req.body;
    console.log("po console", req.body);

    if (
      !po_number ||
      !project_id ||
      !client_id ||
      !po_amount ||
      !po_date ||
      !cost_estimation_id
    ) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    /* ---------- Upload PO Document (Using ImageKit for better PDF reliability) ---------- */
    let po_document = null;
    if (req.files?.po_document) {
      const file = req.files.po_document;
      const result = await imagekit.upload({
        file: fs.readFileSync(file.tempFilePath),
        fileName: file.name,
        folder: "/purchase_orders",
      });
      po_document = result.url;
      fs.unlinkSync(file.tempFilePath);
    }

    /* ---------- Create PO ---------- */
    const [result] = await pool.query(
      `INSERT INTO purchase_orders
       (po_number, project_id, client_id, po_amount, po_date, po_document, cost_estimation_id)
       VALUES (?,?,?,?,?,?,?)`,
      [
        po_number,
        project_id,
        client_id,
        po_amount,
        po_date,
        po_document,
        cost_estimation_id
      ]
    );

    await pool.query(
      `UPDATE estimates SET ce_po_status = 'received' WHERE id = ?`,
      [cost_estimation_id]
    );

    res.status(201).json({
      success: true,
      message: "Purchase Order created successfully",
      id: result.insertId
    });

  } catch (error) {
    console.error("Create PO Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getAllPurchaseOrders = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        po.*,
        p.project_name,
        p.project_no,
        cs.name AS client_name,
        e.id AS estimate_id,
        e.currency AS currency,
        e.estimate_no,
        e.ce_po_status,
        e.ce_invoice_status
      FROM purchase_orders po
      LEFT JOIN projects p ON p.id = po.project_id
      LEFT JOIN clients_suppliers cs 
        ON cs.id = po.client_id AND cs.type = 'client'
      LEFT JOIN estimates e
        ON e.id = po.cost_estimation_id
      ORDER BY po.id DESC
    `);

    const data = rows.map(row => ({
      ...row,
      ...calculateReceivablePOFlags(
        row.ce_po_status,
        row.ce_invoice_status
      )
    }));

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error("Get All Purchase Orders Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getPurchaseOrdersByProjectId = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    const [rows] = await pool.query(`
      SELECT 
        po.*,
        p.project_name,
        p.project_no,
        cs.name AS client_name,
        e.id AS estimate_id,
        e.estimate_no,
        e.ce_po_status,
        e.ce_invoice_status
      FROM purchase_orders po
      LEFT JOIN projects p ON p.id = po.project_id
      LEFT JOIN clients_suppliers cs 
        ON cs.id = po.client_id AND cs.type = 'client'
      LEFT JOIN estimates e
        ON e.id = po.cost_estimation_id
      WHERE po.project_id = ?
      ORDER BY po.id DESC
    `, [projectId]);

    const data = rows.map(row => ({
      ...row,
      ...calculateReceivablePOFlags(
        row.ce_po_status,
        row.ce_invoice_status
      )
    }));

    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error("Get PO By Project Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[po]] = await pool.query(`
      SELECT 
        po.*,
        p.project_name,
        p.project_no,
        cs.name AS client_name,
        e.id AS estimate_id,
        e.estimate_no,
        e.currency,
        e.vat_rate,
        e.notes,
        e.line_items
      FROM purchase_orders po
      LEFT JOIN projects p ON p.id = po.project_id
      LEFT JOIN clients_suppliers cs 
        ON cs.id = po.client_id AND cs.type = 'client'
      LEFT JOIN estimates e ON e.id = po.cost_estimation_id
      WHERE po.id = ?
    `, [id]);

    if (!po) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }

    res.json({ success: true, data: po });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      po_number,
      project_id,
      client_id,
      po_amount,
      po_date
    } = req.body;

    let po_document = null;
    if (req.files?.po_document) {
      const file = req.files.po_document;
      const result = await imagekit.upload({
        file: fs.readFileSync(file.tempFilePath),
        fileName: file.name,
        folder: "/purchase_orders",
      });
      po_document = result.url;
      fs.unlinkSync(file.tempFilePath);
    }

    await pool.query(
      `UPDATE purchase_orders SET
        po_number = ?,
        project_id = ?,
        client_id = ?,
        po_amount = ?,
        po_date = ?,
        po_document = COALESCE(?, po_document)
      WHERE id = ?`,
      [
        po_number,
        project_id,
        client_id,
        po_amount,
        po_date,
        po_document,
        id
      ]
    );

    res.json({
      success: true,
      message: "Purchase Order updated successfully"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const [[po]] = await pool.query(
      `SELECT cost_estimation_id FROM purchase_orders WHERE id = ?`,
      [id]
    );

    if (!po) {
      return res.status(404).json({ message: "Purchase Order not found" });
    }

    await pool.query(`DELETE FROM purchase_orders WHERE id = ?`, [id]);

    // Rollback ONLY PO status
    await pool.query(
      `UPDATE estimates SET ce_po_status = 'pending' WHERE id = ?`,
      [po.cost_estimation_id]
    );

    res.json({
      success: true,
      message: "Purchase Order deleted & estimate rolled back"
    });

  } catch (error) {
    console.error("Delete PO Error:", error);
    res.status(500).json({ message: error.message });
  }
};


