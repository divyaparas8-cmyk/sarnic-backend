import express from "express";
import {
  createJob,
  getAllJobs,
  getJobById,
  getJobsByProjectId,
  updateJob,
  deleteJob,
  getJobHistoryByEmployeeId,
  getJobHistoryByProductionId,
  getJobByJobNoForIllustrator,
  importJobsCSV
} from "../Controllers/JobCtrl.js";
import { requireTenant } from "../Middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(requireTenant);

router.post("/jobs", createJob);
router.get("/jobs", getAllJobs);
router.get("/jobs/:id", getJobById);
router.get("/jobs/project/:projectId", getJobsByProjectId);
router.get("/jobs/jobhistoryemployee/:employeeId",getJobHistoryByEmployeeId);
router.get("/jobs/jobHistoryproduction/:productionId",getJobHistoryByProductionId);
router.put("/jobs/:id", updateJob);
router.delete("/jobs/:id", deleteJob);

router.post("/jobs/import/:projectId", importJobsCSV);

// Authenticated Illustrator endpoint
router.get("/jobs/illustrator/:jobNo", requireTenant, getJobByJobNoForIllustrator);

export default router;
