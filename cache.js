const fs = require("fs");
const path = require("path");

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = path.join(__dirname, "data");

// A scrape takes up to 60s of function time, so only one may be in flight at
// a time per city/card. Anything else falls back to the last good data.
const LOCK_TTL_MS = 90 * 1000;

function slugFor(city, card) {
  return `${city}_${card}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function cacheKey(city, card) {
  const date = new Date().toISOString().slice(0, 10);
  return `cache-${date}-${slugFor(city, card)}.json`;
}

function lockKey(city, card) {
  return `scrape-lock-${slugFor(city, card)}.json`;
}

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || "";
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function readBlobJson(key, token) {
  const { get } = require("@vercel/blob");
  const result = await get(key, { access: "private", token });
  return JSON.parse(await streamToString(result.stream));
}

function isNotFound(err) {
  return err.code === "blob_not_found" || err.message?.includes("not found");
}

// ── Today's cache only ──
async function getCache(city, card) {
  if (IS_VERCEL) {
    const token = getBlobToken();
    if (!token) {
      console.error("[Cache] BLOB_READ_WRITE_TOKEN is not set!");
      return null;
    }
    try {
      const key = cacheKey(city, card);
      const data = await readBlobJson(key, token);
      console.log(`[Cache] Loaded ${data.totalDeals} deals from ${key}`);
      return data;
    } catch (err) {
      if (isNotFound(err)) {
        console.log("[Cache] No cached data for today");
        return null;
      }
      console.error("[Cache] Read error:", err.message);
      return null;
    }
  }

  const filePath = path.join(DATA_DIR, "deals.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const today = new Date().toISOString().slice(0, 10);
    if (
      data.scrapedAt?.slice(0, 10) === today &&
      data.filters?.city === city &&
      data.filters?.card === card
    ) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Today's cache, else the most recent cache we have ──
//
// Serving slightly stale deals is far better than having every visitor trigger
// a 60s scrape during the window before the daily cron has run.
async function getCacheOrLatest(city, card) {
  const fresh = await getCache(city, card);
  if (fresh) return fresh;

  if (IS_VERCEL) {
    const token = getBlobToken();
    if (!token) return null;
    try {
      const { list } = require("@vercel/blob");
      const suffix = `-${slugFor(city, card)}.json`;
      const matches = [];
      let cursor;
      do {
        const result = await list({ prefix: "cache-", token, cursor });
        for (const blob of result.blobs) {
          if (blob.pathname.endsWith(suffix)) matches.push(blob.pathname);
        }
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);

      if (!matches.length) return null;
      matches.sort();
      const latest = matches[matches.length - 1];
      const data = await readBlobJson(latest, token);
      console.log(`[Cache] Serving stale data from ${latest}`);
      return { ...data, stale: true };
    } catch (err) {
      console.error("[Cache] Stale lookup error:", err.message);
      return null;
    }
  }

  const filePath = path.join(DATA_DIR, "deals.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (data.filters?.city === city && data.filters?.card === card) {
      return { ...data, stale: true };
    }
    return null;
  } catch {
    return null;
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
      const blob = await put(key, body, {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });
      console.log(`[Cache] Saved ${key} (${body.length} bytes) -> ${blob.url}`);
    } catch (err) {
      console.error("[Cache] Write error:", err.message);
    }
    return;
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  fs.writeFileSync(
    path.join(DATA_DIR, "deals.json"),
    JSON.stringify(data, null, 2)
  );
}

// ── Scrape lock ──
async function isScrapeLocked(city, card) {
  if (!IS_VERCEL) return false;
  const token = getBlobToken();
  if (!token) return false;
  try {
    const lock = await readBlobJson(lockKey(city, card), token);
    return Date.now() - lock.at < LOCK_TTL_MS;
  } catch (err) {
    if (!isNotFound(err)) console.error("[Lock] Read error:", err.message);
    return false;
  }
}

async function setScrapeLock(city, card) {
  if (!IS_VERCEL) return;
  const token = getBlobToken();
  if (!token) return;
  try {
    const { put } = require("@vercel/blob");
    await put(lockKey(city, card), JSON.stringify({ at: Date.now() }), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    });
  } catch (err) {
    console.error("[Lock] Write error:", err.message);
  }
}

module.exports = {
  getCache,
  getCacheOrLatest,
  setCache,
  isScrapeLocked,
  setScrapeLock,
};
