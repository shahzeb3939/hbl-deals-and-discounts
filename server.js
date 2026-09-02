require("dotenv").config();
const express = require("express");
const path = require("path");
const cron = require("node-cron");
const { scrapeDeals } = require("./scraper");
const { notify } = require("./notifier");
const { setCache } = require("./cache");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Mount the same handlers that run as Vercel functions in production, rather
// than a second copy of the logic that can drift out of sync.
app.get("/api/deals", require("./api/deals"));
app.post("/api/scrape", require("./api/scrape"));
app.post("/api/notify", require("./api/notify"));
app.get("/api/track", require("./api/track"));
app.get("/api/analytics", require("./api/analytics"));

// Daily scheduler — scrape + notify (local only; on Vercel this is /api/cron)
const schedule = process.env.CRON_SCHEDULE || "0 9 * * *";
cron.schedule(schedule, async () => {
  console.log(`[CRON] Running scheduled scrape at ${new Date().toLocaleString()}`);
  try {
    const city = process.env.DEFAULT_CITY || "Islamabad";
    const card = process.env.DEFAULT_CARD || "HBL Platinum CreditCard";
    const data = await scrapeDeals(city, card);
    await setCache(city, card, data);
    await notify();
    console.log("[CRON] Scrape + notify complete.");
  } catch (err) {
    console.error("[CRON] Failed:", err.message);
  }
});

app.listen(PORT, () => {
  console.log(`HBL Deals server running at http://localhost:${PORT}`);
  console.log(`Scheduled scrape + notify: ${schedule}`);
});
