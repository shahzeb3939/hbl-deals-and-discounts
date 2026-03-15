const { getCache } = require("../cache");

module.exports = async (req, res) => {
  const city = req.query.city || process.env.DEFAULT_CITY || "Islamabad";
  const card = req.query.card || process.env.DEFAULT_CARD || "HBL Platinum CreditCard";

  const cached = await getCache(city, card);
  if (cached) {
    return res.json(cached);
  }

  res.json({ deals: [], totalDeals: 0, message: "No data yet. Click Refresh to scrape." });
};
