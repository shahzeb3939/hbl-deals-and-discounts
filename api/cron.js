const { scrapeDeals } = require("../scraper");
const { notify } = require("../notifier");
const { setCache } = require("../cache");

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const city = process.env.DEFAULT_CITY || "Islamabad";
    const card = process.env.DEFAULT_CARD || "HBL Platinum CreditCard";
    const data = await scrapeDeals(city, card);
    await setCache(city, card, data);
    await notify();
    res.json({ success: true, message: "Cron: scrape + cache + notify complete", totalDeals: data.totalDeals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
