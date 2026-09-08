import jwt from "jsonwebtoken";

export const requireTenant = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1] || req.cookies?.token;
        
        if (!token) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Ensure the token has a tenant_id unless it's a super admin or admin
        if (!decoded.tenant_id && decoded.role !== 'super_admin' && decoded.role !== 'admin') {
            return res.status(403).json({ message: "Tenant context missing. Please login again." });
        }

        req.user = decoded;
        req.tenant_id = decoded.tenant_id;
        
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token", error: error.message });
    }
};
