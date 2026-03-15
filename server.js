require("dotenv").config();
const express = require("express");
const path = require("path");
const cron = require("node-cron");
const { scrapeDeals } = require("./scraper");
const { notify } = require("./notifier");
const { getCache, setCache } = require("./cache");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Get cached deals
app.get("/api/deals", async (req, res) => {
  const city = req.query.city || process.env.DEFAULT_CITY || "Islamabad";
  const card = req.query.card || process.env.DEFAULT_CARD || "HBL Platinum CreditCard";

  const cached = await getCache(city, card);
  if (cached) {
    return res.json(cached);
  }
  res.json({ deals: [], totalDeals: 0, message: "No data yet. Click Refresh to scrape." });
});

// Trigger a fresh scrape
app.post("/api/scrape", async (req, res) => {
  const city = req.body.city || process.env.DEFAULT_CITY || "Islamabad";
  const card = req.body.card || process.env.DEFAULT_CARD || "HBL Platinum CreditCard";

  // Return cached data if already scraped today for this combo
  const cached = await getCache(city, card);
  if (cached) {
    return res.json(cached);
  }

  try {
    const data = await scrapeDeals(city, card);
    await setCache(city, card, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger notifications
app.post("/api/notify", async (req, res) => {
  try {
    await notify();
    res.json({ success: true, message: "Notifications sent!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily scheduler — scrape + notify
const schedule = process.env.CRON_SCHEDULE || "0 9 * * *"; // default: 9 AM daily
cron.schedule(schedule, async () => {
  console.log(`[CRON] Running scheduled scrape at ${new Date().toLocaleString()}`);
  try {
    const city = process.env.DEFAULT_CITY || "Islamabad";
    const card = process.env.DEFAULT_CARD || "HBL Platinum CreditCard";
    await scrapeDeals(city, card);
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
