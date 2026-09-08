
import express from "express";
const router = express.Router();
import {
    createPackType,
    getPackTypes,
   deletePackType,
   deleteMultiplePackTypes
} from "../Controllers/packtypeCtrl.js";
router.post("/packtypes", createPackType);
router.get("/packtypes", getPackTypes);
router.delete("/packtypes/:id", deletePackType);
router.delete("/packtypes/bulk-delete", deleteMultiplePackTypes);


export default router;

