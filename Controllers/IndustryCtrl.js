import { pool } from "../Config/dbConnect.js";

export const createIndustry = async (req, res) => {
  const [r] = await pool.query(
    "INSERT INTO industries (name) VALUES (?)",
    [req.body.name]
  );
  res.json({ success: true, id: r.insertId });
};

export const getIndustries = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM industries");
  res.json({ success: true, data: rows });
};

export const deleteIndustry = async (req, res) => {
  await pool.query("DELETE FROM industries WHERE id=?", [req.params.id]);
  res.json({ success: true });
};

export const deleteMultipleIndustries = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "ids array is required"
      });
    }

    const placeholders = ids.map(() => "?").join(",");

    await pool.query(
      `DELETE FROM industries WHERE id IN (${placeholders})`,
      ids
    );

    res.json({
      success: true,
      message: "Selected industries deleted successfully"
    });
  } catch (error) {
    console.error("Bulk Delete Industry Error:", error);
    res.status(500).json({ message: error.message });
  }
};

