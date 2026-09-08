import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import routes from "./app.js";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import "./cron/dailyEmailSender.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
app.get("/api/ics-proxy", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "URL required" });
    }
    const response = await fetch(url);
    const text = await response.text();
    res.setHeader("Content-Type", "text/calendar");
    res.send(text);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "sarnic-latest-one.netlify.app", "https://project.phoenix-dezign.com", "https://sarnicss.netlify.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(morgan("dev"));
app.use(cookieParser());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "./tmp",
    createParentPath: true,
  })
);
app.use(express.static(path.join(path.resolve(), "public")));
app.use('/uploads', express.static(path.join(path.resolve(), 'uploads')));
app.use(routes);
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
