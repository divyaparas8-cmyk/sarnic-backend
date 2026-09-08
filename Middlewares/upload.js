import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    console.log("Uploaded File Info:", file.originalname, "MIME Type:", file.mimetype);
    if (
        file.mimetype.startsWith("image/") ||
        file.mimetype.startsWith("audio/") ||
        file.mimetype === "application/octet-stream"
    ) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // ✅ Increase limit to 100 MB
    }
});

export default upload;
