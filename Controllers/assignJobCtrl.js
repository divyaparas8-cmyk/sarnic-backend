import { pool } from "../Config/dbConnect.js";

export const createAssignJob = async (req, res) => {
  try {
    const {
      project_id,
      job_ids,
      employee_id,
      production_id,
      task_description,
      time_budget,
    } = req.body;

    let jobIdsArray = [];
    if (typeof job_ids === "string") {
      try {
        jobIdsArray = JSON.parse(job_ids);
      } catch (e) {
        jobIdsArray = job_ids.split(",").map(id => Number(id.trim())).filter(id => id);
      }
    } else if (Array.isArray(job_ids)) {
      jobIdsArray = job_ids;
    }

    // -----------------------------
    // Validation
    // -----------------------------
    if (!project_id || jobIdsArray.length === 0 || (!employee_id && !production_id)) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // -----------------------------
    // Status defaults
    // -----------------------------
    let admin_status = "in_progress";
    let production_status = "not_applicable";
    let employee_status = "not_applicable";
    let assignedLabel = "Unassigned";

    // -----------------------------
    // Assignment logic (UNCHANGED)
    // -----------------------------
    if (production_id && !employee_id) {
      production_status = "in_progress";
      assignedLabel = `${production_id}`;
    }

    if (employee_id && !production_id) {
      admin_status = "in_progress";
      production_status = "in_progress";
      employee_status = "in_progress";
      assignedLabel = String(employee_id);
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const jobId of jobIdsArray) {
        const singleJobIdString = `[${jobId}]`;

        // -----------------------------
        // 1️⃣ Check existing assign job for this job
        // -----------------------------
        const [existing] = await connection.query(
          `
          SELECT id, production_id, employee_id, admin_status, production_status, employee_status FROM assign_jobs
          WHERE project_id = ? 
            AND job_ids = ?
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [project_id, singleJobIdString]
        );

        // -----------------------------
        // 2️⃣ UPDATE or INSERT assign_jobs
        // -----------------------------
        if (existing.length > 0) {
          const finalProductionId = production_id !== undefined ? (production_id || null) : existing[0].production_id;
          const finalEmployeeId = employee_id !== undefined ? (employee_id || null) : existing[0].employee_id;
          const finalEmpStatus = employee_id ? "in_progress" : (existing[0].employee_status || employee_status);

          await connection.query(
            `
            UPDATE assign_jobs
            SET
              production_id = ?,
              employee_id = ?,
              task_description = COALESCE(?, task_description),
              time_budget = COALESCE(?, time_budget),
              admin_status = ?,
              production_status = ?,
              employee_status = ?,
              updated_at = NOW()
            WHERE id = ?
            `,
            [
              finalProductionId,
              finalEmployeeId,
              task_description || null,
              time_budget || null,
              admin_status,
              production_status,
              finalEmpStatus,
              existing[0].id,
            ]
          );
        } else {
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
            VALUES (?,?,?,?,?,?,?,?,?, NOW(), NOW())
            `,
            [
              project_id,
              singleJobIdString,
              employee_id || null,
              production_id || null,
              task_description || null,
              time_budget || null,
              admin_status,
              production_status,
              employee_status,
            ]
          );
        }

        // -----------------------------
        // 3️⃣ Update jobs table
        // -----------------------------
        await connection.query(
          `
          UPDATE jobs
          SET
            job_status = 'in_progress',
            assigned = ?
          WHERE id = ?
          `,
          [assignedLabel, jobId]
        );
      }

      await connection.commit();

      // -----------------------------
      // Response
      // -----------------------------
      res.status(201).json({
        success: true,
        message: "Jobs assigned successfully & jobs updated",
      });
    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Assign Job Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const productionAssignToEmployee = async (req, res) => {
  try {
    const { assign_job_ids, employee_id } = req.body;

    if (!Array.isArray(assign_job_ids) || !assign_job_ids.length) {
      return res.status(400).json({
        success: false,
        message: "assign_job_ids array is required",
      });
    }

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: "employee_id is required",
      });
    }

    const ids = assign_job_ids.map((id) => Number(id)).filter(Boolean);
    const placeholders = ids.map(() => "?").join(",");

    /* 1️⃣ Update assign_jobs */
    await pool.query(
      `
      UPDATE assign_jobs
      SET 
        employee_id = ?,
        employee_status = 'in_progress',
        production_status = 'in_progress',
        admin_status = 'in_progress'
      WHERE id IN (${placeholders})
      `,
      [employee_id, ...ids]
    );

    /* 2️⃣ Update jobs (IMPORTANT FIX) */
    await pool.query(
      `
      UPDATE jobs j
      JOIN assign_jobs aj
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
      SET 
        j.assigned = ?,          -- ✅ employee_id stored here
        j.job_status = 'in_progress'
      WHERE aj.id IN (${placeholders})
      `,
      [String(employee_id), ...ids]
    );

    res.json({
      success: true,
      message: "Jobs assigned to employee successfully",
      employee_id,
      assign_job_ids: ids,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const employeeCompleteJob = async (req, res) => {
  try {
    const { assign_job_id, job_id } = req.params;

    /* 1️⃣ Update assign_jobs */
    await pool.query(
      `
      UPDATE assign_jobs
      SET 
        employee_status = 'complete',
        production_status = 'complete'
      WHERE id = ?
      `,
      [assign_job_id]
    );

    /* 2️⃣ Update ONLY selected job */
    await pool.query(
      `
      UPDATE jobs
      SET 
        job_status = 'complete'
      WHERE id = ?
      `,
      [job_id]
    );

    res.json({
      success: true,
      message: "Job completed successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const employeeRejectJob = async (req, res) => {
  try {
    const { assign_job_id, job_id } = req.params;

    /* 1️⃣ Update assign_jobs */
    await pool.query(
      `
      UPDATE assign_jobs
      SET 
        employee_status = 'reject',
        production_status = 'reject'
      WHERE id = ?
      `,
      [assign_job_id]
    );

    /* 2️⃣ Update ONLY selected job */
    await pool.query(
      `
      UPDATE jobs
      SET 
        job_status = 'reject',
        assigned = 'Unassigned'
      WHERE id = ?
      `,
      [job_id]
    );

    res.json({
      success: true,
      message: "Job rejected by employee",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const productionCompleteJob = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Fetch job_ids from assign_jobs
    const [assignRows] = await connection.query(
      `SELECT job_ids FROM assign_jobs WHERE id = ?`,
      [req.params.id]
    );

    if (!assignRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Assign job not found",
      });
    }

    // 2️⃣ Safely parse job_ids
    let jobIds = [];

    try {
      if (assignRows[0].job_ids) {
        jobIds =
          typeof assignRows[0].job_ids === "string"
            ? JSON.parse(assignRows[0].job_ids)
            : assignRows[0].job_ids;
      }
    } catch (e) {
      jobIds = [];
    }

    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "No jobs found to update",
      });
    }

    // 3️⃣ Update assign_jobs status
    await connection.query(
      `
      UPDATE assign_jobs
      SET 
        production_status = 'complete',
        admin_status = 'complete'
      WHERE id = ?
      `,
      [req.params.id]
    );

    // 4️⃣ Update jobs table (ONLY related jobs)
    await connection.query(
      `
      UPDATE jobs
      SET 
        job_status = 'complete',
        assigned = 'Unassigned'
      WHERE id IN (?)
      `,
      [jobIds]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Production completed successfully",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Production Complete Error:", error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  } finally {
    connection.release();
  }
};
export const productionReturnJob = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Get assign job ids (BODY first, fallback to PARAM)
    let assignIds = req.body?.ids;

    if (!Array.isArray(assignIds) || !assignIds.length) {
      if (req.params.id) {
        assignIds = [Number(req.params.id)];
      }
    }

    if (!Array.isArray(assignIds) || !assignIds.length) {
      return res.status(400).json({
        success: false,
        message: "No assign job ids provided",
      });
    }

    // ensure numbers
    assignIds = assignIds.map((id) => Number(id)).filter(Boolean);

    // 2️⃣ Fetch job_ids
    const placeholders = assignIds.map(() => "?").join(",");

    const [assignRows] = await connection.query(
      `SELECT id, job_ids FROM assign_jobs WHERE id IN (${placeholders})`,
      assignIds
    );

    if (!assignRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Assign job(s) not found",
      });
    }

    // 2.5 Server-side validation: Block return if job is currently in_progress with Designer for re-work
    const [statusRows] = await connection.query(
      `SELECT employee_status, production_status FROM assign_jobs WHERE id IN (${placeholders})`,
      assignIds
    );
    const isReWorkInProgress = statusRows.some(
      (r) => r.employee_status === "in_progress" && r.production_status === "in_progress"
    );
    if (isReWorkInProgress) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot return job while it is currently in progress with Designer for re-work.",
      });
    }

    // 3️⃣ Collect all related job ids robustly
    let allJobIds = [];

    for (const row of assignRows) {
      let jobIds = row.job_ids;

      if (typeof jobIds === "number") {
        allJobIds.push(jobIds);
      } else if (typeof jobIds === "string") {
        try {
          const parsed = JSON.parse(jobIds);
          if (Array.isArray(parsed)) {
            allJobIds.push(...parsed.map(Number));
          } else if (typeof parsed === "number") {
            allJobIds.push(parsed);
          }
        } catch (e) {
          const splitIds = jobIds.split(",").map((id) => Number(id.trim())).filter(Boolean);
          allJobIds.push(...splitIds);
        }
      } else if (Array.isArray(jobIds)) {
        allJobIds.push(...jobIds.map(Number));
      }
    }

    allJobIds = [...new Set(allJobIds)].filter(Boolean);

    // 4️⃣ Update assign_jobs → RETURN
    await connection.query(
      `
      UPDATE assign_jobs
      SET 
        production_status = 'return',
        admin_status = 'return',
        employee_status = 'return'
      WHERE id IN (${placeholders})
      `,
      assignIds
    );

    if (allJobIds.length > 0) {
      const jobPlaceholders = allJobIds.map(() => "?").join(",");

      for (const jobId of allJobIds) {
        await connection.query(
          `
          UPDATE assign_jobs
          SET 
            production_status = 'return',
            admin_status = 'return',
            employee_status = 'return'
          WHERE JSON_CONTAINS(job_ids, JSON_ARRAY(?)) OR job_ids = ? OR job_ids = ?
          `,
          [jobId, String(jobId), `[${jobId}]`]
        );
      }

      await connection.query(
        `
        UPDATE jobs
        SET 
          assigned = 'Unassigned',
          job_status = 'return'
        WHERE id IN (${jobPlaceholders})
        `,
        allJobIds
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Production returned. Jobs marked as return & unassigned.",
      assignJobIds: assignIds,
      affectedJobIds: allJobIds,
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  } finally {
    connection.release();
  }
};

export const productionReturnJobStatus = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let assignIds = req.body?.ids;
    if (!Array.isArray(assignIds) || !assignIds.length) {
      if (req.params.id) assignIds = [Number(req.params.id)];
    }

    if (!Array.isArray(assignIds) || !assignIds.length) {
      return res
        .status(400)
        .json({ success: false, message: "No assign job ids provided" });
    }

    assignIds = assignIds.map((id) => Number(id)).filter(Boolean);

    const placeholders = assignIds.map(() => "?").join(",");
    const [assignRows] = await connection.query(
      `SELECT id, job_ids FROM assign_jobs WHERE id IN (${placeholders})`,
      assignIds
    );

    if (!assignRows.length) {
      await connection.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Assign job(s) not found" });
    }

    const [statusRows] = await connection.query(
      `SELECT employee_status, production_status FROM assign_jobs WHERE id IN (${placeholders})`,
      assignIds
    );
    const isReWorkInProgress = statusRows.some(
      (r) => r.employee_status === "in_progress" && r.production_status === "in_progress"
    );
    if (isReWorkInProgress) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Cannot return job while it is currently in progress with Designer for re-work.",
      });
    }

    let allJobIds = [];
    for (const row of assignRows) {
      let jobIds = row.job_ids;
      if (typeof jobIds === "number") {
        allJobIds.push(jobIds);
      } else if (typeof jobIds === "string") {
        try {
          const parsed = JSON.parse(jobIds);
          if (Array.isArray(parsed)) {
            allJobIds.push(...parsed.map(Number));
          } else if (typeof parsed === "number") {
            allJobIds.push(parsed);
          }
        } catch (e) {
          const splitIds = jobIds.split(",").map((id) => Number(id.trim())).filter(Boolean);
          allJobIds.push(...splitIds);
        }
      } else if (Array.isArray(jobIds)) {
        allJobIds.push(...jobIds.map(Number));
      }
    }
    allJobIds = [...new Set(allJobIds)].filter(Boolean);

    // update assign_jobs
    await connection.query(
      `UPDATE assign_jobs SET production_status = 'return', admin_status = 'return', employee_status = 'return' WHERE id IN (${placeholders})`,
      assignIds
    );

    if (allJobIds.length > 0) {
      const jobPlaceholders = allJobIds.map(() => "?").join(",");

      for (const jobId of allJobIds) {
        await connection.query(
          `
          UPDATE assign_jobs
          SET 
            production_status = 'return',
            admin_status = 'return',
            employee_status = 'return'
          WHERE JSON_CONTAINS(job_ids, JSON_ARRAY(?)) OR job_ids = ? OR job_ids = ?
          `,
          [jobId, String(jobId), `[${jobId}]`]
        );
      }

      await connection.query(
        `UPDATE jobs SET job_status = 'return', assigned = 'Unassigned' WHERE id IN (${jobPlaceholders})`,
        allJobIds
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Jobs returned successfully",
      assignJobIds: assignIds,
      affectedJobIds: allJobIds,
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  } finally {
    connection.release();
  }
};

export const productionRejectJob = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1️⃣ Get assign job ids (BODY first, PARAM fallback)
    let assignIds = req.body?.ids;

    if (!Array.isArray(assignIds) || !assignIds.length) {
      if (req.params.id) {
        assignIds = [Number(req.params.id)];
      }
    }

    if (!Array.isArray(assignIds) || !assignIds.length) {
      return res.status(400).json({
        success: false,
        message: "No assign job ids provided",
      });
    }

    assignIds = assignIds.map((id) => Number(id)).filter(Boolean);

    // 2️⃣ Fetch job_ids
    const placeholders = assignIds.map(() => "?").join(",");

    const [assignRows] = await connection.query(
      `SELECT id, job_ids FROM assign_jobs WHERE id IN (${placeholders})`,
      assignIds
    );

    if (!assignRows.length) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Assign job(s) not found",
      });
    }

    // 3️⃣ Collect all job ids
    let allJobIds = [];

    for (const row of assignRows) {
      let jobIds = row.job_ids;

      if (typeof jobIds === "string") {
        jobIds = JSON.parse(jobIds);
      }

      if (Array.isArray(jobIds)) {
        allJobIds.push(...jobIds);
      }
    }

    allJobIds = [...new Set(allJobIds)];

    // 4️⃣ Update assign_jobs → REJECT
    await connection.query(
      `
      UPDATE assign_jobs
      SET 
        production_status = 'reject',
        admin_status = 'reject'
      WHERE id IN (${placeholders})
      `,
      assignIds
    );

    // 5️⃣ Update jobs → REJECT
    if (allJobIds.length > 0) {
      const jobPlaceholders = allJobIds.map(() => "?").join(",");

      await connection.query(
        `
        UPDATE jobs
        SET 
          assigned = 'Unassigned',
          job_status = 'reject'
        WHERE id IN (${jobPlaceholders})
        `,
        allJobIds
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Production rejected successfully",
      assignJobIds: assignIds,
      affectedJobIds: allJobIds,
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  } finally {
    connection.release();
  }
};



export const getJobsByEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employee_id;

    const [rows] = await pool.query(
      `
      SELECT
        aj.*,

        -- job
        j.id AS job_id,
        j.job_no,
        j.job_status,
        j.priority AS job_priority,
        j.pack_size,
        j.ean_barcode,
        j.project_id,
        j.pack_code,

        -- project
        p.id AS project_id,
        p.project_name,
        p.project_no,
        p.client_name,
        p.status AS project_status,
        p.priority AS project_priority,
        p.start_date,
        p.expected_completion_date,

        -- brand
        b.id AS brand_id,
        b.name AS brand_name,

        -- sub brand
        sb.id AS sub_brand_id,
        sb.name AS sub_brand_name,

        -- flavour
        f.id AS flavour_id,
        f.name AS flavour_name,

        -- pack type
        pt.id AS pack_type_id,
        pt.name AS pack_type_name,

        -- employee user (from assign_jobs)
        u.id AS employee_user_id,
        u.first_name AS employee_first_name,
        u.last_name AS employee_last_name,
        u.email AS employee_email,

        -- job assigned user (from jobs.assigned)
        ju.id AS job_assigned_user_id,
        ju.first_name AS job_assigned_first_name,
        ju.last_name AS job_assigned_last_name,
        ju.email AS job_assigned_email

      FROM jobs j

      -- assign_jobs (may or may not exist)
      LEFT JOIN assign_jobs aj
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))

      JOIN projects p
        ON j.project_id = p.id

      LEFT JOIN brand_names b
        ON j.brand_id = b.id

      LEFT JOIN sub_brands sb
        ON j.sub_brand_id = sb.id

      LEFT JOIN flavours f
        ON j.flavour_id = f.id

  

      LEFT JOIN pack_types pt
        ON j.pack_type_id = pt.id

      LEFT JOIN users u
        ON aj.employee_id = u.id

      LEFT JOIN users ju
        ON ju.id = j.assigned

      WHERE 
        (aj.employee_id = ? OR j.assigned = ?)
        AND (aj.id IS NULL OR aj.id IN (
          SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids
        ))

      ORDER BY 
        COALESCE(aj.created_at, j.created_at) DESC
      `,
      [employeeId, employeeId]
    );

    // =====================================
    // Transform rows → structured objects
    // =====================================
    const resultMap = {};

    rows.forEach((row) => {
      const key = row.id || `job-${row.job_id}`;

      if (!resultMap[key]) {
        resultMap[key] = {
          assign_job: row.id
            ? {
              id: row.id,
              project_id: row.project_id,
              job_ids: row.job_ids,
              employee_id: row.employee_id,
              production_id: row.production_id,
              task_description: row.task_description,
              time_budget: row.time_budget,
              admin_status: row.admin_status,
              production_status: row.production_status,
              employee_status: row.employee_status,
              created_at: row.created_at,
              updated_at: row.updated_at,
              pack_code: row.pack_code,
            }
            : null,

          employee_user: row.employee_user_id
            ? {
              id: row.employee_user_id,
              first_name: row.employee_first_name,
              last_name: row.employee_last_name,
              email: row.employee_email,
            }
            : null,

          project: {
            id: row.project_id,
            project_no: row.project_no,
            project_name: row.project_name,
            client_name: row.client_name,
            status: row.project_status,
            priority: row.project_priority,
            start_date: row.start_date,
            expected_completion_date: row.expected_completion_date,
          },

          jobs: [],
        };
      }

      resultMap[key].jobs.push({
        id: row.job_id,
        job_no: row.job_no,
        job_status: row.job_status,
        priority: row.job_priority,
        pack_size: row.pack_size,
        ean_barcode: row.ean_barcode,

        brand: row.brand_id ? { id: row.brand_id, name: row.brand_name } : null,

        sub_brand: row.sub_brand_id
          ? { id: row.sub_brand_id, name: row.sub_brand_name }
          : null,

        flavour: row.flavour_id
          ? { id: row.flavour_id, name: row.flavour_name }
          : null,



        pack_type: row.pack_type_id
          ? { id: row.pack_type_id, name: row.pack_type_name }
          : null,

        assigned_user: row.job_assigned_user_id
          ? {
            id: row.job_assigned_user_id,
            first_name: row.job_assigned_first_name,
            last_name: row.job_assigned_last_name,
            email: row.job_assigned_email,
          }
          : null,
      });
    });

    res.json({
      success: true,
      data: Object.values(resultMap),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getJobsAllEmployee = async (req, res) => {
  try {
    const employeeId = req.params.employee_id;

    const [rows] = await pool.query(
      `
      SELECT
        aj.*,

        -- job
        j.id AS job_id,
        j.job_no,
        j.job_status,
        j.priority AS job_priority,
        j.pack_size,
        j.ean_barcode,
        j.project_id,
        j.pack_code,

        -- project
        p.id AS project_id,
        p.project_name,
        p.project_no,
        p.client_name,
        p.status AS project_status,
        p.priority AS project_priority,
        p.start_date,
        p.expected_completion_date,

        -- brand
        b.id AS brand_id,
        b.name AS brand_name,

        -- sub brand
        sb.id AS sub_brand_id,
        sb.name AS sub_brand_name,

        -- flavour
        f.id AS flavour_id,
        f.name AS flavour_name,

      

        -- pack type
        pt.id AS pack_type_id,
        pt.name AS pack_type_name,

        -- employee user (from assign_jobs)
        u.id AS employee_user_id,
        u.first_name AS employee_first_name,
        u.last_name AS employee_last_name,
        u.email AS employee_email,

        -- job assigned user (from jobs.assigned)
        ju.id AS job_assigned_user_id,
        ju.first_name AS job_assigned_first_name,
        ju.last_name AS job_assigned_last_name,
        ju.email AS job_assigned_email

      FROM jobs j

      -- assign_jobs (may or may not exist)
      LEFT JOIN assign_jobs aj
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))

      JOIN projects p
        ON j.project_id = p.id

      LEFT JOIN brand_names b
        ON j.brand_id = b.id

      LEFT JOIN sub_brands sb
        ON j.sub_brand_id = sb.id

      LEFT JOIN flavours f
        ON j.flavour_id = f.id

   

      LEFT JOIN pack_types pt
        ON j.pack_type_id = pt.id

      LEFT JOIN users u
        ON aj.employee_id = u.id

      LEFT JOIN users ju
        ON ju.id = j.assigned

      WHERE (aj.id IS NULL OR aj.id IN (
        SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids
      ))

      ORDER BY 
        COALESCE(aj.created_at, j.created_at) DESC
      `
    );

    // =====================================
    // Transform rows → structured objects
    // =====================================
    const resultMap = {};

    rows.forEach((row) => {
      const key = row.id || `job-${row.job_id}`;

      if (!resultMap[key]) {
        resultMap[key] = {
          assign_job: row.id
            ? {
              id: row.id,
              project_id: row.project_id,
              job_ids: row.job_ids,
              employee_id: row.employee_id,
              production_id: row.production_id,
              task_description: row.task_description,
              time_budget: row.time_budget,
              admin_status: row.admin_status,
              production_status: row.production_status,
              employee_status: row.employee_status,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }
            : null,

          employee_user: row.employee_user_id
            ? {
              id: row.employee_user_id,
              first_name: row.employee_first_name,
              last_name: row.employee_last_name,
              email: row.employee_email,
            }
            : null,

          project: {
            id: row.project_id,
            project_no: row.project_no,
            project_name: row.project_name,
            client_name: row.client_name,
            status: row.project_status,
            priority: row.project_priority,
            start_date: row.start_date,
            expected_completion_date: row.expected_completion_date,
          },

          jobs: [],
        };
      }

      resultMap[key].jobs.push({
        id: row.job_id,
        job_no: row.job_no,
        job_status: row.job_status,
        priority: row.job_priority,
        pack_size: row.pack_size,
        ean_barcode: row.ean_barcode,

        brand: row.brand_id ? { id: row.brand_id, name: row.brand_name } : null,

        sub_brand: row.sub_brand_id
          ? { id: row.sub_brand_id, name: row.sub_brand_name }
          : null,

        flavour: row.flavour_id
          ? { id: row.flavour_id, name: row.flavour_name }
          : null,



        pack_type: row.pack_type_id
          ? { id: row.pack_type_id, name: row.pack_type_name }
          : null,

        assigned_user: row.job_assigned_user_id
          ? {
            id: row.job_assigned_user_id,
            first_name: row.job_assigned_first_name,
            last_name: row.job_assigned_last_name,
            email: row.job_assigned_email,
          }
          : null,
      });
    });

    res.json({
      success: true,
      data: Object.values(resultMap),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getAllProductionAssignJobs = async (req, res) => {
  try {
    // const productionId = req.params.production_id;

    const [rows] = await pool.query(
      `
      SELECT
        aj.*,

        -- job
        j.id AS job_id,
        j.job_no,
        j.job_status,
        j.priority AS job_priority,
        j.pack_size,
        j.ean_barcode,
        j.pack_code,
        j.project_id,

        -- project
        p.id AS project_id,
        p.project_name,
        p.project_no,
        p.client_name,
        p.status AS project_status,
        p.priority AS project_priority,
        p.start_date,
        p.expected_completion_date,

        -- brand
        b.id AS brand_id,
        b.name AS brand_name,

        -- sub brand
        sb.id AS sub_brand_id,
        sb.name AS sub_brand_name,

        -- flavour
        f.id AS flavour_id,
        f.name AS flavour_name,

       

        -- pack type
        pt.id AS pack_type_id,
        pt.name AS pack_type_name,

        -- production user
        u.id AS production_user_id,
        u.first_name AS production_first_name,
        u.last_name AS production_last_name,
        u.email AS production_email

      FROM assign_jobs aj

      JOIN jobs j 
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))

      JOIN projects p 
        ON j.project_id = p.id

      LEFT JOIN brand_names b 
        ON j.brand_id = b.id

      LEFT JOIN sub_brands sb 
        ON j.sub_brand_id = sb.id

      LEFT JOIN flavours f 
        ON j.flavour_id = f.id

     

      LEFT JOIN pack_types pt 
        ON j.pack_type_id = pt.id

      LEFT JOIN users u 
        ON aj.production_id = u.id

      WHERE (aj.employee_id IS NULL OR aj.employee_id = 0)
      AND aj.id IN (
        SELECT MAX(id) 
        FROM assign_jobs 
        GROUP BY project_id, job_ids
      )
   
      ORDER BY aj.created_at DESC
      `
    );

    // =====================================
    // Transform rows → structured objects
    // =====================================
    const resultMap = {};

    rows.forEach((row) => {
      if (!resultMap[row.id]) {
        resultMap[row.id] = {
          assign_job: {
            id: row.id,
            project_id: row.project_id,
            job_ids: row.job_ids,
            employee_id: row.employee_id,
            production_id: row.production_id,
            task_description: row.task_description,
            time_budget: row.time_budget,
            admin_status: row.admin_status,
            production_status: row.production_status,
            employee_status: row.employee_status,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },

          production_user: row.production_user_id
            ? {
              id: row.production_user_id,
              first_name: row.production_first_name,
              last_name: row.production_last_name,
              email: row.production_email,
            }
            : null,

          project: {
            id: row.project_id,
            project_no: row.project_no,
            project_name: row.project_name,
            client_name: row.client_name,
            status: row.project_status,
            priority: row.project_priority,
            start_date: row.start_date,
            expected_completion_date: row.expected_completion_date,
          },

          jobs: [],
        };
      }

      resultMap[row.id].jobs.push({
        id: row.job_id,
        job_no: row.job_no,
        job_status: row.job_status,
        priority: row.job_priority,
        pack_size: row.pack_size,
        ean_barcode: row.ean_barcode,
        pack_code: row.pack_code,

        brand: row.brand_id ? { id: row.brand_id, name: row.brand_name } : null,

        sub_brand: row.sub_brand_id
          ? { id: row.sub_brand_id, name: row.sub_brand_name }
          : null,

        flavour: row.flavour_id
          ? { id: row.flavour_id, name: row.flavour_name }
          : null,



        pack_type: row.pack_type_id
          ? { id: row.pack_type_id, name: row.pack_type_name }
          : null,
      });
    });

    res.json({
      success: true,
      data: Object.values(resultMap),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};


export const getJobsByProduction = async (req, res) => {
  try {
    const productionId = req.params.production_id;

    const [rows] = await pool.query(
      `
      SELECT
        aj.*,

        -- job
        j.id AS job_id,
        j.job_no,
        j.job_status,
        j.priority AS job_priority,
        j.pack_size,
        j.ean_barcode,
        j.project_id,
        j.pack_code,

        -- project
        p.id AS project_id,
        p.project_name,
        p.project_no,
        p.client_name,
        p.status AS project_status,
        p.priority AS project_priority,
        p.start_date,
        p.expected_completion_date,

        -- brand
        b.id AS brand_id,
        b.name AS brand_name,

        -- sub brand
        sb.id AS sub_brand_id,
        sb.name AS sub_brand_name,

        -- flavour
        f.id AS flavour_id,
        f.name AS flavour_name,

    

        -- pack type
        pt.id AS pack_type_id,
        pt.name AS pack_type_name,

        -- production user
        u.id AS production_user_id,
        u.first_name AS production_first_name,
        u.last_name AS production_last_name,
        u.email AS production_email

      FROM assign_jobs aj

      JOIN jobs j 
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))

      JOIN projects p 
        ON j.project_id = p.id

      LEFT JOIN brand_names b 
        ON j.brand_id = b.id

      LEFT JOIN sub_brands sb 
        ON j.sub_brand_id = sb.id

      LEFT JOIN flavours f 
        ON j.flavour_id = f.id

 

      LEFT JOIN pack_types pt 
        ON j.pack_type_id = pt.id

      LEFT JOIN users u 
        ON aj.production_id = u.id

      WHERE aj.production_id = ?
      AND (aj.employee_id IS NULL OR aj.employee_id = 0)
      AND aj.id IN (
        SELECT MAX(id) 
        FROM assign_jobs 
        GROUP BY project_id, job_ids
      )

      ORDER BY aj.created_at DESC
      `,
      [productionId]
    );

    // =====================================
    // Transform rows → structured objects
    // =====================================
    const resultMap = {};

    rows.forEach((row) => {
      if (!resultMap[row.id]) {
        resultMap[row.id] = {
          assign_job: {
            id: row.id,
            project_id: row.project_id,
            job_ids: row.job_ids,
            employee_id: row.employee_id,
            production_id: row.production_id,
            task_description: row.task_description,
            time_budget: row.time_budget,
            admin_status: row.admin_status,
            production_status: row.production_status,
            employee_status: row.employee_status,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },

          production_user: row.production_user_id
            ? {
              id: row.production_user_id,
              first_name: row.production_first_name,
              last_name: row.production_last_name,
              email: row.production_email,
            }
            : null,

          project: {
            id: row.project_id,
            project_no: row.project_no,
            project_name: row.project_name,
            client_name: row.client_name,
            status: row.project_status,
            priority: row.project_priority,
            start_date: row.start_date,
            expected_completion_date: row.expected_completion_date,
          },

          jobs: [],
        };
      }

      resultMap[row.id].jobs.push({
        id: row.job_id,
        job_no: row.job_no,
        job_status: row.job_status,
        priority: row.job_priority,
        pack_size: row.pack_size,
        ean_barcode: row.ean_barcode,
        pack_code: row.pack_code,

        brand: row.brand_id ? { id: row.brand_id, name: row.brand_name } : null,

        sub_brand: row.sub_brand_id
          ? { id: row.sub_brand_id, name: row.sub_brand_name }
          : null,

        flavour: row.flavour_id
          ? { id: row.flavour_id, name: row.flavour_name }
          : null,



        pack_type: row.pack_type_id
          ? { id: row.pack_type_id, name: row.pack_type_name }
          : null,
      });
    });

    res.json({
      success: true,
      data: Object.values(resultMap),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const deleteAssignJob = async (req, res) => {
  await pool.query(`DELETE FROM assign_jobs WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
};

export const getInProgressJobsByProduction = async (req, res) => {
  try {
    const productionId = req.params.production_id;

    const [rows] = await pool.query(
      `
      SELECT
        aj.id AS assign_job_id,
        j.id AS job_id,
        j.job_no,
        j.job_status AS status,
        j.priority,
        j.pack_size,
        j.pack_code,

        -- project
        p.project_name,
        p.project_no,

        -- brand hierarchy
        b.name  AS brand,
        sb.name AS sub_brand,
        f.name  AS flavour,

        -- pack
        pt.name AS pack_type,

        -- assign job
        aj.time_budget AS total_time,
        aj.employee_status,          -- ✅ added
        aj.admin_status,
        aj.production_status,

        -- assigned employee
        CONCAT(u.first_name, ' ', u.last_name) AS assigned_to

      FROM assign_jobs aj

      JOIN jobs j
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))

      JOIN projects p
        ON j.project_id = p.id

      LEFT JOIN brand_names b
        ON j.brand_id = b.id

      LEFT JOIN sub_brands sb
        ON j.sub_brand_id = sb.id

      LEFT JOIN flavours f
        ON j.flavour_id = f.id

      LEFT JOIN pack_types pt
        ON j.pack_type_id = pt.id

 

      LEFT JOIN users u
        ON aj.employee_id = u.id   -- ✅ corrected join

      WHERE 
        aj.production_id = ?
        AND aj.employee_id IS NOT NULL
        AND j.job_status = 'in_progress'
        AND aj.id IN (
          SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids
        )

      ORDER BY aj.created_at DESC
      `,
      [productionId]
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


export const getAllInProgressJobsProduction = async (req, res) => {
  try {
    // const productionId = req.params.production_id;

    const [rows] = await pool.query(
      `
      SELECT
        aj.id AS assign_job_id,
        j.id AS job_id,
        j.job_no,
        j.job_status AS status,
        j.priority,
        j.pack_size,
        j.pack_code,

        -- project
        p.project_name,
        p.project_no,

        -- brand hierarchy
        b.name  AS brand,
        sb.name AS sub_brand,
        f.name  AS flavour,

        -- pack
        pt.name AS pack_type,
      

        -- assign job
        aj.time_budget AS total_time,

        -- production user
        CONCAT(u.first_name, ' ', u.last_name) AS assigned_to

      FROM assign_jobs aj

      JOIN jobs j
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))

      JOIN projects p
        ON j.project_id = p.id

      LEFT JOIN brand_names b
        ON j.brand_id = b.id

      LEFT JOIN sub_brands sb
        ON j.sub_brand_id = sb.id

      LEFT JOIN flavours f
        ON j.flavour_id = f.id

      LEFT JOIN pack_types pt
        ON j.pack_type_id = pt.id

   

      LEFT JOIN users u
        ON aj.employee_id = u.id

      WHERE 
       
        aj.employee_id IS NOT NULL
        AND j.job_status = 'in_progress'
        AND aj.id IN (
          SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids
        )

      ORDER BY aj.created_at DESC
      `
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const getCompleteJobsByProduction = async (req, res) => {
  try {
    const productionId = req.params.production_id;

    const [rows] = await pool.query(
      `
      SELECT
        aj.id AS assign_job_id,
        j.id AS job_id,
        j.job_no,
        j.pack_code,
        j.job_status AS job_status,
        aj.employee_status,
        j.priority,
        j.pack_size,

        -- project
        p.project_name,
        p.project_no,

        -- brand hierarchy
        b.name  AS brand,
        sb.name AS sub_brand,
        f.name  AS flavour,

        -- pack
        pt.name AS pack_type,
     

        -- assign job
        aj.time_budget AS total_time,

        -- production user
        CONCAT(u.first_name, ' ', u.last_name) AS assigned_to

      FROM assign_jobs aj
      JOIN jobs j
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
      JOIN projects p
        ON j.project_id = p.id    
      LEFT JOIN brand_names b ON j.brand_id = b.id
      LEFT JOIN sub_brands sb ON j.sub_brand_id = sb.id
      LEFT JOIN flavours f ON j.flavour_id = f.id
      LEFT JOIN pack_types pt ON j.pack_type_id = pt.id
      LEFT JOIN users u ON aj.employee_id = u.id

      WHERE 
        aj.production_id = ?
        AND aj.employee_id IS NOT NULL
        AND (aj.employee_status = 'complete' OR aj.production_status = 'complete' OR j.job_status = 'complete')
        AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
        AND (aj.employee_status IS NULL OR LOWER(TRIM(aj.employee_status)) != 'return')
        AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
        AND aj.id IN (
          SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids
        )

      ORDER BY aj.created_at DESC
      `,
      [productionId]
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const getAllCompleteJobsProduction = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        aj.id AS assign_job_id,
        j.id AS job_id,
        j.job_no,
        j.pack_code,
        j.job_status AS job_status,
        aj.employee_status,
        j.priority,
        j.pack_size,
 

        -- project
        p.project_name,
        p.project_no,

        -- brand hierarchy
        b.name  AS brand,
        sb.name AS sub_brand,
        f.name  AS flavour,

        -- pack
        pt.name AS pack_type,
      

        -- assign job
        aj.time_budget AS total_time,

        -- production user
        CONCAT(u.first_name, ' ', u.last_name) AS assigned_to

      FROM assign_jobs aj
      JOIN jobs j
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
      JOIN projects p
        ON j.project_id = p.id
      LEFT JOIN brand_names b ON j.brand_id = b.id
      LEFT JOIN sub_brands sb ON j.sub_brand_id = sb.id
      LEFT JOIN flavours f ON j.flavour_id = f.id
      LEFT JOIN pack_types pt ON j.pack_type_id = pt.id
     
      LEFT JOIN users u ON aj.employee_id = u.id

      WHERE 
        aj.employee_id IS NOT NULL
        AND (aj.employee_status = 'complete' OR aj.production_status = 'complete' OR j.job_status = 'complete')
        AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
        AND (aj.employee_status IS NULL OR LOWER(TRIM(aj.employee_status)) != 'return')
        AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
        AND aj.id IN (
          SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids
        )

      ORDER BY aj.created_at DESC
      `
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};


export const getRejectJobsByProduction = async (req, res) => {
  try {
    const productionId = req.params.production_id;

    const [rows] = await pool.query(
      `
      SELECT
        aj.id AS assign_job_id,
        j.id AS job_id,
        j.job_no,
        j.job_status AS status,
        j.priority,
        j.pack_size,
        j.pack_code,

        -- project
        p.project_name,
        p.project_no,

        -- brand hierarchy
        b.name  AS brand,
        sb.name AS sub_brand,
        f.name  AS flavour,

        -- pack
        pt.name AS pack_type,
        

        -- assign job
        aj.time_budget AS total_time,

        -- production user
        CONCAT(u.first_name, ' ', u.last_name) AS assigned_to

      FROM assign_jobs aj

      JOIN jobs j
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))

      JOIN projects p
        ON j.project_id = p.id

      LEFT JOIN brand_names b
        ON j.brand_id = b.id

      LEFT JOIN sub_brands sb
        ON j.sub_brand_id = sb.id

      LEFT JOIN flavours f
        ON j.flavour_id = f.id

      LEFT JOIN pack_types pt
        ON j.pack_type_id = pt.id

      

      LEFT JOIN users u
        ON aj.employee_id = u.id

      WHERE 
        aj.production_id = ?
        AND aj.employee_id IS NOT NULL
        AND j.job_status = 'reject'

      ORDER BY aj.created_at DESC
      `,
      [productionId]
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const getAllRejectJobsProduction = async (req, res) => {
  try {
    const productionId = req.params.production_id;

    const [rows] = await pool.query(
      `
      SELECT
        aj.id AS assign_job_id,
        j.id AS job_id,
        j.job_no,
        j.job_status AS status,
        j.priority,
        j.pack_size,
        j.pack_code,

        -- project
        p.project_name,
        p.project_no,

        -- brand hierarchy
        b.name  AS brand,
        sb.name AS sub_brand,
        f.name  AS flavour,

        -- pack
        pt.name AS pack_type,
   

        -- assign job
        aj.time_budget AS total_time,

        -- production user
        CONCAT(u.first_name, ' ', u.last_name) AS assigned_to

      FROM assign_jobs aj

      JOIN jobs j
        ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))

      JOIN projects p
        ON j.project_id = p.id

      LEFT JOIN brand_names b
        ON j.brand_id = b.id

      LEFT JOIN sub_brands sb
        ON j.sub_brand_id = sb.id

      LEFT JOIN flavours f
        ON j.flavour_id = f.id

      LEFT JOIN pack_types pt
        ON j.pack_type_id = pt.id



      LEFT JOIN users u
        ON aj.employee_id = u.id

      WHERE 
        aj.production_id = ?
        AND aj.employee_id IS NOT NULL
        AND j.job_status = 'reject'

      ORDER BY aj.created_at DESC
      `,
      [productionId]
    );

    res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
