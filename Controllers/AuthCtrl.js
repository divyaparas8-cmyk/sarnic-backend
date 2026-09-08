import { pool } from "../Config/dbConnect.js";
import bcrypt from "bcrypt";
import fs from "fs";
import cloudinary from "../cloudinary/cloudinary.js";
import { generatetoken    } from "../utils/generateToken.js";
import jwt from "jsonwebtoken";
import { getStoredRolePermissions } from "./RoleCtrl.js";

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("Login Request:", email);
        const [users] = await pool.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found, please contact admin"
            });
        }
        const user = users[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return res.status(403).json({
                success: false,
                message: "Invalid password"
            });
        }
        let userPerms = [];
        if (user.custom_permissions) {
          userPerms = typeof user.custom_permissions === 'string' ? JSON.parse(user.custom_permissions) : user.custom_permissions;
        } else if (user.role_name) {
          const roleLower = user.role_name.toLowerCase();
          const storedPermissions = getStoredRolePermissions();
          if (roleLower === "admin") {
            userPerms = ["all"];
          } else if (roleLower === "production") {
            userPerms = storedPermissions.production || ["projects_view", "jobs_view", "jobs_assign", "production_view", "production_update", "timelogs_view"];
          } else if (roleLower === "employee" || roleLower === "designer") {
            userPerms = storedPermissions.employee || ["projects_view", "jobs_view", "designer_view", "timelogs_view"];
          } else {
            try {
              const [[roleRow]] = await pool.query(
                "SELECT permissions FROM custom_roles WHERE LOWER(role_name) = ?",
                [roleLower]
              );
              if (roleRow && roleRow.permissions) {
                userPerms = typeof roleRow.permissions === 'string' ? JSON.parse(roleRow.permissions) : roleRow.permissions;
              }
            } catch (e) {
              userPerms = [];
            }
          }
        }

        const token = await generatetoken(user.id, user.role_name, user.company_id || user.tenant_id);
        return res.status(200).json({
            success: true,
            message: `${user.role_name} login successful`,
            token,
            role: user.role_name,
            permissions: userPerms || [],
            data: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone_number: user.phone_number,
                role_name: user.role_name,
                image: user.image,
                permissions: userPerms || []
            }
        });
    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export const createUser = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone_number,
      password,
      state,
      city,
      country,
      role_name,
      tenant_name, // Optional: if registering a new company
    } = req.body;
    
    // Determine the tenant_id
    let tenant_id = req.tenant_id;
    if (!tenant_id) {
      const token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          tenant_id = decoded.tenant_id;
        } catch (e) {}
      }
    }
    if (!tenant_id) {
      tenant_id = 1; // Default fallback
    }

    if (!tenant_id && tenant_name) {
      // Create a new tenant for self-registration
      const [tenantRes] = await pool.query(
        "INSERT INTO tenants (name) VALUES (?)",
        [tenant_name]
      );
      tenant_id = tenantRes.insertId;
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const [exist] = await pool.query(
      "SELECT id FROM users WHERE email=?",
      [email]
    );

    if (exist.length > 0) {
      return res.status(403).json({ message: "User already exists" });
    }

    let image = null;

    if (req.files?.file) {
      const result = await cloudinary.uploader.upload(
        req.files.file.tempFilePath,
        { folder: "user_image" }
      );

      image = result.secure_url;
      fs.unlinkSync(req.files.file.tempFilePath);
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const [response] = await pool.query(
      `INSERT INTO users
      (first_name,last_name,email,phone_number,password,state,country,role_name,image,tenant_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        first_name,
        last_name,
        email,
        phone_number,
        hashPassword,
        city || state || "",
        country,
        role_name,
        image,
        tenant_id
      ]
    );

    res.status(200).json({
      success: true,
      message: "User created successfully",
      id: response.insertId,
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getUsers = async (req, res) => {
    try {
        let tenant_id = req.tenant_id;
        
        // Decode token manually if middleware didn't set it
        if (!tenant_id) {
            const token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;
            if (token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    tenant_id = decoded.tenant_id;
                } catch (e) {
                    console.error("Token verification failed in getUsers:", e.message);
                }
            }
        }

        // Default to tenant 1 if still not found
        if (!tenant_id) {
            tenant_id = 1;
        }

        const [rows] = await pool.query(
            `SELECT id,first_name,last_name,email,phone_number,
                    state, state AS city,country,role_name,image,tenant_id,created_at,updated_at
             FROM users WHERE tenant_id = ?`,
             [tenant_id]
        );
        res.status(200).json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            "SELECT * FROM users WHERE id=?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ success: true, data: rows[0] });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            first_name,
            last_name,
            phone_number,
            state,
            city,
            country,
            role_name
        } = req.body;

        let image;
        if (req.files && req.files.file) {
            const upload = await cloudinary.uploader.upload(
                req.files.file.tempFilePath,
                { folder: "user_image" }
            );
            image = upload.secure_url;
            fs.unlinkSync(req.files.file.tempFilePath);
        }

        await pool.query(
            `UPDATE users SET
            first_name=?,
            last_name=?,
            phone_number=?,
            state=?,
            country=?,
            role_name=?,
            image=COALESCE(?,image)
            WHERE id=?`,
            [
                first_name,
                last_name,
                phone_number,
                city !== undefined ? city : state,
                country,
                role_name,
                image,
                id
            ]
        );
        res.status(200).json({ message: "User updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query("DELETE FROM users WHERE id=?", [id]);

        res.status(200).json({ message: "User deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    // Check user exists
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE id=?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash new password
    const hash = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      "UPDATE users SET password=? WHERE id=?",
      [hash, id]
    );

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getProductionUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone_number,
              state, country, role_name, image, created_at, updated_at
       FROM users
       WHERE role_name = 'production'`
    );

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmployeeUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone_number,
              state, country, role_name, image, created_at, updated_at
       FROM users
       WHERE role_name = 'employee'`
    );

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
























