const { getAnalytics, appendVisit } = require("../analytics-store");

module.exports = async (req, res) => {
  try {
    const now = new Date();
    const ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "unknown";

    const visit = {
      ip,
      city: req.headers["x-vercel-ip-city"] || null,
      country: req.headers["x-vercel-ip-country"] || null,
      region: req.headers["x-vercel-ip-country-region"] || null,
      latitude: req.headers["x-vercel-ip-latitude"] || null,
      longitude: req.headers["x-vercel-ip-longitude"] || null,
      userAgent: req.headers["user-agent"] || "",
      referrer: req.headers["referer"] || null,
      path: req.query.path || "/",
      timestamp: now.toISOString(),
    };

    await appendVisit(visit);

    // Return a 1x1 transparent pixel (works as tracking pixel too)
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Content-Type", "application/json");
    res.json({ ok: true });
  } catch (err) {
    console.error("[Track] Error:", err.message);
    res.status(500).json({ error: "tracking failed" });
  }
};
