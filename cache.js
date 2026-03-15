const fs = require("fs");
const path = require("path");

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = path.join(__dirname, "data");

function cacheKey(city, card) {
  const date = new Date().toISOString().slice(0, 10);
  const slug = `${city}_${card}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `cache-${date}-${slug}.json`;
}

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || "";
}

async function getCache(city, card) {
  if (IS_VERCEL) {
    const token = getBlobToken();
    if (!token) {
      console.error("[Cache] BLOB_READ_WRITE_TOKEN is not set!");
      return null;
    }
    try {
      const { list } = require("@vercel/blob");
      const key = cacheKey(city, card);
      console.log(`[Cache] Looking for blob: ${key}`);
      const { blobs } = await list({ prefix: key, token });
      console.log(`[Cache] Found ${blobs.length} blobs`);
      if (blobs.length === 0) return null;

      const blobUrl = blobs[0].url;
      console.log(`[Cache] Fetching: ${blobUrl}`);
      const res = await fetch(blobUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error(`[Cache] Fetch failed: ${res.status} ${res.statusText}`);
        return null;
      }
      const data = await res.json();
      console.log(`[Cache] Loaded ${data.totalDeals} deals from cache`);
      return data;
    } catch (err) {
      console.error("[Cache] Read error:", err.message);
      return null;
    }
  } else {
    const filePath = path.join(DATA_DIR, "deals.json");
    if (!fs.existsSync(filePath)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (data.scrapedAt) {
        const cachedDate = data.scrapedAt.slice(0, 10);
        const today = new Date().toISOString().slice(0, 10);
        if (
          cachedDate === today &&
          data.filters?.city === city &&
          data.filters?.card === card
        ) {
          return data;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

async function setCache(city, card, data) {
  if (IS_VERCEL) {
    const token = getBlobToken();
    if (!token) {
      console.error("[Cache] BLOB_READ_WRITE_TOKEN is not set! Cannot save.");
      return;
    }
    try {
      const { put } = require("@vercel/blob");
      const key = cacheKey(city, card);
      const body = JSON.stringify(data);
      console.log(`[Cache] Saving: ${key} (${body.length} bytes)`);
      const blob = await put(key, body, {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        token,
      });
      console.log(`[Cache] Saved: ${blob.url}`);
    } catch (err) {
      console.error("[Cache] Write error:", err.message);
    }
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    fs.writeFileSync(
      path.join(DATA_DIR, "deals.json"),
      JSON.stringify(data, null, 2)
    );
  }
}

module.exports = { getCache, setCache };
