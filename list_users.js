import { pool } from "./Config/dbConnect.js";

async function run() {
  try {
    const [rows] = await pool.query("SELECT id, email, first_name, last_name, role_name FROM users");
    console.log("USERS:", rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
