import { pool } from "../Config/dbConnect.js";
import { getNextNumber } from "./NumberSequenceCtrl.js";
import { uploadToMega } from "./megaUploader.js";

const parseBudget = (budget, currency) => {
  if (!budget) return null;

  let cleaned = budget.toString().trim();

  switch (currency) {
    case "INR":
    case "USD":
    case "GBP":
    case "AED":
    case "SAR":
      cleaned = cleaned.replace(/,/g, "");
      break;

    case "EUR":
      cleaned = cleaned.replace(/\./g, "");
      break;

    default:
      cleaned = cleaned.replace(/[,.]/g, "");
  }

  const amount = Number(cleaned);

  if (isNaN(amount)) {
    throw new Error("Invalid budget format");
  }

  return amount;
};

export const createProject = async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== "admin" && userRole !== "production" && userRole !== "employee") {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }

    const {
      project_name,
      client_name,
      start_date,
      expected_completion_date,
      priority,
      status,
      project_description,
      project_requirements,
      budget,
      currency,
      category_id,
      department,
      progress_percentage,
      tags,
      assigned_team
    } = req.body;

    if (!project_name) {
      return res.status(400).json({ message: "Project name is required" });
    }

    // 1️⃣ Generate next project_no
    const nextProjectNo = await getNextNumber("project_no");

    // 2️⃣ Parse budget
    const cleanBudget = parseBudget(budget, currency);

    const companyId = req.tenant_id || req.user?.companyId || req.user?.tenant_id || null;

    // 3️⃣ Insert
    const [response] = await pool.query(
      `INSERT INTO projects (
        project_name, project_no, client_name,
        start_date, expected_completion_date,
        priority, status,
        project_description, project_requirements,
        budget, currency, company_id
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        project_name,
        nextProjectNo,
        client_name || null,
        start_date || null,
        expected_completion_date || null,
        priority || "medium",
        status || "active",
        project_description || null,
        project_requirements ? JSON.stringify(project_requirements) : null,
        cleanBudget,
        currency || null,
        companyId
      ]
    );

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      id: response.insertId,
      project_no: nextProjectNo,
    });
  } catch (error) {
    console.error("Create Project Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const getAllProjects = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM projects ORDER BY id DESC");

    const data = rows.map((p) => ({
      ...p,
      project_requirements: p.project_requirements
        ? JSON.parse(p.project_requirements)
        : [],
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const [[project]] = await pool.query("SELECT * FROM projects WHERE id=?", [
      id,
    ]);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    project.project_requirements = project.project_requirements
      ? JSON.parse(project.project_requirements)
      : [];

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
    }

    const { id } = req.params;

    const {
      project_name,
      client_name,
      start_date,
      expected_completion_date,
      priority,
      status,
      project_description,
      project_requirements,
      budget,
      currency,
      category_id,
      department,
      progress_percentage,
      tags,
      assigned_team
    } = req.body;

    // 🔹 Parse budget again on update
    const cleanBudget = parseBudget(budget, currency);

    await pool.query(
      `UPDATE projects SET
        project_name=?,
        client_name=?,
        start_date=?,
        expected_completion_date=?,
        priority=?,
        status=?,
        project_description=?,
        project_requirements=?,
        budget=?,
        currency=?
      WHERE id=?`,
      [
        project_name,
        client_name,
        start_date,
        expected_completion_date,
        priority,
        status,
        project_description,
        project_requirements ? JSON.stringify(project_requirements) : null,
        cleanBudget,
        currency,
        id,
      ]
    );

    res.json({
      success: true,
      message: "Project updated successfully",
    });
  } catch (error) {
    console.error("Update Project Error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const deleteProject = async (req, res) => {
  const userRole = req.user?.role;
  if (userRole !== "admin") {
    return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
  }

  const connection = await pool.getConnection();

  try {
    const { id } = req.params;

    await connection.beginTransaction();

    // 1️⃣ Time logs (depends on jobs + project)
    await connection.query("DELETE FROM time_work_logs WHERE project_id = ?", [
      id,
    ]);

    // 2️⃣ Assign jobs
    await connection.query("DELETE FROM assign_jobs WHERE project_id = ?", [
      id,
    ]);

    // 3️⃣ Jobs
    await connection.query("DELETE FROM jobs WHERE project_id = ?", [id]);

    // 4️⃣ Invoices
    await connection.query("DELETE FROM invoices WHERE project_id = ?", [id]);

    // 5️⃣ Estimates
    await connection.query("DELETE FROM estimates WHERE project_id = ?", [id]);

    // 6️⃣ Purchase Orders
    await connection.query("DELETE FROM purchase_orders WHERE project_id = ?", [
      id,
    ]);

    // 7️⃣ Finally delete project
    await connection.query("DELETE FROM projects WHERE id = ?", [id]);

    await connection.commit();

    res.json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: error.message });
  } finally {
    connection.release();
  }
};

export const getProjectsByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    const [rows] = await pool.query(
      "SELECT * FROM projects WHERE status=? ORDER BY id DESC",
      [status]
    );

    const data = rows.map((p) => ({
      ...p,
      project_requirements: p.project_requirements
        ? JSON.parse(p.project_requirements)
        : [],
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get project overview
export const getProjectOverviewById = async (req, res) => {
  try {
    const { id: projectId } = req.params;

    /* ---------------- Project ---------------- */
    const [[project]] = await pool.query(
      `
      SELECT expected_completion_date, currency
      FROM projects
      WHERE id = ?
      `,
      [projectId]
    );

    if (!project) {
      return res
        .status(404)
        .json({ success: false, message: "Project not found" });
    }

    /* ---------------- Jobs ---------------- */
    const [[jobStats]] = await pool.query(
      `
      SELECT 
        COUNT(*) AS in_progress
      FROM jobs
      WHERE project_id = ?
      `,
      [projectId]
    );

    /* ---------------- Total Hours ---------------- */
    const [[totalTime]] = await pool.query(
      `
      SELECT CONCAT(
        FLOOR(SUM(TIME_TO_SEC(time) + TIME_TO_SEC(overtime)) / 3600),
        ':',
        LPAD(FLOOR(SUM(TIME_TO_SEC(time) + TIME_TO_SEC(overtime)) % 3600 / 60), 2, '0')
      ) AS total_hours
      FROM jobs j
      LEFT JOIN time_work_logs twl ON twl.job_id = j.id
      WHERE j.project_id = ?
      `,
      [projectId]
    );

    /* ---------------- Purchase Orders ---------------- */
    const [[poStats]] = await pool.query(
      `
      SELECT 
        COUNT(*) AS total_pos,
        IFNULL(SUM(CAST(po_amount AS DECIMAL(14,2))), 0) AS total_value
      FROM purchase_orders
      WHERE project_id = ?
      `,
      [projectId]
    );

    /* ---------------- Days Remaining ---------------- */
    let daysRemaining = null;
    if (project.expected_completion_date) {
      const today = new Date();
      const endDate = new Date(project.expected_completion_date);
      daysRemaining = Math.max(
        Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)),
        0
      );
    }

    /* ---------------- Recent Activity (basic, real) ---------------- */
    const [recentJobs] = await pool.query(
      `
      SELECT 'New job created' AS activity, created_at
      FROM jobs
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 2
      `,
      [projectId]
    );

    const [recentPOs] = await pool.query(
      `
      SELECT 'New purchase order created' AS activity, created_at
      FROM purchase_orders
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [projectId]
    );

    /* ---------------- Invoices ---------------- */
    const [invoiceStats] = await pool.query(
      `
  SELECT 
    currency,
    COUNT(*) AS issued,
    SUM(CASE WHEN invoice_status IN ('completed', 'received') THEN 1 ELSE 0 END) AS received,
    IFNULL(SUM(CASE WHEN invoice_status IN ('completed', 'received') THEN total_amount ELSE 0 END), 0) AS total_value
  FROM invoices
  WHERE purchase_order_id IN (
    SELECT id FROM purchase_orders WHERE project_id = ?
  )
  GROUP BY currency
  `,
      [projectId]
    );

    // Pick first currency if multiple currencies exist for backward compatibility
    let purchase_orders = {
      total_pos: Number(poStats.total_pos) || 0,
      received: Number(poStats.total_pos) || 0,
      issued: 0,
      total_value: Number(poStats.total_value || 0).toFixed(2),
      currency: "USD",
    };
    // if (invoiceStats.length > 0) {
    //   const inv = invoiceStats[0];
    //   purchase_orders = {
    //     received: Number(inv.received) || 0,
    //     issued: Number(inv.issued) || 0,
    //   };
    // }
    const recentActivity = [...recentJobs, ...recentPOs]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 3);

    /* ---------------- Final Response ---------------- */
    res.json({
      success: true,
      data: {
        in_progress: jobStats.in_progress || 0,

        days_remaining: daysRemaining,
        due_date: project.expected_completion_date,

        jobs_due_today: 0, // ❌ column nahi hai
        total_hours: totalTime.total_hours || "00:00",

        purchase_orders,

        recent_activity: recentActivity,
      },
    });
  } catch (error) {
    console.error("Project Overview Error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

import path from "path";

export const uploadProjectFile = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "No file provided" });
    }

    const file = req.files.file;
    const safeName = Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uploadPath = path.join(path.resolve(), "uploads", safeName);
    
    await file.mv(uploadPath);

    const link = `/uploads/${safeName}`;
    const fileSize = (file.size / (1024 * 1024)).toFixed(2) + " MB";
    const fileType = file.name.split(".").pop();

    await pool.query(
      "INSERT INTO project_files (project_id, file_name, file_size, file_type, file_url) VALUES (?, ?, ?, ?, ?)",
      [id, file.name, fileSize, fileType, link]
    );
    
    res.json({ success: true, message: "File uploaded successfully", url: link });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const getProjectTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [[project]] = await pool.query("SELECT created_at FROM projects WHERE id=?", [id]);
    const [jobs] = await pool.query("SELECT created_at, job_no FROM jobs WHERE project_id=?", [id]);
    const [pos] = await pool.query("SELECT created_at, po_number FROM purchase_orders WHERE project_id=?", [id]);
    
    let timeline = [];
    if (project) {
      timeline.push({ title: "Project Initialized", description: "Project workspace was created.", date: project.created_at });
    }
    jobs.forEach(j => timeline.push({ title: "Job Created", description: `Job #${j.job_no} was added to the project.`, date: j.created_at }));
    pos.forEach(p => timeline.push({ title: "Purchase Order", description: `PO #${p.po_number} was issued.`, date: p.created_at }));
    
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const [files] = await pool.query("SELECT * FROM project_files WHERE project_id=? ORDER BY created_at DESC", [id]);
    
    const data = files.map(f => ({
      id: f.id,
      name: f.file_name,
      size: f.file_size,
      type: f.file_type,
      uploadDate: f.created_at,
      url: f.file_url
    }));
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProjectFile = async (req, res) => {
  try {
    const { id, fileId } = req.params;
    await pool.query("DELETE FROM project_files WHERE id = ? AND project_id = ?", [fileId, id]);
    res.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const editProjectFile = async (req, res) => {
  try {
    const { id, fileId } = req.params;
    const { file_name } = req.body;
    await pool.query("UPDATE project_files SET file_name = ? WHERE id = ? AND project_id = ?", [file_name, fileId, id]);
    res.json({ success: true, message: "File updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProjectTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { teamIds } = req.body;
    await pool.query("UPDATE projects SET assigned_team = ? WHERE id = ?", [JSON.stringify(teamIds || []), id]);
    res.json({ success: true, message: "Team updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProjectTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const [[project]] = await pool.query("SELECT assigned_team FROM projects WHERE id=?", [id]);
    
    if (!project || !project.assigned_team) {
      return res.json({ success: true, data: [] });
    }
    
    const teamIds = typeof project.assigned_team === 'string' ? JSON.parse(project.assigned_team) : project.assigned_team;
    
    if (!Array.isArray(teamIds) || teamIds.length === 0) return res.json({ success: true, data: [] });
    
    const [users] = await pool.query(`SELECT id, first_name, last_name, email, role_name FROM users WHERE id IN (?)`, [teamIds]);
    
    const data = users.map(u => ({
      id: u.id,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'User',
      role: u.role_name || 'Member',
      email: u.email,
      avatar: (u.first_name || 'U').charAt(0).toUpperCase()
    }));
    
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
