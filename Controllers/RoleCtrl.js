import { pool } from "../Config/dbConnect.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, "../Config/role_permissions.json");

const ALL_PERMISSION_KEYS = [
  "projects_view", "projects_create", "projects_delete",
  "jobs_view", "jobs_create", "jobs_assign", "jobs_delete",
  "production_view", "production_update",
  "designer_view", "timelogs_view",
  "invoices_view", "invoices_create",
  "estimates_view", "estimates_create",
  "clients_view", "clients_manage",
  "reports_view",
  "users_view", "users_manage"
];

const DEFAULT_PRODUCTION_KEYS = [
  "projects_view", "jobs_view", "jobs_assign", "production_view", "production_update", "timelogs_view"
];

const DEFAULT_EMPLOYEE_KEYS = [
  "projects_view", "jobs_view", "designer_view", "timelogs_view"
];

export const getStoredRolePermissions = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Error reading role_permissions.json:", e);
  }
  return {
    production: DEFAULT_PRODUCTION_KEYS,
    employee: DEFAULT_EMPLOYEE_KEYS
  };
};

export const saveStoredRolePermissions = (rolePermissions) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(rolePermissions, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Error writing role_permissions.json:", e);
    return false;
  }
};

export const getRoles = async (req, res) => {
  try {
    const tenantId = req.tenant_id || 1;
    let customRoles = [];
    try {
      const [rows] = await pool.query(
        "SELECT id, role_name, description, permissions, created_at FROM custom_roles WHERE tenant_id = ? OR tenant_id = 1 ORDER BY id DESC",
        [tenantId]
      );
      customRoles = rows;
    } catch (e) {
      customRoles = [];
    }

    const storedPermissions = getStoredRolePermissions();

    const defaultRoles = [
      { id: "default_admin", role_name: "admin", description: "Full System Administrator", permissions: ALL_PERMISSION_KEYS, is_default: true },
      { id: "default_production", role_name: "production", description: "Production Manager", permissions: storedPermissions.production || DEFAULT_PRODUCTION_KEYS, is_default: true },
      { id: "default_employee", role_name: "employee", description: "Designer / Employee Panel", permissions: storedPermissions.employee || DEFAULT_EMPLOYEE_KEYS, is_default: true }
    ];

    res.status(200).json({
      success: true,
      data: {
        default_roles: defaultRoles,
        custom_roles: customRoles.map(r => ({
          ...r,
          permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || [])
        }))
      }
    });
  } catch (error) {
    console.error("Get Roles Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRole = async (req, res) => {
  try {
    const { role_name, description, permissions } = req.body;
    const tenantId = req.tenant_id || 1;

    if (!role_name || role_name.trim() === "") {
      return res.status(400).json({ success: false, message: "Role name is required" });
    }

    const cleanRoleName = role_name.trim().toLowerCase();

    let existing = [];
    try {
      const [rows] = await pool.query(
        "SELECT id FROM custom_roles WHERE LOWER(role_name) = ?",
        [cleanRoleName]
      );
      existing = rows;
    } catch (e) {
      existing = [];
    }

    if (existing.length > 0 || ["admin", "production", "employee", "designer"].includes(cleanRoleName)) {
      return res.status(400).json({ success: false, message: "Role name already exists" });
    }

    const jsonPermissions = JSON.stringify(permissions || []);

    const [result] = await pool.query(
      "INSERT INTO custom_roles (role_name, description, permissions, tenant_id) VALUES (?, ?, ?, ?)",
      [cleanRoleName, description || "", jsonPermissions, tenantId]
    );

    res.status(201).json({
      success: true,
      message: "User Role created successfully",
      role_id: result.insertId,
      role_name: cleanRoleName
    });
  } catch (error) {
    console.error("Create Role Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_name, permissions } = req.body;

    // Handle editing system default roles
    if (id === "default_production" || id === "default_employee" || role_name === "production" || role_name === "employee" || role_name === "designer") {
      const targetRole = (id === "default_production" || role_name === "production") ? "production" : "employee";
      const stored = getStoredRolePermissions();
      stored[targetRole] = permissions || [];
      saveStoredRolePermissions(stored);

      return res.status(200).json({
        success: true,
        message: `${targetRole === "employee" ? "Designer" : "Production"} role permissions updated successfully`
      });
    }

    const jsonPermissions = JSON.stringify(permissions || []);

    await pool.query(
      "UPDATE custom_roles SET description = ?, permissions = ? WHERE id = ?",
      [req.body.description || "", jsonPermissions, id]
    );

    res.status(200).json({ success: true, message: "User Role updated successfully" });
  } catch (error) {
    console.error("Update Role Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDefaultRole = async (req, res) => {
  try {
    const { roleName } = req.params;
    const { permissions } = req.body;

    const normalizedRole = roleName.toLowerCase() === "designer" ? "employee" : roleName.toLowerCase();
    
    if (!["production", "employee"].includes(normalizedRole)) {
      return res.status(400).json({ success: false, message: "Only production and designer roles can be edited" });
    }

    const stored = getStoredRolePermissions();
    stored[normalizedRole] = permissions || [];
    saveStoredRolePermissions(stored);

    res.status(200).json({
      success: true,
      message: `${normalizedRole === "employee" ? "Designer" : "Production"} role permissions updated successfully`
    });
  } catch (error) {
    console.error("Update Default Role Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM custom_roles WHERE id = ?", [id]);
    res.status(200).json({ success: true, message: "User Role deleted successfully" });
  } catch (error) {
    console.error("Delete Role Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    const jsonPermissions = JSON.stringify(permissions || []);

    await pool.query(
      "UPDATE users SET custom_permissions = ? WHERE id = ?",
      [jsonPermissions, userId]
    );

    res.status(200).json({ success: true, message: "User permissions updated successfully" });
  } catch (error) {
    console.error("Update User Permissions Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;

    const [[user]] = await pool.query(
      "SELECT id, first_name, last_name, email, role_name, custom_permissions FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const storedPermissions = getStoredRolePermissions();

    let userPerms = [];
    if (user.custom_permissions) {
      userPerms = typeof user.custom_permissions === 'string' ? JSON.parse(user.custom_permissions) : user.custom_permissions;
    } else if (user.role_name) {
      const roleLower = user.role_name.toLowerCase();
      if (roleLower === "admin") {
        userPerms = ALL_PERMISSION_KEYS;
      } else if (roleLower === "production") {
        userPerms = storedPermissions.production || DEFAULT_PRODUCTION_KEYS;
      } else if (roleLower === "employee" || roleLower === "designer") {
        userPerms = storedPermissions.employee || DEFAULT_EMPLOYEE_KEYS;
      } else {
        try {
          const [[role]] = await pool.query(
            "SELECT permissions FROM custom_roles WHERE LOWER(role_name) = ?",
            [roleLower]
          );
          if (role && role.permissions) {
            userPerms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
          }
        } catch (e) {
          userPerms = [];
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        permissions: userPerms || []
      }
    });
  } catch (error) {
    console.error("Get User Permissions Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
