const { scrapeDeals } = require("../scraper");
const {
  getCache,
  getCacheOrLatest,
  setCache,
  isScrapeLocked,
  setScrapeLock,
} = require("../cache");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const city = req.body?.city || process.env.DEFAULT_CITY || "Islamabad";
  const card = req.body?.card || process.env.DEFAULT_CARD || "HBL Platinum CreditCard";

  res.setHeader("Cache-Control", "no-store");

  // Already scraped today for this combo — nothing to do.
  const cached = await getCache(city, card);
  if (cached) {
    console.log(`Returning cached data for ${city}/${card}`);
    return res.json(cached);
  }

  // A scrape is already running. Serve whatever we have rather than starting a
  // second 60s scrape; without this every concurrent visitor starts their own.
  if (await isScrapeLocked(city, card)) {
    const stale = await getCacheOrLatest(city, card);
    if (stale) return res.json(stale);
    return res.status(429).json({ error: "A refresh is already in progress. Try again shortly." });
  }

  try {
    await setScrapeLock(city, card);
    const data = await scrapeDeals(city, card);
    await setCache(city, card, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
