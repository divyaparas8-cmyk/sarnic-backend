import { pool } from "../Config/dbConnect.js";

async function runMigration() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    console.log("Starting migration: Split legacy grouped assignments...");

    // 1. Find all assign_jobs with multiple IDs or at least length > 1
    // We'll just fetch all and process them
    const [rows] = await connection.query(`
      SELECT * FROM assign_jobs
      WHERE JSON_LENGTH(job_ids) > 1
    `);

    console.log(`Found ${rows.length} legacy assignment records to split.`);

    for (const row of rows) {
      let jobIdsArray = [];

      try {
        if (typeof row.job_ids === "string") {
          jobIdsArray = JSON.parse(row.job_ids);
        } else if (Array.isArray(row.job_ids)) {
          jobIdsArray = row.job_ids;
        }
      } catch (e) {
        console.warn(`Failed to parse job_ids for assign_job ${row.id}: ${row.job_ids}`);
        continue;
      }

      if (!Array.isArray(jobIdsArray) || jobIdsArray.length <= 1) {
        continue;
      }

      console.log(`Splitting assign_job ${row.id} with jobs ${jobIdsArray.join(", ")}`);

      // Create a separate record for each job
      for (const jobId of jobIdsArray) {
        const singleJobIdString = `[${jobId}]`;

        await connection.query(
          `
          INSERT INTO assign_jobs
          (
            project_id,
            job_ids,
            employee_id,
            production_id,
            task_description,
            time_budget,
            admin_status,
            production_status,
            employee_status,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            row.project_id,
            singleJobIdString,
            row.employee_id,
            row.production_id,
            row.task_description,
            row.time_budget,
            row.admin_status,
            row.production_status,
            row.employee_status,
            row.created_at,
            row.updated_at
          ]
        );
      }

      // Delete the original legacy record
      await connection.query(`DELETE FROM assign_jobs WHERE id = ?`, [row.id]);
      console.log(`Deleted legacy assign_job ${row.id}`);
    }

    await connection.commit();
    console.log("Migration completed successfully.");

  } catch (error) {
    await connection.rollback();
    console.error("Migration failed:", error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigration();
