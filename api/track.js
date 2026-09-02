const { appendVisit } = require("../analytics-store");

const BOT_PATTERN = /bot|crawler|spider|crawling|slurp|bingpreview|headless|monitor|curl|wget|python-requests|node-fetch|axios|postman|lighthouse|pingdom|uptime/i;

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  try {
    const userAgent = req.headers["user-agent"] || "";

    // Crawlers hit every page and would otherwise cost a blob read+write each.
    if (!userAgent || BOT_PATTERN.test(userAgent)) {
      return res.json({ ok: true, skipped: "bot" });
    }

    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    await appendVisit({
      ip,
      city: req.headers["x-vercel-ip-city"] || null,
      country: req.headers["x-vercel-ip-country"] || null,
      region: req.headers["x-vercel-ip-country-region"] || null,
      latitude: req.headers["x-vercel-ip-latitude"] || null,
      longitude: req.headers["x-vercel-ip-longitude"] || null,
      userAgent,
      referrer: req.headers["referer"] || null,
      path: req.query.path || "/",
      timestamp: new Date().toISOString(),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("[Track] Error:", err.message);
    res.status(500).json({ error: "tracking failed" });
  }
};
