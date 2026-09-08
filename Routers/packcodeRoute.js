
import express from "express";
const router = express.Router();
import {
    createPackCode,
    getPackCodes,
   deletePackCode,
   deleteMultiplePackCodes
} from "../Controllers/packcodeCtrl.js";
router.post("/packcodes", createPackCode);
router.get("/packcodes", getPackCodes);
router.delete("/packcodes/:id", deletePackCode);
router.delete("/packcodes/bulk-delete", deleteMultiplePackCodes);


export default router;

