
import express from "express";
const router = express.Router();
import {
    createIndustry,
    getIndustries,
   deleteIndustry,
   deleteMultipleIndustries
} from "../Controllers/IndustryCtrl.js";
router.post("/industries", createIndustry);
router.get("/industries", getIndustries);
router.delete("/industries/:id", deleteIndustry);
router.delete("/industries/bulk-delete", deleteMultipleIndustries);


export default router;