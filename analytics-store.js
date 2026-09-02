const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = path.join(__dirname, "data");

// Caps that keep each daily record a bounded size. Without these the record
// grows with every visit, and since each visit rewrites the whole record the
// blob traffic for a day grows quadratically with traffic.
const RECENT_LIMIT = 50;
const UNIQUE_IP_LIMIT = 1000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function blobKey(date) {
  return `analytics-${date}.json`;
}

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || "";
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(String(ip)).digest("hex").slice(0, 6);
}

function emptyRecord(date) {
  return {
    date,
    total: 0,
    byCountry: {},
    byCity: {},
    byPath: {},
    uniqueIps: [],
    uniqueOverflow: false,
    recent: [],
    updatedAt: null,
  };
}

// Older records were a plain array of visits. Fold one into the current shape
// so historical data keeps showing up on the analytics page.
function normalizeRecord(raw, date) {
  if (Array.isArray(raw)) {
    const record = emptyRecord(date);
    for (const visit of raw) addVisitToRecord(record, visit);
    return record;
  }
  if (!raw || typeof raw !== "object") return emptyRecord(date);
  return { ...emptyRecord(date), ...raw };
}

function addVisitToRecord(record, visit) {
  const country = visit.country || "Unknown";
  const city = visit.city || "Unknown";
  const visitPath = visit.path || "/";

  record.total += 1;
  record.byCountry[country] = (record.byCountry[country] || 0) + 1;
  record.byCity[city] = (record.byCity[city] || 0) + 1;
  record.byPath[visitPath] = (record.byPath[visitPath] || 0) + 1;

  const ipHash = hashIp(visit.ip || "unknown");
  if (!record.uniqueIps.includes(ipHash)) {
    if (record.uniqueIps.length < UNIQUE_IP_LIMIT) {
      record.uniqueIps.push(ipHash);
    } else {
      record.uniqueOverflow = true;
    }
  }

  record.recent.push(visit);
  if (record.recent.length > RECENT_LIMIT) {
    record.recent = record.recent.slice(-RECENT_LIMIT);
  }

  record.updatedAt = new Date().toISOString();
  return record;
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// ── Read the aggregated record for a given date ──
async function getRecord(date) {
  if (IS_VERCEL) {
    const token = getBlobToken();
    if (!token) return emptyRecord(date);
    try {
      const { get } = require("@vercel/blob");
      const result = await get(blobKey(date), { access: "private", token });
      const text = await streamToString(result.stream);
      return normalizeRecord(JSON.parse(text), date);
    } catch (err) {
      if (err.code === "blob_not_found" || err.message?.includes("not found")) {
        return emptyRecord(date);
      }
      console.error("[Analytics] Read error:", err.message);
      return emptyRecord(date);
    }
  }

  const filePath = path.join(DATA_DIR, `analytics-${date}.json`);
  if (!fs.existsSync(filePath)) return emptyRecord(date);
  try {
    return normalizeRecord(JSON.parse(fs.readFileSync(filePath, "utf-8")), date);
  } catch {
    return emptyRecord(date);
  }
}

async function putRecord(date, record) {
  if (IS_VERCEL) {
    const token = getBlobToken();
    if (!token) return;
    try {
      const { put } = require("@vercel/blob");
      await put(blobKey(date), JSON.stringify(record), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        token,
      });
    } catch (err) {
      console.error("[Analytics] Write error:", err.message);
    }
    return;
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  fs.writeFileSync(
    path.join(DATA_DIR, `analytics-${date}.json`),
    JSON.stringify(record, null, 2)
  );
}

// ── Record a visit against today's aggregate ──
async function appendVisit(visit) {
  const date = todayKey();
  const record = await getRecord(date);
  addVisitToRecord(record, visit);
  await putRecord(date, record);
}

// Kept for callers that want the raw (recent) visit list for a date.
async function getVisits(date) {
  const record = await getRecord(date);
  return record.recent;
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
        const result = await list({ prefix: "analytics-", token, cursor });
        for (const blob of result.blobs) {
          const match = blob.pathname.match(/analytics-(\d{4}-\d{2}-\d{2})\.json/);
          if (match) dates.push(match[1]);
        }
        cursor = result.hasMore ? result.cursor : undefined;
      } while (cursor);
      return dates.sort();
    } catch (err) {
      console.error("[Analytics] List error:", err.message);
      return [];
    }
  }

  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith("analytics-") && f.endsWith(".json"))
    .map((f) => f.replace("analytics-", "").replace(".json", ""))
    .sort();
}

module.exports = { getRecord, getVisits, appendVisit, listAnalyticsDates };
