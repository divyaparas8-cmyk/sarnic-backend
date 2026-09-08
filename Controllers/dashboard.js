import { pool } from "../Config/dbConnect.js";

export const getProductionDashboard = async (req, res) => {
  try {
    const { productionId } = req.params;

    if (!productionId) {
      return res.status(400).json({
        success: false,
        message: "productionId is required"
      });
    }

    /* ================= TOP CARDS ================= */
    const [[topCards]] = await pool.query(`
      SELECT
        -- Jobs In Progress (Assigned to Designer/Employee and not completed)
        (SELECT COUNT(DISTINCT j.id) 
         FROM assign_jobs aj 
         JOIN jobs j ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
         WHERE aj.production_id = ? 
           AND (aj.employee_id IS NOT NULL AND aj.employee_id != 0)
           AND NOT (aj.employee_status = 'complete' OR aj.production_status = 'complete' OR j.job_status = 'complete' OR j.job_status = 'Completed')
           AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
           AND (aj.employee_status IS NULL OR LOWER(TRIM(aj.employee_status)) != 'return')
           AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
           AND aj.id IN (SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids)) AS inProgressJobs,

        -- Active Jobs
        (SELECT COUNT(DISTINCT j.id) 
         FROM assign_jobs aj 
         JOIN jobs j ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
         WHERE aj.production_id = ? 
           AND (j.job_status = 'Active' OR aj.production_status = 'Active')
           AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
           AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
           AND aj.id IN (SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids)) AS activeJobs,

        -- Completed Jobs
        (SELECT COUNT(DISTINCT j.id) 
         FROM assign_jobs aj 
         JOIN jobs j ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
         WHERE aj.production_id = ? 
           AND (aj.employee_status = 'complete' OR aj.production_status = 'complete' OR j.job_status = 'complete' OR j.job_status = 'Completed')
           AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
           AND (aj.employee_status IS NULL OR LOWER(TRIM(aj.employee_status)) != 'return')
           AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
           AND aj.id IN (SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids)) AS completedJobs,

        -- Pending Assignment (assigned to production, but not yet to any employee/designer and not completed)
        (SELECT COUNT(DISTINCT j.id) 
         FROM assign_jobs aj 
         JOIN jobs j ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
         WHERE aj.production_id = ? 
           AND (aj.employee_id IS NULL OR aj.employee_id = 0)
           AND NOT (aj.employee_status = 'complete' OR aj.production_status = 'complete' OR j.job_status = 'complete' OR j.job_status = 'Completed')
           AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
           AND (aj.employee_status IS NULL OR LOWER(TRIM(aj.employee_status)) != 'return')
           AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
           AND aj.id IN (SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids)) AS pendingAssignmentJobs
    `, [productionId, productionId, productionId, productionId]);

    /* ================= WEEKLY PERFORMANCE ================= */
    const [[weekly]] = await pool.query(`
      SELECT
        -- Jobs completed this week
        (SELECT COUNT(DISTINCT j.id) 
         FROM assign_jobs aj 
         JOIN jobs j ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
         WHERE aj.production_id = ? 
           AND (aj.employee_status = 'complete' OR aj.production_status = 'complete' OR j.job_status = 'complete' OR j.job_status = 'Completed')
           AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
           AND (aj.employee_status IS NULL OR LOWER(TRIM(aj.employee_status)) != 'return')
           AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
           AND aj.id IN (SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids)
           AND YEARWEEK(aj.updated_at, 1) = YEARWEEK(CURDATE(), 1)
        ) AS jobsCompletedThisWeek,

        -- Jobs created/assigned this week
        (SELECT COUNT(DISTINCT j.id) 
         FROM assign_jobs aj 
         JOIN jobs j ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
         WHERE aj.production_id = ? AND j.job_status IN ('Active', 'in_progress')
           AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
           AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
           AND YEARWEEK(aj.created_at, 1) = YEARWEEK(CURDATE(), 1)
        ) AS jobsCreatedThisWeek,

        -- Overdue / Stuck Jobs (no update in last 3 days)
        (SELECT COUNT(DISTINCT j.id) 
         FROM assign_jobs aj 
         JOIN jobs j ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
         WHERE aj.production_id = ? AND j.job_status IN ('Active', 'in_progress')
           AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
           AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
           AND aj.updated_at < DATE_SUB(CURDATE(), INTERVAL 3 DAY)
        ) AS overdueJobs
    `, [productionId, productionId, productionId]);

    /* ================= EMPLOYEE WORKLOAD ================= */
    const [[workload]] = await pool.query(`
      SELECT COUNT(DISTINCT j.id) AS totalAssignedJobs
      FROM assign_jobs aj 
      JOIN jobs j ON JSON_CONTAINS(aj.job_ids, JSON_ARRAY(j.id))
      WHERE aj.production_id = ? 
        AND (aj.production_status IS NULL OR LOWER(TRIM(aj.production_status)) != 'return')
        AND (aj.employee_status IS NULL OR LOWER(TRIM(aj.employee_status)) != 'return')
        AND (j.job_status IS NULL OR LOWER(TRIM(j.job_status)) != 'return')
        AND aj.id IN (SELECT MAX(id) FROM assign_jobs GROUP BY project_id, job_ids)
    `, [productionId]);

    /* ================= RESPONSE ================= */
    res.json({
      success: true,
      data: {
        topCards: {
          inProgress: topCards.inProgressJobs || 0,
          active: topCards.activeJobs || 0,
          completed: topCards.completedJobs || 0,
          pendingAssignment: topCards.pendingAssignmentJobs || 0
        },

        weeklyPerformance: {
          jobsCompleted: weekly.jobsCompletedThisWeek || 0,
          jobsCreated: weekly.jobsCreatedThisWeek || 0,
          overdueJobs: weekly.overdueJobs || 0
        },

        employeeWorkload: {
          totalJobsAssigned: workload.totalAssignedJobs || 0
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




export const getAdminDashboardReports = async (req, res) => {
  try {
    const [
      [[projects]],
      [[jobs]],
      [[activeJobs]],
      [[completedJobs]],

      // 🔥 currency-wise
      [totalInvoiceAmount],
      [totalPOAmount],

      [[jobsCreatedThisWeek]],
      [[jobsCompletedThisWeek]],
      [[dueThisWeek]],
      [[overdueJobs]],

      // 🔥 currency-wise
      [invoiceThisMonth],
      [poThisMonth],

      [[invoicePaymentSplit]],
      [[totalHours]],
      [[weeklyHours]]
    ] = await Promise.all([

      // ===== TOP CARDS =====
      pool.query(`SELECT COUNT(*) AS totalProjects FROM projects`),
      pool.query(`SELECT COUNT(*) AS totalJobs FROM jobs`),

      pool.query(`
        SELECT COUNT(*) AS activeJobs
        FROM jobs
        WHERE job_status IN ('Active','in_progress')
      `),

      pool.query(`
        SELECT COUNT(*) AS completedJobs
        FROM jobs
        WHERE job_status = 'Completed'
      `),

      // ===== TOTAL INVOICE (currency-wise) =====
      pool.query(`
        SELECT 
          currency,
          IFNULL(SUM(total_amount),0) AS amount
        FROM invoices
        WHERE invoice_status != 'Draft'
        GROUP BY currency
      `),

      // ===== TOTAL PO (currency-wise) ✅ FIXED =====
      pool.query(`
        SELECT 
          p.currency,
          IFNULL(SUM(po.po_amount),0) AS amount
        FROM purchase_orders po
        LEFT JOIN projects p ON p.id = po.project_id
        GROUP BY p.currency
      `),

      // ===== JOB ANALYTICS =====
      pool.query(`
        SELECT COUNT(*) AS jobsCreatedThisWeek
        FROM jobs
        WHERE YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)
      `),

      pool.query(`
        SELECT COUNT(*) AS jobsCompletedThisWeek
        FROM jobs
        WHERE job_status = 'Completed'
        AND YEARWEEK(updated_at, 1) = YEARWEEK(CURDATE(), 1)
      `),

      pool.query(`
        SELECT COUNT(*) AS dueThisWeek
        FROM jobs
        WHERE job_status IN ('Active','in_progress')
        AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)
      `),

      pool.query(`
        SELECT COUNT(*) AS overdueJobs
        FROM jobs
        WHERE job_status IN ('Active','in_progress')
        AND created_at < CURDATE()
      `),

      // ===== INVOICE THIS MONTH (currency-wise) =====
      pool.query(`
        SELECT 
          currency,
          IFNULL(SUM(total_amount),0) AS amount
        FROM invoices
        WHERE MONTH(invoice_date) = MONTH(CURDATE())
          AND YEAR(invoice_date) = YEAR(CURDATE())
        GROUP BY currency
      `),

      // ===== PO THIS MONTH (currency-wise) ✅ FIXED =====
      pool.query(`
        SELECT 
          p.currency,
          IFNULL(SUM(po.po_amount),0) AS amount
        FROM purchase_orders po
        LEFT JOIN projects p ON p.id = po.project_id
        WHERE MONTH(po.po_date) = MONTH(CURDATE())
          AND YEAR(po.po_date) = YEAR(CURDATE())
        GROUP BY p.currency
      `),

      // ===== PAID / UNPAID =====
      pool.query(`
        SELECT 
          SUM(CASE WHEN payment_status = 'Paid' THEN total_amount ELSE 0 END) AS paidAmount,
          SUM(CASE WHEN payment_status = 'Unpaid' THEN total_amount ELSE 0 END) AS unpaidAmount
        FROM invoices
      `),

      // ===== TIME / PRODUCTIVITY =====
      pool.query(`
        SELECT SEC_TO_TIME(SUM(TIME_TO_SEC(time))) AS totalHours
        FROM time_work_logs
      `),

      pool.query(`
        SELECT SEC_TO_TIME(SUM(TIME_TO_SEC(time))) AS weeklyHours
        FROM time_work_logs
        WHERE YEARWEEK(date, 1) = YEARWEEK(CURDATE(), 1)
      `)
    ]);

    // ===== FINAL RESPONSE =====
    res.json({
      success: true,
      data: {
        topCards: {
          totalProjects: projects.totalProjects,
          totalJobs: jobs.totalJobs,
          activeJobs: activeJobs.activeJobs,
          completedJobs: completedJobs.completedJobs,
          invoiceAmountByCurrency: totalInvoiceAmount,
          poAmountByCurrency: totalPOAmount
        },

        jobAnalytics: {
          createdThisWeek: jobsCreatedThisWeek.jobsCreatedThisWeek,
          completedThisWeek: jobsCompletedThisWeek.jobsCompletedThisWeek,
          dueThisWeek: dueThisWeek.dueThisWeek,
          overdueJobs: overdueJobs.overdueJobs
        },

        finance: {
          invoiceThisMonthByCurrency: invoiceThisMonth,
          poThisMonthByCurrency: poThisMonth,
          paidAmount: invoicePaymentSplit.paidAmount,
          unpaidAmount: invoicePaymentSplit.unpaidAmount
        },

        productivity: {
          totalHours: totalHours.totalHours || "00:00:00",
          weeklyHours: weeklyHours.weeklyHours || "00:00:00"
        }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to load admin dashboard reports"
    });
  }
};

export const getEmployeeDashboard = async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "employeeId is required"
      });
    }

    /* ================= TOP CARDS ================= */
    const [[topCards]] = await pool.query(`
      SELECT
        (SELECT COUNT(*)
         FROM jobs
         WHERE job_status = 'in_progress'
         AND assigned = ?) AS inProgress,

        (SELECT COUNT(*)
         FROM jobs
         WHERE job_status = 'Active'
         AND assigned = ?) AS active,

        (SELECT COUNT(*)
         FROM jobs
         WHERE job_status = 'Completed'
         AND assigned = ?) AS completed,

        (SELECT COUNT(*)
         FROM jobs
         WHERE assigned IS NULL
         AND job_status = 'pending') AS pendingAssignment
    `, [employeeId, employeeId, employeeId]);

    /* ================= WEEKLY PERFORMANCE ================= */
    const [[weekly]] = await pool.query(`
      SELECT
        (SELECT COUNT(*)
         FROM jobs
         WHERE job_status = 'Completed'
         AND assigned = ?
         AND YEARWEEK(updated_at, 1) = YEARWEEK(CURDATE(), 1)
        ) AS jobsCompleted,

        (SELECT COUNT(*)
         FROM jobs
         WHERE assigned = ?
         AND YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)
        ) AS jobsCreated,

        (SELECT COUNT(*)
         FROM jobs
         WHERE job_status IN ('Active','in_progress')
         AND assigned = ?
         AND updated_at < DATE_SUB(CURDATE(), INTERVAL 3 DAY)
        ) AS overdueJobs
    `, [employeeId, employeeId, employeeId]);

    /* ================= WORKLOAD ================= */
    const [[workload]] = await pool.query(`
      SELECT
        COUNT(*) AS totalJobsAssigned
      FROM jobs
      WHERE assigned = ?
    `, [employeeId]);

    /* ================= RESPONSE ================= */
    res.json({
      success: true,
      data: {
        topCards: {
          inProgress: topCards.inProgress,
          active: topCards.active,
          completed: topCards.completed,
          pendingAssignment: topCards.pendingAssignment
        },

        weeklyPerformance: {
          jobsCompleted: weekly.jobsCompleted,
          jobsCreated: weekly.jobsCreated,
          overdueJobs: weekly.overdueJobs
        },

        employeeWorkload: {
          totalJobsAssigned: workload.totalJobsAssigned
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

