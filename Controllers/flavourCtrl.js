
import { pool } from "../Config/dbConnect.js";

export const createFlavour = async (req, res) => {
  const [r] = await pool.query(
    "INSERT INTO flavours (name) VALUES (?)",
    [req.body.name]
  );
  res.json({ success: true, id: r.insertId });
};

export const getFlavours = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM flavours");
  res.json({ success: true, data: rows });
};

export const deleteFlavour = async (req, res) => {
  await pool.query("DELETE FROM flavours WHERE id=?", [req.params.id]);
  res.json({ success: true });
};

export const deleteMultipleFlavours = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "ids array is required"
      });
    }
    const placeholders = ids.map(() => "?").join(",");
    await pool.query(
      `DELETE FROM flavours WHERE id IN (${placeholders})`,
      ids
    );

    res.json({
      success: true,
      message: "Selected flavours deleted successfully"
    });
  } catch (error) {
    console.error("Bulk Delete Flavour Error:", error);
    res.status(500).json({ message: error.message });
  }
};
