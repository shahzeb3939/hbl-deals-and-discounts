const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "deals.json");

module.exports = async (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json({ deals: [], totalDeals: 0, message: "No data yet. Click Refresh to scrape." });
  }
  const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  res.json(data);
};
