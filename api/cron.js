const { scrapeDeals } = require("../scraper");
const { notify } = require("../notifier");
const { setCache } = require("../cache");

module.exports = async (req, res) => {
  // Fail closed. This endpoint runs a 60s scrape and sends mail, so it must
  // never be publicly triggerable — previously auth was skipped entirely when
  // CRON_SECRET was unset. Vercel Cron sends this header automatically.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET is not configured; refusing to run.");
    return res.status(500).json({ error: "CRON_SECRET is not configured" });
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const city = process.env.DEFAULT_CITY || "Islamabad";
    const card = process.env.DEFAULT_CARD || "HBL Platinum CreditCard";
    const data = await scrapeDeals(city, card);
    await setCache(city, card, data);
    await notify();
    res.json({
      success: true,
      message: "Cron: scrape + cache + notify complete",
      totalDeals: data.totalDeals,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
