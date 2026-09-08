# ⚡ Sarnic Backend API Service

Node.js & Express REST API for the **Sarnic SaaS Project Management & Workflow Automation System**.

---

## 🛠 Tech Stack

- **Runtime & Framework**: Node.js (ES Modules), Express.js
- **Database Connection**: MySQL 8 / MariaDB via `mysql2/promise` (Pool)
- **Security & Auth**: JWT (`jsonwebtoken`), Bcrypt password hashing
- **File Processing & Uploads**: Express-FileUpload, Multer, AWS S3 SDK, Cloudinary, ImageKit, Backblaze B2, MegaJS
- **Scheduler & Mail**: Node-Cron (`node-cron`), Nodemailer

---

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables (`.env`)**:
   ```env
   PORT=3004
   JWT_SECRET=your_jwt_secret_key

   # Local Database Config
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=sarniksaas
   ```

3. **Database Migration**:
   Import `sarniksaas.sql` into MySQL:
   ```bash
   mysql -u root -p sarniksaas < ../sarniksaas.sql
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```
   The backend API will start on `http://localhost:3004`.

---

## 📁 Directory Structure

```
sarnic-backend7-8/
├── Config/                  # DB, JWT, and Cloud Storage configurations
├── Controllers/             # API Business logic controllers
├── Middlewares/             # JWT Authentication & authorization middlewares
├── Routers/                 # Express Router modules (/api/s1/...)
├── cron/                    # Scheduled cron jobs (email dispatchers)
├── helpers/ & utils/        # Utility helpers and file handling
├── uploads/                 # Local directory for uploaded assets
├── app.js                   # Main API router setup
├── index.js                 # Server entry point, CORS & middleware initialization
├── create_admin.js          # Helper script to generate initial admin user
└── package.json
```

---

## 📡 Base API Endpoints (`/api/s1`)

- `POST /api/s1/login` - User Login
- `POST /api/s1/register` - User Registration
- `GET /api/s1/projects` - List all projects
- `GET /api/s1/jobs` - List assigned jobs
- `GET /api/s1/invoices` - Invoicing endpoints
- `GET /api/s1/time-logs` - Retrieve time logs
- `GET /api/s1/client-suppliers` - Client and supplier list
- `GET /api/s1/tenant-settings` - Tenant preferences & configurations
