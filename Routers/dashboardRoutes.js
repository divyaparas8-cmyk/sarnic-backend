import express from "express";
import { getAdminDashboardReports, getEmployeeDashboard, getProductionDashboard } from "../Controllers/dashboard.js";
import e from "express";
// import getProductionDashboard from "../Controllers/dashboard.js"
const router = express.Router();
router.get("/dashboards/production/:productionId",getProductionDashboard)
router.get("/dashboards/employee/:employeeId",getEmployeeDashboard)
router.get("/admin/reports",getAdminDashboardReports)
export default router;