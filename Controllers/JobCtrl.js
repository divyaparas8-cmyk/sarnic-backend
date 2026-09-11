import { pool } from "../Config/dbConnect.js";
import { getNextNumber } from "./NumberSequenceCtrl.js";

export const createJob = async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== "admin" && userRole !== "production" && userRole !== "employee") {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }

    const {
      project_id,
      project_name,
      priority,
      brand_id,
      sub_brand_id,
      flavour_id,
      pack_type_id,
      pack_code,
      pack_size,
      ean_barcode,
    } = req.body;

    if (!project_id) {
      return res.status(400).json({ message: "project_id is required" });
    }

    // Check unique pack_code
    if (pack_code && String(pack_code).trim() !== '') {
      const [existingPack] = await pool.query(
        "SELECT id FROM jobs WHERE pack_code = ?",
        [String(pack_code).trim()]
      );
      if (existingPack.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Pack Code already exists. Please enter a unique Pack Code."
        });
      }
    }

    // 1️⃣ Get project details
    const [[project]] = await pool.query(
      "SELECT project_no, project_name FROM projects WHERE id = ?",
      [project_id]
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const finalProjectName = project_name || project.project_name;

    // 2️⃣ Generate job_no
    const nextJobNo = await getNextNumber("job_no");

    const companyId = req.tenant_id || req.user?.companyId || req.user?.tenant_id || null;

    // 3️⃣ Insert job (job_status = Active)
    const [result] = await pool.query(
      `INSERT INTO jobs (
        job_no,
        project_id,
        project_name,
        priority,
        job_status,
        company_id,
        brand_id,
        sub_brand_id,
        flavour_id,
        pack_type_id,
        pack_code,
        pack_size,
        ean_barcode
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        nextJobNo,
        project_id,
        finalProjectName,
        priority ? priority.toLowerCase() : "medium",
        "Active",
        companyId,
        brand_id || null,
        sub_brand_id || null,
        flavour_id || null,
        pack_type_id || null,
        pack_code || null,
        pack_size || null,
        ean_barcode || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Job created successfully",
      job_id: result.insertId,
      job_no: nextJobNo,
      project_no: project.project_no,
      project_name: finalProjectName,
      job_status: "Active",
    });
  } catch (error) {
    console.error("Create Job Error:", error);
    res.status(500).json({ message: error.message });
  }
};


export const getAllJobs = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        j.*,
        p.project_no,
        p.project_name AS main_project_name,
        p.client_name AS client_name,
        b.name AS brand_name,
        sb.name AS sub_brand_name,
        f.name AS flavour_name,
        pt.name AS pack_type_name,

        -- total time per job (HH:MM, supports >24h)
        CONCAT(
          FLOOR(
            (
              COALESCE(SUM(TIME_TO_SEC(twl.time)), 0) +
              COALESCE(SUM(TIME_TO_SEC(twl.overtime)), 0)
            ) / 3600
          ),
          ':',
          LPAD(
            FLOOR(
              (
                COALESCE(SUM(TIME_TO_SEC(twl.time)), 0) +
                COALESCE(SUM(TIME_TO_SEC(twl.overtime)), 0)
              ) % 3600 / 60
            ),
            2,
            '0'
          )
        ) AS total_time

      FROM jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      LEFT JOIN brand_names b ON j.brand_id = b.id
      LEFT JOIN sub_brands sb ON j.sub_brand_id = sb.id
      LEFT JOIN flavours f ON j.flavour_id = f.id
      LEFT JOIN pack_types pt ON j.pack_type_id = pt.id
      LEFT JOIN time_work_logs twl ON twl.job_id = j.id

      GROUP BY j.id
      ORDER BY j.id DESC
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Get Jobs Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[job]] = await pool.query(
      `
      SELECT
        j.*,
        p.project_no,
        p.project_name AS main_project_name,
        p.client_name AS client_name,
        b.name AS brand_name,
        sb.name AS sub_brand_name,
        f.name AS flavour_name,
        pt.name AS pack_type_name
      FROM jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      LEFT JOIN brand_names b ON j.brand_id = b.id
      LEFT JOIN sub_brands sb ON j.sub_brand_id = sb.id
      LEFT JOIN flavours f ON j.flavour_id = f.id
      LEFT JOIN pack_types pt ON j.pack_type_id = pt.id

      WHERE j.id = ?
    `,
      [id]
    );

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    const [[timeResult]] = await pool.query(
      `
      SELECT
        DATE_FORMAT(
          SEC_TO_TIME(
            COALESCE(SUM(TIME_TO_SEC(time)), 0) +
            COALESCE(SUM(TIME_TO_SEC(overtime)), 0)
          ),
          '%H:%i'
        ) AS total_time
      FROM time_work_logs
      WHERE job_id = ?
    `,
      [id]
    );

    job.total_time = timeResult.total_time || "00:00";

    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// export const getJobsByProjectId = async (req, res) => {
//   try {
//     const { projectId } = req.params;

//     const [rows] = await pool.query(
//       `
//       SELECT
//         j.*,
//         p.project_no,
//         p.project_name AS main_project_name,
//         b.name AS brand_name,
//         sb.name AS sub_brand_name,
//         f.name AS flavour_name,
//         pt.name AS pack_type_name,

//         MAX(aj.id) AS assign_id,
//         MAX(aj.production_status) AS production_status,
//         MAX(aj.admin_status) AS admin_status,
//         MAX(aj.employee_status) AS employee_status,

//         MAX(pu.id) AS assigned_user_id,

//         -- assigned name (production override)
//         CASE
//           WHEN MAX(aj.production_id) IS NOT NULL
//             THEN CONCAT(MAX(prod.first_name), ' ', MAX(prod.last_name))
//           ELSE CONCAT(MAX(pu.first_name), ' ', MAX(pu.last_name))
//         END AS assigned_name,

//         -- ✅ TOTAL TIME PER JOB (HH:MM, supports >24h)
//         CONCAT(
//           FLOOR(
//             (
//               COALESCE(SUM(TIME_TO_SEC(twl.time)), 0) +
//               COALESCE(SUM(TIME_TO_SEC(twl.overtime)), 0)
//             ) / 3600
//           ),
//           ':',
//           LPAD(
//             FLOOR(
//               (
//                 COALESCE(SUM(TIME_TO_SEC(twl.time)), 0) +
//                 COALESCE(SUM(TIME_TO_SEC(twl.overtime)), 0)
//               ) % 3600 / 60
//             ),
//             2,
//             '0'
//           )
//         ) AS total_time

//       FROM jobs j
//       LEFT JOIN projects p ON j.project_id = p.id
//       LEFT JOIN brand_names b ON j.brand_id = b.id
//       LEFT JOIN sub_brands sb ON j.sub_brand_id = sb.id
//       LEFT JOIN flavours f ON j.flavour_id = f.id
//       LEFT JOIN pack_types pt ON j.pack_type_id = pt.id


//       LEFT JOIN assign_jobs aj
//         ON aj.id = (
//           SELECT aj2.id
//           FROM assign_jobs aj2
//           WHERE JSON_CONTAINS(aj2.job_ids, JSON_ARRAY(j.id))
//             AND aj2.project_id = j.project_id
//           ORDER BY aj2.created_at DESC
//           LIMIT 1
//         )

//       LEFT JOIN users pu ON pu.id = j.assigned
//       LEFT JOIN users prod ON prod.id = aj.production_id

//       -- 🆕 join time logs
//       LEFT JOIN time_work_logs twl ON twl.job_id = j.id

//       WHERE j.project_id = ?
//       GROUP BY j.id
//       ORDER BY j.id DESC
//       `,
//       [projectId]
//     );

//     res.json({ success: true, data: rows });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

export const getJobsByProjectId = async (req, res) => {
  try {
    const { projectId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        j.*,
        p.project_no,
        p.project_name AS main_project_name,
        b.name AS brand_name,
        sb.name AS sub_brand_name,
        f.name AS flavour_name,
        pt.name AS pack_type_name,

        MAX(aj.id) AS assign_id,
        MAX(aj.production_status) AS production_status,
        MAX(aj.admin_status) AS admin_status,
        MAX(aj.employee_status) AS employee_status,

        MAX(pu.id) AS assigned_user_id,

        -- ✅ ASSIGNED NAME (ONLY FROM jobs.assigned)
        CASE
  WHEN j.assigned IS NULL
       OR j.assigned = ''
       OR j.assigned = 'Unassigned'
    THEN 'Unassigned'
  ELSE CONCAT(pu.first_name, ' ', pu.last_name)
END AS assigned_name,

        -- ✅ TOTAL TIME PER JOB (HH:MM, supports >24h)
        CONCAT(
          FLOOR(
            (
              COALESCE(SUM(TIME_TO_SEC(twl.time)), 0) +
              COALESCE(SUM(TIME_TO_SEC(twl.overtime)), 0)
            ) / 3600
          ),
          ':',
          LPAD(
            FLOOR(
              (
                COALESCE(SUM(TIME_TO_SEC(twl.time)), 0) +
                COALESCE(SUM(TIME_TO_SEC(twl.overtime)), 0)
              ) % 3600 / 60
            ),
            2,
            '0'
          )
        ) AS total_time

      FROM jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      LEFT JOIN brand_names b ON j.brand_id = b.id
      LEFT JOIN sub_brands sb ON j.sub_brand_id = sb.id
      LEFT JOIN flavours f ON j.flavour_id = f.id
      LEFT JOIN pack_types pt ON j.pack_type_id = pt.id

      LEFT JOIN assign_jobs aj
        ON aj.id = (
          SELECT aj2.id
          FROM assign_jobs aj2
          WHERE JSON_CONTAINS(aj2.job_ids, JSON_ARRAY(j.id))
            AND aj2.project_id = j.project_id
          ORDER BY aj2.created_at DESC
          LIMIT 1
        )

      LEFT JOIN users pu ON pu.id = j.assigned
      LEFT JOIN time_work_logs twl ON twl.job_id = j.id

      WHERE j.project_id = ?
      GROUP BY j.id
      ORDER BY j.id DESC
      `,
      [projectId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateJob = async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== "admin" && userRole !== "production" && userRole !== "employee") {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }

    const { id } = req.params;

    const {
      priority,
      job_status,
      brand_id,
      sub_brand_id,
      flavour_id,
      pack_type_id,
      pack_code,
      pack_size,
      ean_barcode
    } = req.body;

    if (pack_code && String(pack_code).trim() !== '') {
      const [existingPack] = await pool.query(
        "SELECT id FROM jobs WHERE pack_code = ? AND id != ?",
        [String(pack_code).trim(), id]
      );
      if (existingPack.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Pack Code already exists. Please enter a unique Pack Code."
        });
      }
    }

    await pool.query(
      `UPDATE jobs SET
        priority = COALESCE(?, priority),
        job_status = COALESCE(?, job_status),
        brand_id = COALESCE(?, brand_id),
        sub_brand_id = COALESCE(?, sub_brand_id),
        flavour_id = COALESCE(?, flavour_id),
        pack_type_id = COALESCE(?, pack_type_id),
        pack_code = COALESCE(?, pack_code),
        pack_size = COALESCE(?, pack_size),
        ean_barcode = COALESCE(?, ean_barcode)
      WHERE id = ?`,
      [
        priority ? priority.toLowerCase() : null,
        job_status || null,
        brand_id || null,
        sub_brand_id || null,
        flavour_id || null,
        pack_type_id || null,
        pack_code || null,
        pack_size || null,
        ean_barcode || null,
        id,
      ]
    );

    res.json({ success: true, message: "Job updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const deleteJob = async (req, res) => {
  const userRole = req.user?.role;
  if (userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
  }

  const connection = await pool.getConnection();

  try {
    const { id } = req.params;
    const jobId = Number(id);
    console.log("Deleting Job ID:", jobId);

    await connection.beginTransaction();

    // 1️⃣ Delete time logs for this job
    await connection.query("DELETE FROM time_work_logs WHERE job_id = ?", [
      jobId,
    ]);

    // 2️⃣ Fetch assign_jobs that contain this job_id
    const [assignJobs] = await connection.query(
      `
      SELECT id, job_ids
      FROM assign_jobs
      WHERE FIND_IN_SET(
        ?,
        REPLACE(REPLACE(job_ids, '[', ''), ']', '')
      )
      `,
      [jobId]
    );

    // 3️⃣ Update or delete assign_jobs rows
    for (const row of assignJobs) {
      // Convert "[17,16]" → [17,16]
      const jobIdsArray = row.job_ids
        .replace("[", "")
        .replace("]", "")
        .split(",")
        .map(Number)
        .filter((jid) => jid !== jobId);

      if (jobIdsArray.length === 0) {
        await connection.query("DELETE FROM assign_jobs WHERE id = ?", [
          row.id,
        ]);
      } else {
        await connection.query(
          "UPDATE assign_jobs SET job_ids = ? WHERE id = ?",
          [`[${jobIdsArray.join(",")}]`, row.id]
        );
      }
    }

    const [jobDeleteResult] = await connection.query(
      "DELETE FROM jobs WHERE id = ?",
      [jobId]
    );

    if (jobDeleteResult.affectedRows === 0) {
      throw new Error("Job not found or already deleted");
    }

    await connection.commit();

    res.json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (error) {
    await connection.rollback();
    console.error("Delete Job Error:", error);
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
};


export const getJobHistoryByProductionId = async (req, res) => {
  try {
    const { productionId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        j.id                                     AS jobId,
        j.job_no                                 AS jobNo,
        p.project_name                          AS projectName,
        b.name                                  AS brand,
        sb.name                                 AS subBrand,
        f.name                                  AS flavour,
        pt.name                                 AS packType,
        j.pack_size                             AS packSize,
        COALESCE(j.pack_code, pc.name, '-')     AS packCode,
        j.priority                              AS priority,
        p.expected_completion_date              AS dueDate,

        COALESCE(
          CONCAT(emp.first_name, ' ', emp.last_name),
          CONCAT(prod.first_name, ' ', prod.last_name),
          'Unassigned'
        )                                       AS assignedTo,

        aj.time_budget                          AS totalTime,
        aj.production_status                    AS status
        
      FROM assign_jobs aj

      LEFT JOIN jobs j
        ON FIND_IN_SET(j.id, REPLACE(REPLACE(aj.job_ids,'[',''),']',''))

      LEFT JOIN projects p       ON p.id = aj.project_id
      LEFT JOIN brand_names b    ON j.brand_id = b.id
      LEFT JOIN sub_brands sb    ON j.sub_brand_id = sb.id
      LEFT JOIN flavours f       ON j.flavour_id = f.id
      LEFT JOIN pack_types pt    ON j.pack_type_id = pt.id
      LEFT JOIN pack_codes pc    ON j.pack_code_id = pc.id

      -- 🔥 BOTH JOINS
      LEFT JOIN users emp  ON emp.id  = aj.employee_id
      LEFT JOIN users prod ON prod.id = aj.production_id

      WHERE aj.production_id = ?
      ORDER BY p.expected_completion_date ASC
    `,
      [productionId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch job history" });
  }
};

export const getJobHistoryByEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        j.id,
        j.job_no                                 AS jobNo,
        p.project_name                          AS projectName,
        b.name                                  AS brand,
        sb.name                                 AS subBrand,
        f.name                                  AS flavour,
        pt.name                                 AS packType,
        j.pack_size                             AS packSize,
        COALESCE(j.pack_code, pc.name, '-')     AS packCode,
        j.priority                              AS priority,
        p.expected_completion_date              AS dueDate,

        CONCAT(pu.first_name, ' ', pu.last_name) AS assignedTo,
        aj.time_budget                          AS totalTime,
        aj.employee_status                      AS status

      FROM assign_jobs aj

      LEFT JOIN jobs j
        ON FIND_IN_SET(j.id, REPLACE(REPLACE(aj.job_ids,'[',''),']',''))

      LEFT JOIN projects p       ON p.id = aj.project_id
      LEFT JOIN brand_names b    ON j.brand_id = b.id
      LEFT JOIN sub_brands sb    ON j.sub_brand_id = sb.id
      LEFT JOIN flavours f       ON j.flavour_id = f.id
      LEFT JOIN pack_types pt    ON j.pack_type_id = pt.id
      LEFT JOIN pack_codes pc    ON j.pack_code_id = pc.id

      LEFT JOIN users pu         ON pu.id = aj.production_id

      WHERE aj.employee_id = ?
      ORDER BY p.expected_completion_date ASC
    `,
      [employeeId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee job history",
    });
  }
};

export const getJobByJobNoForIllustrator = async (req, res) => {
  try {
    const { jobNo } = req.params;
    const tenant_id = req.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({ success: false, message: "Tenant context missing" });
    }

    const [[job]] = await pool.query(
      `SELECT 
        p.project_no AS Project_ID,
        p.client_name AS Client_Name,
        j.project_name AS Project_Name,
        j.job_no AS Job_ID,
        DATE_FORMAT(j.created_at, '%d-%m-%Y') AS Date,
        b.name AS Brand_Name,
        sb.name AS Sub_Brand,
        pt.name AS Pack_Type,
        j.pack_size AS Pack_Size,
        f.name AS Flavour_Name,
        j.pack_code AS Pack_Code,
        j.priority AS Priority,
        j.job_status AS Status,
        j.ean_barcode AS EAN_Barcode,
        COALESCE(emp.first_name, u.first_name) AS designer_first_name,
        COALESCE(emp.last_name, u.last_name) AS designer_last_name
       FROM jobs j
       LEFT JOIN projects p ON j.project_id = p.id
       LEFT JOIN brand_names b ON j.brand_id = b.id
       LEFT JOIN sub_brands sb ON j.sub_brand_id = sb.id
       LEFT JOIN flavours f ON j.flavour_id = f.id
       LEFT JOIN pack_types pt ON j.pack_type_id = pt.id
       LEFT JOIN assign_jobs aj ON aj.id = (
         SELECT aj2.id
         FROM assign_jobs aj2
         WHERE JSON_CONTAINS(aj2.job_ids, JSON_ARRAY(j.id))
         ORDER BY aj2.created_at DESC, aj2.id DESC
         LIMIT 1
       )
       LEFT JOIN users emp ON emp.id = aj.employee_id
       LEFT JOIN users u ON u.id = j.assigned AND u.role_name = 'employee'
       WHERE j.job_no = ? AND (j.company_id = ? OR j.company_id IS NULL)`,
      [jobNo, tenant_id]
    );

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const fullName = `${job.designer_first_name || ""} ${job.designer_last_name || ""}`.trim();
    const designerInitials = fullName
      ? fullName
          .split(/\s+/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase())
          .join("")
      : null;

    const { designer_first_name, designer_last_name, ...jobData } = job;
    jobData.Designer = designerInitials;

    res.json({ success: true, data: jobData });
  } catch (error) {
    console.error("Illustrator Job API Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const importJobsCSV = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { projectId } = req.params;
    const { jobs } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, message: "project_id is required" });
    }

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ success: false, message: "No jobs data provided" });
    }

    // 1️⃣ Get project details
    const [[project]] = await pool.query(
      "SELECT project_no, project_name FROM projects WHERE id = ?",
      [projectId]
    );

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const companyId = req.tenant_id || req.user?.companyId || req.user?.tenant_id || null;

    await connection.beginTransaction();

    const insertedJobs = [];

    for (const job of jobs) {
      const {
        brand_name,
        sub_brand_name,
        flavour_name,
        pack_type_name,
        pack_code,
        pack_size,
        ean_barcode,
        priority
      } = job;

      // Validate mandatory fields (ean_barcode is optional)
      if (!brand_name || !sub_brand_name || !flavour_name || !pack_type_name || !pack_code || !pack_size || !priority) {
        throw new Error("Missing mandatory fields in one of the rows.");
      }

      // Barcode validation: optional, but if provided must be digits-only and maximum 14 digits
      let strBarcode = null;
      if (ean_barcode !== undefined && ean_barcode !== null && String(ean_barcode).trim() !== '') {
        strBarcode = String(ean_barcode).trim();
        if (!/^\d+$/.test(strBarcode)) {
          throw new Error(`EAN Barcode must contain only digits: ${strBarcode}`);
        }
        if (strBarcode.length > 14) {
          throw new Error(`EAN Barcode must be up to 14 digits (got ${strBarcode.length}): ${strBarcode}`);
        }
      }

      const cleanPriority = String(priority).trim().toLowerCase();
      if (cleanPriority !== "high" && cleanPriority !== "medium" && cleanPriority !== "low") {
        throw new Error(`Invalid priority value: ${priority}`);
      }

      // Lookup or Create Brand
      let [[brand]] = await connection.query("SELECT id FROM brand_names WHERE name = ?", [brand_name]);
      let brandId;
      if (!brand) {
        const [insertRes] = await connection.query("INSERT INTO brand_names (name) VALUES (?)", [brand_name]);
        brandId = insertRes.insertId;
      } else {
        brandId = brand.id;
      }

      // Lookup or Create Sub Brand
      let [[subBrand]] = await connection.query("SELECT id FROM sub_brands WHERE name = ?", [sub_brand_name]);
      let subBrandId;
      if (!subBrand) {
        const [insertRes] = await connection.query("INSERT INTO sub_brands (name) VALUES (?)", [sub_brand_name]);
        subBrandId = insertRes.insertId;
      } else {
        subBrandId = subBrand.id;
      }

      // Lookup or Create Flavour
      let [[flavour]] = await connection.query("SELECT id FROM flavours WHERE name = ?", [flavour_name]);
      let flavourId;
      if (!flavour) {
        const [insertRes] = await connection.query("INSERT INTO flavours (name) VALUES (?)", [flavour_name]);
        flavourId = insertRes.insertId;
      } else {
        flavourId = flavour.id;
      }

      // Lookup or Create Pack Type
      let [[packType]] = await connection.query("SELECT id FROM pack_types WHERE name = ?", [pack_type_name]);
      let packTypeId;
      if (!packType) {
        const [insertRes] = await connection.query("INSERT INTO pack_types (name) VALUES (?)", [pack_type_name]);
        packTypeId = insertRes.insertId;
      } else {
        packTypeId = packType.id;
      }

      // Generate job_no
      const nextJobNo = await getNextNumber("job_no");

      // Insert job
      const [insertJobRes] = await connection.query(
        `INSERT INTO jobs (
          job_no, project_id, project_name, priority, job_status, company_id,
          brand_id, sub_brand_id, flavour_id, pack_type_id, pack_code, pack_size, ean_barcode
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          nextJobNo,
          projectId,
          project.project_name,
          cleanPriority,
          "Active",
          companyId,
          brandId,
          subBrandId,
          flavourId,
          packTypeId,
          pack_code,
          pack_size,
          strBarcode || null
        ]
      );

      insertedJobs.push({
        id: insertJobRes.insertId,
        job_no: nextJobNo
      });
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: `${insertedJobs.length} jobs imported successfully.`,
      jobs: insertedJobs
    });
  } catch (error) {
    await connection.rollback();
    console.error("CSV Import Error:", error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};
