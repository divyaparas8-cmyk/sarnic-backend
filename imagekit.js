import ImageKit from "imagekit";
import dotenv from "dotenv";
dotenv.config();

const imagekit = new ImageKit({
  publicKey: "public_N1Cs79av/MNdAu8E/hp3qavMY7Q=",
  privateKey: "private_HFQPf0fAXuoX+OwBT0bvUjMYJp8=",
  urlEndpoint: "https://ik.imagekit.io/0gfl39vyk",
});



export default imagekit;
