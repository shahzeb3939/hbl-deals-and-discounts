const { scrapeDeals } = require("../scraper");
const { getCache, setCache } = require("../cache");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const city = req.body?.city || process.env.DEFAULT_CITY || "Islamabad";
  const card = req.body?.card || process.env.DEFAULT_CARD || "HBL Platinum CreditCard";

  // Check if we already have today's data for this combo
  const cached = await getCache(city, card);
  if (cached) {
    console.log(`Returning cached data for ${city}/${card}`);
    return res.json(cached);
  }

  try {
    const data = await scrapeDeals(city, card);
    await setCache(city, card, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
