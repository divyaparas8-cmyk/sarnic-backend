import { pool } from "../Config/dbConnect.js";

export const createPackType = async (req, res) => {
  const [r] = await pool.query(
    "INSERT INTO pack_types (name) VALUES (?)",
    [req.body.name]
  );
  res.json({ success: true, id: r.insertId });
};

export const getPackTypes = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM pack_types");
  res.json({ success: true, data: rows });
};

export const deletePackType = async (req, res) => {
  await pool.query("DELETE FROM pack_types WHERE id=?", [req.params.id]);
  res.json({ success: true });
};

export const deleteMultiplePackTypes = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "ids array is required"
      });
    }

    const placeholders = ids.map(() => "?").join(",");

    await pool.query(
      `DELETE FROM pack_types WHERE id IN (${placeholders})`,
      ids
    );

    res.json({
      success: true,
      message: "Selected pack types deleted successfully"
    });
  } catch (error) {
    console.error("Bulk Delete Pack Type Error:", error);
    res.status(500).json({ message: error.message });
  }
};
