import express from "express";
import {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectsByStatus,
  getProjectOverviewById,
  getProjectTimeline,
  getProjectFiles,
  uploadProjectFile,
  deleteProjectFile,
  editProjectFile,
  getProjectTeam,
  updateProjectTeam
} from "../Controllers/projectCtrl.js";
import { requireTenant } from "../Middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(requireTenant);

router.post("/projects", createProject);
router.get("/projects", getAllProjects);
router.get("/projects/:id", getProjectById);
router.get("/projects/overview/:id", getProjectOverviewById);
router.put("/projects/:id", updateProject);
router.delete("/projects/:id", deleteProject);

// Status tabs
router.get("/projects/status/:status", getProjectsByStatus);

// Workspace tabs
router.get("/projects/timeline/:id", getProjectTimeline);
router.get("/projects/files/:id", getProjectFiles);
router.post("/projects/files/:id", uploadProjectFile);
router.delete("/projects/files/:id/:fileId", deleteProjectFile);
router.put("/projects/files/:id/:fileId", editProjectFile);
router.get("/projects/team/:id", getProjectTeam);
router.put("/projects/team/:id", updateProjectTeam);

export default router;
