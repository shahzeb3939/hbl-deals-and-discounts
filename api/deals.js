const { getCacheOrLatest } = require("../cache");

module.exports = async (req, res) => {
  const city = req.query.city || process.env.DEFAULT_CITY || "Islamabad";
  const card = req.query.card || process.env.DEFAULT_CARD || "HBL Platinum CreditCard";

  // Deals change once a day, so let the CDN answer most visitors instead of
  // invoking this function (and a blob read) for every single page load.
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");

  const cached = await getCacheOrLatest(city, card);
  if (cached) {
    return res.json(cached);
  }

  res.json({ deals: [], totalDeals: 0, message: "No data yet. Click Refresh to scrape." });
};
