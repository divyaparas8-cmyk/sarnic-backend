
import { pool } from "../Config/dbConnect.js";

export const createPackCode = async (req, res) => {
  const [r] = await pool.query(
    "INSERT INTO pack_codes (name) VALUES (?)",
    [req.body.name]
  );
  res.json({ success: true, id: r.insertId });
};

export const getPackCodes = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM pack_codes");
  res.json({ success: true, data: rows });
};

export const deletePackCode = async (req, res) => {
  await pool.query("DELETE FROM pack_codes WHERE id=?", [req.params.id]);
  res.json({ success: true });
};

export const deleteMultiplePackCodes = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "ids array is required"
      });
    }

    const placeholders = ids.map(() => "?").join(",");

    await pool.query(
      `DELETE FROM pack_codes WHERE id IN (${placeholders})`,
      ids
    );

    res.json({
      success: true,
      message: "Selected pack codes deleted successfully"
    });
  } catch (error) {
    console.error("Bulk Delete Pack Code Error:", error);
    res.status(500).json({ message: error.message });
  }
};

