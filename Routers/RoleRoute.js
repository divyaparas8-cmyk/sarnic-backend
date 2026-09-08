import express from "express";
import { getRoles, createRole, updateRole, updateDefaultRole, deleteRole, updateUserPermissions, getUserPermissions } from "../Controllers/RoleCtrl.js";
import { requireTenant } from "../Middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(requireTenant);

router.get("/roles", getRoles);
router.post("/roles", createRole);
router.put("/roles/default/:roleName", updateDefaultRole);
router.put("/roles/:id", updateRole);
router.delete("/roles/:id", deleteRole);

router.get("/roles/user/:userId/permissions", getUserPermissions);
router.put("/roles/user/:userId/permissions", updateUserPermissions);

export default router;
