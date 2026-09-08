import express from "express";
import {
   
    createUser,
    deleteUser,
    getUsers,
    changePassword,
    getUserById,
    updateUser,
    login,
    getProductionUsers,
    getEmployeeUsers
} from "../Controllers/AuthCtrl.js";
const router = express.Router();
router.post("/users", createUser);
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.put("/users/change-password/:id", changePassword);
router.post("/auth/login", login);
router.get("/production", getProductionUsers);
router.get("/employee", getEmployeeUsers);

export default router;


