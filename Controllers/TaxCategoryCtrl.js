import { pool } from "../Config/dbConnect.js";

export const createTaxCategory = async (req, res) => {
  try {
    const { category_name, tax_rate } = req.body;

    if (!category_name || tax_rate === undefined) {
      return res.status(400).json({
        message: "category_name and tax_rate are required"
      });
    }

    const [result] = await pool.query(
      `INSERT INTO tax_category (category_name, tax_rate)
       VALUES (?, ?)`,
      [category_name, tax_rate]
    );

    res.status(200).json({
      success: true,
      message: "Tax category created successfully",
      id: result.insertId
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllTaxCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM tax_category ORDER BY id DESC"
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getTaxCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[row]] = await pool.query(
      "SELECT * FROM tax_category WHERE id=?",
      [id]
    );

    if (!row) {
      return res.status(404).json({ message: "Tax category not found" });
    }

    res.json({
      success: true,
      data: row
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteTaxCategory = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      "DELETE FROM tax_category WHERE id=?",
      [id]
    );

    res.json({
      success: true,
      message: "Tax category deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
