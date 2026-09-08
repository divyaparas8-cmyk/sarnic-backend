import express from "express";
import {
  createClientSupplier,
  getAllClientSuppliers,
  getClientSupplierById,
  updateClientSupplier,
  deleteClientSupplier,
  getClientsOnly,
  getSuppliersOnly
} from "../Controllers/clientsupplierCtrl.js";

const router = express.Router();
router.post("/clientsuppliers", createClientSupplier);
router.get("/clientsuppliers", getAllClientSuppliers);
router.get("/clientsuppliers/:id", getClientSupplierById);
router.put("/clientsuppliers/:id", updateClientSupplier);
router.delete("/clientsuppliers/:id", deleteClientSupplier);
router.get("/clients", getClientsOnly);
router.get("/suppliers", getSuppliersOnly);

export default router;
