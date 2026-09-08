import express from "express";
import {
  createInvoice,
  createInvoiceFromEstimate,
  getAllInvoices,
  getInvoiceById,
  getInvoicesByProjectId,
  updateInvoice,
  deleteInvoice,
  getInvoicepdfById
} from "../Controllers/InvoiceCtrl.js";
const router = express.Router();
router.post("/invoices", createInvoice);
router.post("/invoices/from-estimate/:estimateId", createInvoiceFromEstimate);
router.get("/invoices/", getAllInvoices);
router.get("/invoices/project/:projectId", getInvoicesByProjectId);
router.get("/invoices/:id", getInvoiceById);
router.get("/invoices/pdf/:id",getInvoicepdfById)
router.put("/invoices/:id", updateInvoice);
router.delete("/invoices/:id", deleteInvoice);
export default router;
