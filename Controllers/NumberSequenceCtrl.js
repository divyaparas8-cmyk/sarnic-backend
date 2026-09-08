import { pool } from "../Config/dbConnect.js";

// Get all number sequences
export const getAllSequences = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM number_sequences ORDER BY id"
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching number sequences:", error);
    res.status(500).json({ message: "Failed to fetch number sequences" });
  }
};

// Update a single sequence's default value
export const updateSequence = async (req, res) => {
  try {
    const { id } = req.params;
    const { default_start } = req.body;

    if (default_start === undefined || default_start === null) {
      return res.status(400).json({ message: "default_start is required" });
    }

    await pool.query(
      "UPDATE number_sequences SET default_start = ? WHERE id = ?",
      [default_start, id]
    );

    res.status(200).json({ success: true, message: "Sequence updated successfully" });
  } catch (error) {
    console.error("Error updating number sequence:", error);
    res.status(500).json({ message: "Failed to update number sequence" });
  }
};

// Helper: get next number for a given sequence_key, and increment the counter
export const getNextNumber = async (sequenceKey) => {
  const [[row]] = await pool.query(
    "SELECT default_start FROM number_sequences WHERE sequence_key = ?",
    [sequenceKey]
  );
  const nextNo = (row ? row.default_start : 0) + 1;
  // Update the counter so next call gives +1
  await pool.query(
    "UPDATE number_sequences SET default_start = ? WHERE sequence_key = ?",
    [nextNo, sequenceKey]
  );
  return nextNo;
};
