module.exports = async (req, res) => {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const isVercel = !!process.env.VERCEL;

  const info = {
    isVercel,
    hasBlobToken: hasToken,
    tokenPrefix: hasToken ? process.env.BLOB_READ_WRITE_TOKEN.substring(0, 10) + "..." : "NOT SET",
  };

  // Try a quick blob write/read test
  if (hasToken && isVercel) {
    try {
      const { put, list, del } = require("@vercel/blob");
      const token = process.env.BLOB_READ_WRITE_TOKEN;

      // Write test
      const testBlob = await put("_cache-test.json", JSON.stringify({ test: true, ts: Date.now() }), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        token,
      });
      info.writeTest = { success: true, url: testBlob.url };

      // List test
      const { blobs } = await list({ prefix: "_cache-test", token });
      info.listTest = { success: true, found: blobs.length };

      // Read test
      const fetchRes = await fetch(testBlob.url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await fetchRes.json();
      info.readTest = { success: true, data };

      // Cleanup
      await del(testBlob.url, { token });
      info.cleanupTest = { success: true };
    } catch (err) {
      info.error = err.message;
    }
  }

  res.json(info);
};
