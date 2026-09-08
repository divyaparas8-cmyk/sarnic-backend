import { pool } from "./Config/dbConnect.js";

(async () => {
    try {
        await pool.query("ALTER TABLE users ADD COLUMN tenant_id INT DEFAULT NULL;");
        console.log("✅ Added tenant_id column to users table.");
        process.exit(0);
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
             console.log("Column tenant_id already exists.");
             process.exit(0);
        }
        console.error("❌ Error:", error);
        process.exit(1);
    }
})();
