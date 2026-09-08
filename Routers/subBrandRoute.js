

import express from "express";
const router = express.Router();
import {
    deleteSubBrand,
    getSubBrands,
   createSubBrand,
   deleteMultipleSubBrands
} from "../Controllers/subBrandCtrl.js";



router.post("/subbrands", createSubBrand);
router.get("/subbrands", getSubBrands);
router.delete("/subbrands/:id", deleteSubBrand);
router.delete("/subbrands/bulk-delete", deleteMultipleSubBrands);


export default router;



