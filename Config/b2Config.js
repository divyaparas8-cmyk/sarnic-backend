// utils/b2Config.js
import B2 from 'backblaze-b2';

const b2 = new B2({
  applicationKeyId: '0eb294eaae9b', // ✅ Your provided Key ID
  applicationKey: '005a4e96a93c9b5c3baf7cb1a2d4d3918fcc0015e4' // ✅ Your provided App Key
});

// ✅ Optional: Test auth on startup (can be removed in production)
(async () => {
  try {
    const result = await b2.authorize();
    // console.log("✅ B2 Authorization successful");
    // console.log("🔐 Account ID:", result.data.accountId);
    // console.log("📦 Allowed Bucket:", result.data.allowed.bucketName || "All Buckets");
  } catch (error) {
    console.error("❌ B2 Authorization failed:", error.response?.data || error.message);
  }
})();


export default b2;
