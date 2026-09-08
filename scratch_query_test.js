import { pool } from "./Config/dbConnect.js";

async function test() {
  const [columns] = await pool.query(`SHOW COLUMNS FROM jobs`);
  const jobCols = columns.map(c => ({ Field: c.Field, Null: c.Null }));
  console.log("Jobs columns:", jobCols);

  const [brandCols] = await pool.query(`SHOW COLUMNS FROM brand_names`);
  console.log("brand_names columns:", brandCols.map(c => ({ Field: c.Field, Null: c.Null })));
  process.exit(0);
}

test();
