module.exports = async (req, res) => {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const isVercel = !!process.env.VERCEL;

  const info = {
    isVercel,
    hasBlobToken: hasToken,
    tokenPrefix: hasToken ? process.env.BLOB_READ_WRITE_TOKEN.substring(0, 10) + "..." : "NOT SET",
  };

  if (hasToken && isVercel) {
    try {
      const { put, get, list, del } = require("@vercel/blob");
      const token = process.env.BLOB_READ_WRITE_TOKEN;

      // Write test
      const testBlob = await put("_cache-test.json", JSON.stringify({ test: true, ts: Date.now() }), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });
      info.writeTest = { success: true, url: testBlob.url };

      // List test
      const { blobs } = await list({ prefix: "_cache-test", token });
      info.listTest = { success: true, found: blobs.length };

      // Read test using get()
      const result = await get("_cache-test.json", { access: "private", token });
      const chunks = [];
      for await (const chunk of result.stream) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
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
