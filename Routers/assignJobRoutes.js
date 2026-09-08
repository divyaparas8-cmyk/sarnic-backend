import express from "express";
import {
  createAssignJob,
  productionAssignToEmployee,
  employeeCompleteJob,
  productionCompleteJob,
  getJobsByEmployee,
  getJobsByProduction,
  deleteAssignJob,
  productionReturnJob,
  productionRejectJob,
  getInProgressJobsByProduction,
  getCompleteJobsByProduction,
  getRejectJobsByProduction,
  employeeRejectJob,
  // getAllProductionJobs,
  getAllProductionAssignJobs,
  getAllInProgressJobsProduction,
  getAllCompleteJobsProduction,
  getAllRejectJobsProduction,
  getJobsAllEmployee,
  productionReturnJobStatus,
} from "../Controllers/assignJobCtrl.js";

const router = express.Router();

router.post("/assignjobs", createAssignJob);
router.put("/assignjobs/production-assign", productionAssignToEmployee);
router.put(
  "/assignjobs/employee-complete/:assign_job_id/:job_id",
  employeeCompleteJob
);
router.put(
  "/assignjobs/employee-reject/:assign_job_id/:job_id",
  employeeRejectJob
);
router.put("/assignjobs/production-complete/:id", productionCompleteJob);
router.put("/assignjobs/production-return", productionReturnJob);
router.put(
  "/assignjobs/production-return-job-status",
  productionReturnJobStatus
);
router.put("/assignjobs/production-reject", productionRejectJob);

router.get("/assignjobs/employee/:employee_id", getJobsByEmployee);
router.get("/assignjobs/employeeall", getJobsAllEmployee);
router.get("/assignjobs/production/:production_id", getJobsByProduction);
router.get("/assignjobs/productionall", getAllProductionAssignJobs);
router.get(
  "/assignjobs/jobs/in-progress/:production_id",
  getInProgressJobsByProduction
);
router.get("/assignjobs/jobs/allInprogress", getAllInProgressJobsProduction);

router.get(
  "/assignjobs/jobs/complete/:production_id",
  getCompleteJobsByProduction
);
router.get("/assignjobs/jobs/allcomplete", getAllCompleteJobsProduction);
router.get("/assignjobs/jobs/reject/:production_id", getRejectJobsByProduction);
router.get("/assignjobs/jobs/allreject", getAllRejectJobsProduction);
router.delete("/:id", deleteAssignJob);

export default router;
