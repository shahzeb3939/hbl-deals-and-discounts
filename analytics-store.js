const fs = require("fs");
const path = require("path");

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = path.join(__dirname, "data");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function blobKey(date) {
  return `analytics-${date}.json`;
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

// ── Read visits for a given date ──
async function getVisits(date) {
  if (IS_VERCEL) {
    const token = getBlobToken();
    if (!token) return [];
    try {
      const { get } = require("@vercel/blob");
      const result = await get(blobKey(date), { access: "private", token });
      const text = await streamToString(result.stream);
      return JSON.parse(text);
    } catch (err) {
      if (
        err.code === "blob_not_found" ||
        err.message?.includes("not found")
      )
        return [];
      console.error("[Analytics] Read error:", err.message);
      return [];
    }
  } else {
    const filePath = path.join(DATA_DIR, `analytics-${date}.json`);
    if (!fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return [];
    }
  }
}

// ── Append a visit to today's log ──
async function appendVisit(visit) {
  const date = todayKey();
  const visits = await getVisits(date);
  visits.push(visit);

  if (IS_VERCEL) {
    const token = getBlobToken();
    if (!token) return;
    try {
      const { put } = require("@vercel/blob");
      await put(blobKey(date), JSON.stringify(visits), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });
    } catch (err) {
      console.error("[Analytics] Write error:", err.message);
    }
  } else {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
    fs.writeFileSync(
      path.join(DATA_DIR, `analytics-${date}.json`),
      JSON.stringify(visits, null, 2)
    );
  }
}

// ── List all analytics blob keys ──
async function listAnalyticsDates() {
  if (IS_VERCEL) {
    const token = getBlobToken();
    if (!token) return [];
    try {
      const { list } = require("@vercel/blob");
      const dates = [];
      let cursor;
      do {
        const result = await list({
          prefix: "analytics-",
          token,
          cursor,
        });
        for (const blob of result.blobs) {
          const match = blob.pathname.match(/analytics-(\d{4}-\d{2}-\d{2})\.json/);
          if (match) dates.push(match[1]);
        }
        cursor = result.cursor;
      } while (cursor);
      return dates.sort();
    } catch (err) {
      console.error("[Analytics] List error:", err.message);
      return [];
    }
  } else {
    if (!fs.existsSync(DATA_DIR)) return [];
    return fs
      .readdirSync(DATA_DIR)
      .filter((f) => f.startsWith("analytics-") && f.endsWith(".json"))
      .map((f) => f.replace("analytics-", "").replace(".json", ""))
      .sort();
  }
}

module.exports = { getVisits, appendVisit, listAnalyticsDates };
