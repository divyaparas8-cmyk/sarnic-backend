import express from "express";
import {
  getAllSequences,
  updateSequence,
} from "../Controllers/NumberSequenceCtrl.js";

const router = express.Router();

router.get("/number-sequences", getAllSequences);
router.put("/number-sequences/:id", updateSequence);

export default router;
