
import express from "express";
const router = express.Router();
import {
    createFlavour,
    getFlavours,
   deleteFlavour,
   deleteMultipleFlavours
} from "../Controllers/flavourCtrl.js";
router.post("/flavours", createFlavour);
router.get("/flavours", getFlavours);
router.delete("/flavours/:id", deleteFlavour);
router.delete("/flavours/bulk-delete", deleteMultipleFlavours);

export default router;