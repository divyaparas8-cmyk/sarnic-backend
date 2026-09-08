import jwt from "jsonwebtoken";

export const generatetoken = (userId, role, companyId) => {
  return jwt.sign(
    {
      id: userId,
      role: role,
      tenant_id: companyId,
      companyId: companyId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );
};
