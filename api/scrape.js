const { scrapeDeals } = require("../scraper");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const city = req.body?.city || process.env.DEFAULT_CITY || "Islamabad";
  const card = req.body?.card || process.env.DEFAULT_CARD || "HBL Platinum CreditCard";

  try {
    const data = await scrapeDeals(city, card);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
