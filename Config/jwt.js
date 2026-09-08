import jwt from 'jsonwebtoken';
import "dotenv/config";

export const generatetoken = async (id) => {
    return await jwt.sign({ id }, process.env.JWT_SECRET || "gautamrehansssss", { expiresIn: "1d" });
};