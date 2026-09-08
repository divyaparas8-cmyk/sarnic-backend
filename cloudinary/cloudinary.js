import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
    cloud_name: "dujkizzgj",
    api_key: "569649625233973",
    api_secret: "cdiURww9wwIOr7uCE4XxC9KrLlk"
});

export default cloudinary;
