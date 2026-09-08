import { pool } from "../Config/dbConnect.js";

export const createBrand = async (req, res) => {
  const { name } = req.body;
  const [result] = await pool.query(
    "INSERT INTO brand_names (name) VALUES (?)",
    [name]
  );
  res.json({ success: true, id: result.insertId });
};

export const getBrands = async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM brand_names");
  res.json({ success: true, data: rows });
};

export const deleteBrand = async (req, res) => {
  await pool.query("DELETE FROM brand_names WHERE id = ?", [req.params.id]);
  res.json({ success: true, message: "Brand deleted" });
};

export const deleteMultipleBrands = async (req, res) => {
  try {
    console.log("RAW req.body:", req.body);
    let { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      console.log("❌ Invalid ids:", ids);
      return res.status(400).json({
        message: "ids array is required"
      });
    }
    console.log("Received IDs:", ids);
    ids = ids.map(id => Number(id));
    console.log("IDs AFTER Number():", ids);
        const [result] = await pool.query(
      `DELETE FROM brand_names WHERE id IN (?)`, // Use a single placeholder
      [ids] // Pass ids as an array
    );
    console.log("SQL affectedRows:", result.affectedRows);
    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "No brands deleted (IDs not found or restricted)"
      });
    }
    res.json({
      success: true,
      message: "Selected brands deleted successfully",
      deletedCount: result.affectedRows
    });
  } catch (error) {
    console.error("❌ Bulk Delete Brand Error:", error);
    res.status(500).json({ message: error.message });
  }
};


