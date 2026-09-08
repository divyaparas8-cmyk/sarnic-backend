import { pool } from "../Config/dbConnect.js";

export const getTenantSettings = async (req, res) => {
    try {
        const tenant_id = req.tenant_id;
        
        // If no tenant_id is provided, just return the default settings
        if (!tenant_id) {
            return res.status(200).json({
                success: true,
                data: {
                    label_brand: 'Brand',
                    label_sub_brand: 'Sub-Brand',
                    label_flavour: 'Flavour',
                    label_pack_type: 'Pack Type',
                    label_pack_code: 'Pack Code',
                    label_industry: 'Industry',
                    label_client: 'Client',
                    label_job: 'Job',
                    label_project: 'Project'
                }
            });
        }

        const [[settings]] = await pool.query(
            "SELECT * FROM tenant_settings WHERE tenant_id = ?",
            [tenant_id]
        );

        // If no settings exist for the tenant, return defaults
        if (!settings) {
            return res.status(200).json({
                success: true,
                data: {
                    label_brand: 'Brand',
                    label_sub_brand: 'Sub-Brand',
                    label_flavour: 'Flavour',
                    label_pack_type: 'Pack Type',
                    label_pack_code: 'Pack Code',
                    label_industry: 'Industry',
                    label_client: 'Client',
                    label_job: 'Job',
                    label_project: 'Project'
                }
            });
        }

        return res.status(200).json({ success: true, data: settings });
    } catch (error) {
        console.error("Get Tenant Settings Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTenantSettings = async (req, res) => {
    try {
        const tenant_id = req.tenant_id;
        
        if (!tenant_id) {
            return res.status(400).json({ success: false, message: "Tenant ID missing" });
        }

        const {
            label_brand, label_sub_brand, label_flavour, 
            label_pack_type, label_pack_code, label_industry,
            label_client, label_job, label_project
        } = req.body;

        const [[existing]] = await pool.query("SELECT id FROM tenant_settings WHERE tenant_id = ?", [tenant_id]);

        if (existing) {
            await pool.query(
                `UPDATE tenant_settings SET 
                label_brand = COALESCE(?, label_brand),
                label_sub_brand = COALESCE(?, label_sub_brand),
                label_flavour = COALESCE(?, label_flavour),
                label_pack_type = COALESCE(?, label_pack_type),
                label_pack_code = COALESCE(?, label_pack_code),
                label_industry = COALESCE(?, label_industry),
                label_client = COALESCE(?, label_client),
                label_job = COALESCE(?, label_job),
                label_project = COALESCE(?, label_project)
                WHERE tenant_id = ?`,
                [label_brand, label_sub_brand, label_flavour, label_pack_type, label_pack_code, label_industry, label_client, label_job, label_project, tenant_id]
            );
        } else {
            await pool.query(
                `INSERT INTO tenant_settings (
                    tenant_id, label_brand, label_sub_brand, label_flavour, 
                    label_pack_type, label_pack_code, label_industry, 
                    label_client, label_job, label_project
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    tenant_id, 
                    label_brand || 'Brand', label_sub_brand || 'Sub-Brand', label_flavour || 'Flavour', 
                    label_pack_type || 'Pack Type', label_pack_code || 'Pack Code', label_industry || 'Industry',
                    label_client || 'Client', label_job || 'Job', label_project || 'Project'
                ]
            );
        }

        return res.status(200).json({ success: true, message: "Tenant settings updated successfully" });
    } catch (error) {
        console.error("Update Tenant Settings Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getTenantRequirements = async (req, res) => {
    try {
        // Return default requirements tags for the AddEditProject page
        return res.status(200).json({
            success: true,
            data: [
                { name: "UI/UX Design", category: "Design" },
                { name: "SEO", category: "Marketing" },
                { name: "Development", category: "Engineering" },
                { name: "Content Creation", category: "Marketing" },
                { name: "Quality Assurance", category: "Engineering" }
            ]
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
