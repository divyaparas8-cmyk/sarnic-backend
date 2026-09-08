import express from "express";
import {
  createCompany,
  getCompanyById,
  updateCompany,
  deleteCompany,
  getAdminDashboard
} from "../Controllers/CompanyCtrl.js";

const router = express.Router();

router.post("/company", createCompany);
router.get("/admindashboard",getAdminDashboard)
router.get("/company/:id", getCompanyById);
router.put("/company/:id", updateCompany);
router.delete("/company/:id", deleteCompany);

export default router;
