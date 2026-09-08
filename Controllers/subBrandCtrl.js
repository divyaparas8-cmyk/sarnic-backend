import { pool } from "../Config/dbConnect.js";

export const createSubBrand = async (req, res) => {
  const [r] = await pool.query(
    "INSERT INTO sub_brands (name) VALUES (?)",
    [req.body.name]
  );
  res.json({ success: true, id: r.insertId });
};

export const getSubBrands = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM sub_brands");
  res.json({ success: true, data: rows });
};

export const deleteSubBrand = async (req, res) => {
  await pool.query("DELETE FROM sub_brands WHERE id=?", [req.params.id]);
  res.json({ success: true });
};

export const deleteMultipleSubBrands = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "ids array is required"
      });
    }

    const placeholders = ids.map(() => "?").join(",");

    await pool.query(
      `DELETE FROM sub_brands WHERE id IN (${placeholders})`,
      ids
    );

    res.json({
      success: true,
      message: "Selected sub brands deleted successfully"
    });
  } catch (error) {
    console.error("Bulk Delete Sub Brand Error:", error);
    res.status(500).json({ message: error.message });
  }
};

