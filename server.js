require("dotenv").config();
const express = require("express");
const path = require("path");
const cron = require("node-cron");
const { scrapeDeals } = require("./scraper");
const { notify } = require("./notifier");
const { getCache, setCache } = require("./cache");
const { getVisits, appendVisit, listAnalyticsDates } = require("./analytics-store");

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

// Track visitor
app.get("/api/track", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
    await appendVisit({
      ip,
      city: req.headers["x-vercel-ip-city"] || null,
      country: req.headers["x-vercel-ip-country"] || null,
      region: req.headers["x-vercel-ip-country-region"] || null,
      latitude: req.headers["x-vercel-ip-latitude"] || null,
      longitude: req.headers["x-vercel-ip-longitude"] || null,
      userAgent: req.headers["user-agent"] || "",
      referrer: req.headers["referer"] || null,
      path: req.query.path || "/",
      timestamp: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "tracking failed" });
  }
});

// Analytics data
app.get("/api/analytics", async (req, res) => {
  try {
    const dates = await listAnalyticsDates();
    const today = new Date().toISOString().slice(0, 10);

    if (req.query.summary === "true") {
      let totalVisits = 0;
      let todayVisits = 0;
      const dailyCounts = [];
      const countryMap = {};
      const cityMap = {};
      const uniqueIPs = new Set();

      for (const date of dates) {
        const visits = await getVisits(date);
        totalVisits += visits.length;
        if (date === today) todayVisits = visits.length;
        dailyCounts.push({ date, count: visits.length });
        for (const v of visits) {
          uniqueIPs.add(v.ip);
          const country = v.country || "Unknown";
          const city = v.city || "Unknown";
          countryMap[country] = (countryMap[country] || 0) + 1;
          cityMap[city] = (cityMap[city] || 0) + 1;
        }
      }

      return res.json({
        totalVisits,
        todayVisits,
        uniqueVisitors: uniqueIPs.size,
        totalDaysTracked: dates.length,
        dailyCounts: dailyCounts.slice(-30),
        topCountries: Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name, count]) => ({ name, count })),
        topCities: Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([name, count]) => ({ name, count })),
      });
    }

    const targetDate = req.query.date || today;
    const visits = await getVisits(targetDate);
    res.json({ date: targetDate, totalVisits: visits.length, visits });
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
