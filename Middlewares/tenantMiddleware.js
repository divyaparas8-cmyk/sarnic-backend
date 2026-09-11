import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const requireTenant = (req, res, next) => {
    try {
        if (!process.env.ILLUSTRATOR_API_KEY) {
            dotenv.config();
        }
        const authHeader = req.headers.authorization;
        const apiKeyHeader = req.headers["x-api-key"];
        const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
        const apiToken = authHeader?.startsWith("ApiKey ") ? authHeader.split(" ")[1] : null;

        // Dedicated Read-Only Illustrator API Key Authentication
        const incomingKey = apiKeyHeader || apiToken || bearerToken;
        const configuredApiKey = process.env.ILLUSTRATOR_API_KEY;

        if (configuredApiKey && incomingKey && incomingKey === configuredApiKey) {
            const reqUrl = req.originalUrl || req.url || "";
            const isIllustratorEndpoint = reqUrl.includes("/jobs/illustrator/");
            if (!isIllustratorEndpoint || req.method !== "GET") {
                return res.status(403).json({
                    success: false,
                    message: "Read-only API key is strictly authorized for Illustrator GET endpoints."
                });
            }

            req.user = { role: "illustrator_readonly", id: "api_key" };
            req.tenant_id = parseInt(process.env.ILLUSTRATOR_DEFAULT_TENANT_ID || "1", 10);
            return next();
        }

        const token = bearerToken || authHeader?.split(" ")[1] || req.cookies?.token;
        
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
