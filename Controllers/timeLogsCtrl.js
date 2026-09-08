import { pool } from "../Config/dbConnect.js";

export const createTimeLogs = async (req, res) => {
  try {
    const {
      date,
      employee_id,
      production_id,
      job_id,
      project_id,
      time,
      overtime,
    } = req.body;

    /* -------------------------------------------
       1. Get CURRENT assignment at log time
    --------------------------------------------*/
    const [[assignment]] = await pool.query(
      `
      SELECT task_description, time_budget
      FROM assign_jobs
      WHERE FIND_IN_SET(
        ?, REPLACE(REPLACE(job_ids,'[',''),']','')
      )
      AND (
        employee_id = ?
        OR production_id = ?
      )
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [job_id, employee_id, production_id]
    );

    /* -------------------------------------------
       2. Insert time log WITH SNAPSHOT
    --------------------------------------------*/
    const [result] = await pool.query(
      `
      INSERT INTO time_work_logs
      (
        date,
        employee_id,
        production_id,
        job_id,
        project_id,
        time,
        overtime,
        task_description_snapshot,
        time_budget_snapshot
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        date || null,
        employee_id,
        production_id || null,
        job_id,
        project_id,
        time || null,
        overtime || null,
        assignment?.task_description || null, // 🔒 snapshot
        assignment?.time_budget || null, // 🔒 snapshot
      ]
    );

    const [rows] = await pool.query(
      `SELECT * FROM time_work_logs WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Time log created (task snapshot saved)",
      data: rows[0],
    });
  } catch (error) {
    console.error("Create time log error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllTimeLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        twl.*,
        j.job_no AS JobID,
        p.project_name AS project_name,
        j.assigned AS assign_status,
        CONCAT(emp.first_name, ' ', emp.last_name) AS employee_name,
        CONCAT(prod.first_name, ' ', prod.last_name) AS production_name,
        SEC_TO_TIME(
          TIME_TO_SEC(IFNULL(twl.time,'00:00:00')) +
          TIME_TO_SEC(IFNULL(twl.overtime,'00:00:00'))
        ) AS total_time
      FROM time_work_logs twl
      LEFT JOIN jobs j ON twl.job_id = j.id
      LEFT JOIN projects p ON twl.project_id = p.id
      LEFT JOIN users emp ON twl.employee_id = emp.id
      LEFT JOIN users prod ON twl.production_id = prod.id
      ORDER BY twl.id DESC
    `);

    // 🔥 RESPONSE TRANSFORMATION LOGIC
    const formattedData = rows.map(row => {
      // 🔥 Priority logic (NO DUPLICATION)
      let displayName = null;

      if (row.employee_id && row.employee_name) {
        displayName = row.employee_name;
      } else if (row.production_id && row.production_name) {
        displayName = row.production_name;
      }

      return {
        id: row.id,
        date: row.date,
        employee_id: row.employee_id,
        production_id: row.production_id,
        job_id: row.job_id,
        project_id: row.project_id,
        time: row.time,
        overtime: row.overtime,
        task_description: row.task_description,
        created_at: row.created_at,
        updated_at: row.updated_at,
        JobID: row.JobID,
        project_name: row.project_name,
        assign_status: row.assign_status,
        total_time: row.total_time,
        employee_name: displayName
      };
    });

    res.json({ success: true, data: formattedData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= GET BY ID =================
export const getByIdTimeLogs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        twl.*,

        -- JobID from jobs table
        j.job_no AS JobID,

        -- Project name from projects table
        p.project_name AS project_name,

        -- Assigned info from jobs table
        j.assigned AS assign_status,

        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,

        CONCAT(prod.first_name, ' ', prod.last_name) AS production_name,

        -- Total time calculation
        SEC_TO_TIME(
          TIME_TO_SEC(IFNULL(twl.time,'00:00:00')) +
          TIME_TO_SEC(IFNULL(twl.overtime,'00:00:00'))
        ) AS total_time

      FROM time_work_logs twl
      LEFT JOIN jobs j ON twl.job_id = j.id
      LEFT JOIN projects p ON twl.project_id = p.id
      LEFT JOIN users u ON twl.employee_id = u.id
      LEFT JOIN users prod ON twl.production_id = prod.id

      WHERE twl.id = ?
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= UPDATE (SAFE UPDATE) =================
export const updateTimeLogs = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query(
      `SELECT * FROM time_work_logs WHERE id = ?`,
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Record not found",
      });
    }

    const old = existing[0];
    const {
      date,
      employee_id,
      production_id,
      job_id,
      project_id,
      time,
      overtime,
    } = req.body;

    await pool.query(
      `
      UPDATE time_work_logs
      SET
        date = ?,
        employee_id = ?,
        production_id = ?,
        job_id = ?,
        project_id = ?,
        time = ?,
        overtime = ?
      WHERE id = ?
      `,
      [
        date ?? old.date,
        employee_id ?? old.employee_id,
        production_id ?? old.production_id,
        job_id ?? old.job_id,
        project_id ?? old.project_id,
        time ?? old.time,
        overtime ?? old.overtime,
        id,
      ]
    );

    res.json({ success: true, message: "Time log updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ================= DELETE =================
export const removeTimeLogs = async (req, res) => {
  try {
    await pool.query(`DELETE FROM time_work_logs WHERE id = ?`, [
      req.params.id,
    ]);

    res.json({ success: true, message: "Time log deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTimeLogsByProduction = async (req, res) => {
  try {
    const { productionId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        twl.*,

        j.job_no AS JobID,
        p.project_name AS project_name,
        j.assigned AS assign_status,

        -- assign job data (no employee_id)
        aj.task_description,
        aj.time_budget,

        -- employee & production names
        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
        CONCAT(prod.first_name, ' ', prod.last_name) AS production_name,

        -- total time
        SEC_TO_TIME(
          TIME_TO_SEC(IFNULL(twl.time,'00:00:00')) +
          TIME_TO_SEC(IFNULL(twl.overtime,'00:00:00'))
        ) AS total_time

      FROM time_work_logs twl

      LEFT JOIN jobs j 
        ON twl.job_id = j.id

      LEFT JOIN projects p 
        ON twl.project_id = p.id

      LEFT JOIN users u 
        ON twl.employee_id = u.id

      LEFT JOIN users prod 
        ON twl.production_id = prod.id

      -- ✅ assign_jobs join WITHOUT employee_id
      LEFT JOIN assign_jobs aj 
        ON aj.project_id = twl.project_id
       AND aj.production_id = twl.production_id
       AND JSON_CONTAINS(aj.job_ids, JSON_ARRAY(twl.job_id))

      WHERE twl.production_id = ?

      ORDER BY twl.date DESC, twl.id DESC
      `,
      [productionId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getTimeLogsByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        twl.*,

        j.job_no AS JobID,
        p.project_name AS project_name,
        j.assigned AS assign_status,

        -- assign job data
        aj.task_description,
        aj.time_budget,

        -- employee & production
        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
        CONCAT(prod.first_name, ' ', prod.last_name) AS production_name,

        -- total time
        SEC_TO_TIME(
          TIME_TO_SEC(IFNULL(twl.time,'00:00:00')) +
          TIME_TO_SEC(IFNULL(twl.overtime,'00:00:00'))
        ) AS total_time

      FROM time_work_logs twl

      LEFT JOIN jobs j 
        ON twl.job_id = j.id

      LEFT JOIN projects p 
        ON twl.project_id = p.id

      LEFT JOIN users u 
        ON twl.employee_id = u.id

      LEFT JOIN users prod 
        ON twl.production_id = prod.id

      -- ✅ FIXED assign_jobs join
      LEFT JOIN assign_jobs aj 
        ON aj.project_id = twl.project_id
       AND aj.employee_id = twl.employee_id
       AND aj.production_id = twl.production_id
       AND JSON_CONTAINS(aj.job_ids, JSON_ARRAY(twl.job_id))

      WHERE twl.employee_id = ?

      ORDER BY twl.date DESC, twl.id DESC
      `,
      [employeeId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const getTimeLogsAllEmployee = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        twl.*,

        j.job_no AS JobID,
        p.project_name AS project_name,
        j.assigned AS assign_status,

        -- assign job data
        aj.task_description,
        aj.time_budget,

        -- employee & production
        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
        CONCAT(prod.first_name, ' ', prod.last_name) AS production_name,

        -- total time
        SEC_TO_TIME(
          TIME_TO_SEC(IFNULL(twl.time,'00:00:00')) +
          TIME_TO_SEC(IFNULL(twl.overtime,'00:00:00'))
        ) AS total_time

      FROM time_work_logs twl

      LEFT JOIN jobs j 
        ON twl.job_id = j.id

      LEFT JOIN projects p 
        ON twl.project_id = p.id

      LEFT JOIN users u 
        ON twl.employee_id = u.id

      LEFT JOIN users prod 
        ON twl.production_id = prod.id

      -- ✅ FIXED assign_jobs join
      LEFT JOIN assign_jobs aj 
        ON aj.project_id = twl.project_id
       AND aj.employee_id = twl.employee_id
       AND aj.production_id = twl.production_id
       AND JSON_CONTAINS(aj.job_ids, JSON_ARRAY(twl.job_id))

      -- only employees
      WHERE u.role_name = 'employee'

      ORDER BY twl.date DESC, twl.id DESC
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllTimeLogsEmployeeWithTask = async (req, res) => {
  try {
    const employeeId = req.params[0] || null;
    const jobId = req.params[1];

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "job_id is required",
      });
    }

    let userRole = "admin";

    if (employeeId) {
      const [[user]] = await pool.query(
        `SELECT id, role_name FROM users WHERE id = ?`,
        [employeeId]
      );
      if (user?.role_name) userRole = user.role_name;
    }

    let whereClause = `WHERE twl.job_id = ?`;
    const params = [jobId];

    if (employeeId && userRole === "employee") {
      whereClause += ` AND twl.employee_id = ?`;
      params.push(employeeId);
    }

    if (employeeId && userRole === "production") {
      whereClause += ` AND twl.production_id = ?`;
      params.push(employeeId);
    }

    const [rows] = await pool.query(
      `
      SELECT 
        twl.*,

        j.job_no AS JobID,
        j.assigned AS assign_status,

        COALESCE(
          twl.task_description_snapshot,
          aj.task_description
        ) AS task_description,

        aj.created_at AS task_created_at,
        
        COALESCE(
          twl.time_budget_snapshot,
          aj.time_budget
        ) AS time_budget,

        p.project_name,

        CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
        CONCAT(prod.first_name, ' ', prod.last_name) AS production_name,

        SEC_TO_TIME(
          TIME_TO_SEC(IFNULL(twl.time,'00:00:00')) +
          TIME_TO_SEC(IFNULL(twl.overtime,'00:00:00'))
        ) AS total_time

      FROM time_work_logs twl
      LEFT JOIN jobs j ON twl.job_id = j.id
      LEFT JOIN projects p ON twl.project_id = p.id
      LEFT JOIN users u ON twl.employee_id = u.id
      LEFT JOIN users prod ON twl.production_id = prod.id

      LEFT JOIN assign_jobs aj
        ON aj.id = (
          SELECT aj2.id
          FROM assign_jobs aj2
          WHERE FIND_IN_SET(
            j.id,
            REPLACE(REPLACE(aj2.job_ids,'[',''),']','')
          )
          AND (
            aj2.employee_id = twl.employee_id
            OR aj2.production_id = twl.production_id
          )
          AND aj2.created_at <= twl.created_at
          ORDER BY aj2.created_at DESC
          LIMIT 1
        )

      ${whereClause}
      ORDER BY twl.date DESC, twl.id DESC
      `,
      params
    );

    /* ----------------------------------------------------
       🔥 FETCH LATEST ASSIGNMENT (PENDING CHECK)
    ---------------------------------------------------- */
    let latestAssignment = null;
    if (employeeId) {
      // Logic: Find the ABSOLUTE LATEST assignment for this user/job
      const [[assign]] = await pool.query(
        `
        SELECT 
          aj.*,
          CONCAT(u.first_name, ' ', u.last_name) AS user_name,
          CONCAT(emp.first_name, ' ', emp.last_name) AS assigned_employee_name
        FROM assign_jobs aj
        LEFT JOIN users u ON u.id = ?
        LEFT JOIN users emp ON emp.id = aj.employee_id
        WHERE FIND_IN_SET(
          ?, REPLACE(REPLACE(aj.job_ids, '[', ''), ']', '')
        )
        AND (
          aj.employee_id = ? OR aj.production_id = ?
        )
        ORDER BY aj.created_at DESC
        LIMIT 1
        `,
        [employeeId, jobId, employeeId, employeeId]
      );
      latestAssignment = assign;
    }

    // 🔥 INJECT PENDING LOG IF NEEDED
    let injectedRows = [...rows];

    if (latestAssignment) {
      // Check if we already have a log that matches the CONTENT of this assignment
      // Since assignments might be UPDATED in place (keeping same created_at),
      // we must check if the current task_description has been logged.

      const isAssignmentLogged = rows.some(row => {
        // We check if the snapshot description in the log matches the current assignment 
        return row.task_description_snapshot === latestAssignment.task_description;
      });

      // If NO log exists with this specific description, inject it as a "Pending Instruction"
      if (!isAssignmentLogged) {
        // Construct virtual log
        const virtualLog = {
          id: `pending_${latestAssignment.id}_${Date.now()}`, // unique ID for frontend key
          date: latestAssignment.created_at, // Use assignment date
          task_description: latestAssignment.task_description, // The NEW description
          time_budget: latestAssignment.time_budget,

          employee_name: latestAssignment.assigned_employee_name || latestAssignment.user_name || "Unknown",
          production_name: latestAssignment.user_name || "Unknown",

          time: "00:00:00",
          overtime: "00:00:00",
          total_time: "00:00:00",

          is_pending: true,
          JobID: null,
          assigned_employee_name: latestAssignment.assigned_employee_name, // Explicitly pass for frontend check
          assign_status: "assigned"
        };

        injectedRows.unshift(virtualLog);
      }
    }

    // 🔥 OVERRIDE LOG DATE WITH ASSIGNMENT DATE (User request: show assignment date instead of log date)
    const formattedInjectedRows = injectedRows.map(row => ({
      ...row,
      date: row.task_created_at || row.date
    }));

    /* ----------------------------------------------------
       RESPONSE MAPPING
    ---------------------------------------------------- */

    if (userRole === "production" || userRole === "employee") {
      // Use latestAssignment for metadata if available, else fallback to rows
      const metaSource = latestAssignment || formattedInjectedRows[0] || {};

      const userObj = {
        [userRole === "production" ? "production_id" : "employee_id"]: employeeId,
        [userRole === "production" ? "production_name" : "employee_name"]: metaSource.user_name || metaSource.production_name || metaSource.employee_name,
        assigned_employee_name: metaSource.assigned_employee_name || null,
        time_budget: metaSource.time_budget || "00:00:00",
        task_description: metaSource.task_description || null,
        created_at: metaSource.created_at || null
      };

      return res.json({
        success: true,
        [userRole]: userObj,
        logs: formattedInjectedRows
      });
    }

    // ADMIN VIEW (Grouping)
    if (!employeeId || userRole === "admin") {

      // 1. Fetch ALL active assignments for this job to check for pending items
      const [allAssignments] = await pool.query(
        `
        SELECT 
          aj.*,
          CONCAT(u.first_name, ' ', u.last_name) AS user_name,
          CONCAT(prod.first_name, ' ', prod.last_name) AS production_user_name
        FROM assign_jobs aj
        LEFT JOIN users u ON u.id = aj.employee_id
        LEFT JOIN users prod ON prod.id = aj.production_id
        WHERE FIND_IN_SET(
          ?, REPLACE(REPLACE(aj.job_ids, '[', ''), ']', '')
        )
        -- We want the latest assignment per user/production
        ORDER BY aj.created_at DESC
        `,
        [jobId]
      );

      // Filter to get unique latest assignment per assignee (production/employee)
      const latestAssignmentsMap = {};
      allAssignments.forEach(assign => {
        const key = assign.employee_id ? `emp_${assign.employee_id}` : `prod_${assign.production_id}`;
        if (!latestAssignmentsMap[key]) {
          latestAssignmentsMap[key] = assign;
        }
      });

      // Inject pending logs into the injectedRows array
      Object.values(latestAssignmentsMap).forEach(latestAssign => {
        const isLogged = injectedRows.some(row => {
          // Match assignee
          const sameAssignee = (latestAssign.employee_id && row.employee_id === latestAssign.employee_id) ||
            (latestAssign.production_id && row.production_id === latestAssign.production_id);
          if (!sameAssignee) return false;

          // Match content
          return row.task_description_snapshot === latestAssign.task_description;
        });

        if (!isLogged) {
          const assigneeName = latestAssign.employee_id ? latestAssign.user_name : latestAssign.production_user_name;
          const virtualLog = {
            id: `pending_${latestAssign.id}_${Date.now()}_${Math.random()}`,
            date: latestAssign.created_at,
            task_description: latestAssign.task_description,
            time_budget: latestAssign.time_budget,

            employee_name: latestAssign.employee_id ? assigneeName : null,
            production_name: latestAssign.production_id ? assigneeName : null,

            employee_id: latestAssign.employee_id,
            production_id: latestAssign.production_id,

            time: "00:00:00",
            overtime: "00:00:00",
            total_time: "00:00:00",

            is_pending: true,
            JobID: null,
            assign_status: "assigned",
            task_created_at: latestAssign.created_at // important for date override
          };
          injectedRows.unshift(virtualLog);
        }
      });

      // 🔥 APPLY DATE OVERRIDE (Assignment Date instead of Log Date)
      const formattedInjectedRows = injectedRows.map(row => ({
        ...row,
        date: row.task_created_at || row.date
      }));

      // Grouping logic
      const productionsMap = {};

      formattedInjectedRows.forEach((row) => {
        const prodId = row.production_id || `emp_direct_${row.employee_id}` || "unassigned";

        if (!productionsMap[prodId]) {
          productionsMap[prodId] = {
            production_id: row.production_id,
            production_name: row.production_name || row.employee_name, // Fallback name
            time_budget: row.time_budget || "00:00:00",
            task_description: row.task_description || null,
            created_at: row.task_created_at || null, // renamed for frontend consistency
            logs: [],
          };
        }
        productionsMap[prodId].logs.push(row);
      });

      return res.json({
        success: true,
        job_id: jobId,
        job_no: rows[0]?.JobID || null,
        productions: Object.values(productionsMap),
      });
    }

    return res.json({ success: true, data: formattedInjectedRows });

  } catch (error) {
    console.error("Time log error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
