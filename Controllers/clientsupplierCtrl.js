
import { pool } from "../Config/dbConnect.js";

export const createClientSupplier = async (req, res) => {
  try {
    const {
      type,
      name,
      short_name,
      industry,
      website,
      address,
      tax_id,
      phone,
      status,
      contact_persons,
      payment_terms,
      credit_limit,
      notes
    } = req.body;

    if (!type || !name) {
      return res.status(400).json({ message: "Type and Name are required" });
    }

    const [result] = await pool.query(
      `INSERT INTO clients_suppliers
       (type, name, short_name, industry, website, address, tax_id, phone, status,
        contact_persons, payment_terms, credit_limit, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        type,
        name,
        short_name || null,
        industry || null,
        website || null,
        address || null,
        tax_id || null,
        phone || null,
        status || "active",
        contact_persons ? JSON.stringify(contact_persons) : null,
        payment_terms || null,
        credit_limit || null,
        notes || null
      ]
    );

    res.json({
      success: true,
      message: "Client/Supplier created successfully",
      id: result.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

export const getAllClientSuppliers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM clients_suppliers ORDER BY id DESC"
    );
    const data = rows.map(r => ({
      ...r,
      contact_persons: r.contact_persons
        ? JSON.parse(r.contact_persons)
        : []
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getClientSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[row]] = await pool.query(
      "SELECT * FROM clients_suppliers WHERE id=?",
      [id]
    );

    if (!row) {
      return res.status(404).json({ message: "Record not found" });
    }

    row.contact_persons = row.contact_persons
      ? JSON.parse(row.contact_persons)
      : [];

    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateClientSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      name,
      short_name,
      industry,
      website,
      address,
      tax_id,
      phone,
      status,
      contact_persons,
      payment_terms,
      credit_limit,
      notes
    } = req.body;

    await pool.query(
      `UPDATE clients_suppliers SET
        type=?, name=?, short_name=?, industry=?, website=?, address=?, tax_id=?, phone=?,
        status=?, contact_persons=?, payment_terms=?, credit_limit=?, notes=?
       WHERE id=?`,
      [
        type,
        name,
        short_name || null,
        industry,
        website,
        address,
        tax_id,
        phone,
        status,
        contact_persons ? JSON.stringify(contact_persons) : null,
        payment_terms,
        credit_limit,
        notes,
        id
      ]
    );

    res.json({ success: true, message: "Updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteClientSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM clients_suppliers WHERE id=?",
      [id]
    );

    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getClientsOnly = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM clients_suppliers WHERE type='client' ORDER BY id DESC"
    );

    const data = rows.map(r => ({
      ...r,
      contact_persons: r.contact_persons
        ? JSON.parse(r.contact_persons)
        : []
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getSuppliersOnly = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM clients_suppliers WHERE type='supplier' ORDER BY id DESC"
    );

    const data = rows.map(r => ({
      ...r,
      contact_persons: r.contact_persons
        ? JSON.parse(r.contact_persons)
        : []
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
