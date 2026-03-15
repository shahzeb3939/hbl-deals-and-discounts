const fs = require("fs");
const path = require("path");

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = path.join(__dirname, "data");

function cacheKey(city, card) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = `${city}_${card}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `cache_${date}_${slug}.json`;
}

async function getCache(city, card) {
  if (IS_VERCEL) {
    try {
      const { list } = require("@vercel/blob");
      const key = cacheKey(city, card);
      console.log(`[Cache] Looking for blob with prefix: ${key}`);
      const { blobs } = await list({ prefix: key });
      console.log(`[Cache] Found ${blobs.length} blobs matching prefix`);
      if (blobs.length === 0) return null;

      const blobUrl = blobs[0].downloadUrl || blobs[0].url;
      console.log(`[Cache] Fetching blob from: ${blobUrl}`);
      const res = await fetch(blobUrl);
      if (!res.ok) {
        console.error(`[Cache] Fetch failed with status: ${res.status}`);
        return null;
      }
      const data = await res.json();
      console.log(`[Cache] Successfully loaded ${data.totalDeals} deals from cache`);
      return data;
    } catch (err) {
      console.error("[Cache] Read error:", err.message, err.stack);
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
    try {
      const { put } = require("@vercel/blob");
      const key = cacheKey(city, card);
      const body = JSON.stringify(data);
      console.log(`[Cache] Saving blob: ${key} (${body.length} bytes)`);
      const blob = await put(key, body, {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
      });
      console.log(`[Cache] Saved successfully: ${blob.url}`);
    } catch (err) {
      console.error("[Cache] Write error:", err.message, err.stack);
    }
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    fs.writeFileSync(path.join(DATA_DIR, "deals.json"), JSON.stringify(data, null, 2));
  }
}

module.exports = { getCache, setCache };
