import { pool } from "./Config/dbConnect.js";

async function run() {
  try {
    const [rows] = await pool.query("SELECT * FROM jobs LIMIT 5");
    console.log("JOBS IN DB:", rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
