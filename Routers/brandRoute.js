
import express from "express";
const router=express.Router();
import {
    createBrand,
    getBrands,
   deleteBrand,
   deleteMultipleBrands
} from "../Controllers/brandCtrl.js";
router.post("/brand", createBrand);
router.get("/brand", getBrands);
router.delete("/brand/:id", deleteBrand);
router.delete("/brand/bulk-delete", deleteMultipleBrands);

export default router;
