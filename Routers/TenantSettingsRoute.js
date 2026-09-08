import { Router } from "express";
import { getTenantSettings, updateTenantSettings, getTenantRequirements } from "../Controllers/TenantSettingsCtrl.js";
import { requireTenant } from "../Middlewares/tenantMiddleware.js";

const router = Router();

// Protect these routes with the tenant middleware
router.get("/tenant-settings", requireTenant, getTenantSettings);
router.post("/tenant-settings", requireTenant, updateTenantSettings);
router.get("/tenant-settings/requirements", requireTenant, getTenantRequirements);

export default router;
