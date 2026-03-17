const { getVisits, listAnalyticsDates } = require("../analytics-store");

module.exports = async (req, res) => {
  try {
    const dates = await listAnalyticsDates();
    const today = new Date().toISOString().slice(0, 10);

    // Query params
    const requestedDate = req.query.date; // specific date or "all"
    const summary = req.query.summary === "true";

    // If summary mode — return aggregate stats across all dates
    if (summary) {
      let totalVisits = 0;
      let todayVisits = 0;
      const dailyCounts = [];
      const countryMap = {};
      const cityMap = {};
      const uniqueIPs = new Set();

      for (const date of dates) {
        const visits = await getVisits(date);
        totalVisits += visits.length;
        if (date === today) todayVisits = visits.length;
        dailyCounts.push({ date, count: visits.length });

        for (const v of visits) {
          uniqueIPs.add(v.ip);
          const country = v.country || "Unknown";
          const city = v.city || "Unknown";
          countryMap[country] = (countryMap[country] || 0) + 1;
          cityMap[city] = (cityMap[city] || 0) + 1;
        }
      }

      // Sort locations by count descending
      const topCountries = Object.entries(countryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, count]) => ({ name, count }));

      const topCities = Object.entries(cityMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([name, count]) => ({ name, count }));

      return res.json({
        totalVisits,
        todayVisits,
        uniqueVisitors: uniqueIPs.size,
        totalDaysTracked: dates.length,
        dailyCounts: dailyCounts.slice(-30), // last 30 days
        topCountries,
        topCities,
      });
    }

    // If specific date requested
    const targetDate = requestedDate || today;
    const visits = await getVisits(targetDate);

    res.json({
      date: targetDate,
      totalVisits: visits.length,
      visits: visits.map((v) => ({
        ip: v.ip,
        city: v.city,
        country: v.country,
        region: v.region,
        userAgent: v.userAgent,
        referrer: v.referrer,
        path: v.path,
        timestamp: v.timestamp,
      })),
    });
  } catch (err) {
    console.error("[Analytics] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
