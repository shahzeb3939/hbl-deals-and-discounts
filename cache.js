const fs = require("fs");
const path = require("path");

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = path.join(__dirname, "data");

function cacheKey(city, card) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const slug = `${city}_${card}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `deals/${date}/${slug}.json`;
}

async function getCache(city, card) {
  if (IS_VERCEL) {
    try {
      const { list } = require("@vercel/blob");
      const key = cacheKey(city, card);
      const { blobs } = await list({ prefix: key, limit: 1 });
      if (blobs.length === 0) return null;
      const res = await fetch(blobs[0].url);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error("Cache read error:", err.message);
      return null;
    }
  } else {
    const filePath = path.join(DATA_DIR, "deals.json");
    if (!fs.existsSync(filePath)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      // Check if cached data is from today and matches filters
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
      await put(key, JSON.stringify(data), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
      });
      console.log(`Cache saved: ${key}`);
    } catch (err) {
      console.error("Cache write error:", err.message);
    }
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    fs.writeFileSync(path.join(DATA_DIR, "deals.json"), JSON.stringify(data, null, 2));
  }
}

module.exports = { getCache, setCache };
