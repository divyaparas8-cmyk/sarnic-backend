import express from "express";
import {
  createTaxCategory,
  getAllTaxCategories,
  getTaxCategoryById,
  deleteTaxCategory
} from "../Controllers/TaxCategoryCtrl.js";

const router = express.Router();

router.post("/taxcategory", createTaxCategory);
router.get("/taxcategory", getAllTaxCategories);
router.get("/taxcategory/:id", getTaxCategoryById);
router.delete("/taxcategory/:id", deleteTaxCategory);

export default router;
