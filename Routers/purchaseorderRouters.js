import express from "express";

import {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrdersByProjectId
} from "../Controllers/purchaseorderCtrl.js";

const router = express.Router();
router.post("/purchaseorders", createPurchaseOrder);
router.get("/purchaseorders", getAllPurchaseOrders);
router.get("/purchaseorders/:id", getPurchaseOrderById);
router.put("/purchaseorders/:id", updatePurchaseOrder);
router.delete("/purchaseorders/:id", deletePurchaseOrder);
router.get("/purchaseorders/project/:projectId", getPurchaseOrdersByProjectId);


export default router;
