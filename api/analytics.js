const { getRecord, listAnalyticsDates } = require("../analytics-store");

// Summary only ever charts the last 30 days, so there is no reason to pull
// every historical record on each request.
const SUMMARY_DAYS = 30;

module.exports = async (req, res) => {
  try {
    const allDates = await listAnalyticsDates();
    const today = new Date().toISOString().slice(0, 10);

    const requestedDate = req.query.date;
    const summary = req.query.summary === "true";

    // Served from the CDN so repeat loads of the dashboard don't re-invoke this.
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");

    if (summary) {
      const dates = allDates.slice(-SUMMARY_DAYS);
      let totalVisits = 0;
      let todayVisits = 0;
      const dailyCounts = [];
      const countryMap = {};
      const cityMap = {};
      const uniqueIPs = new Set();
      let uniqueApprox = false;

      for (const date of dates) {
        const record = await getRecord(date);
        totalVisits += record.total;
        if (date === today) todayVisits = record.total;
        dailyCounts.push({ date, count: record.total });

        for (const [name, count] of Object.entries(record.byCountry || {})) {
          countryMap[name] = (countryMap[name] || 0) + count;
        }
        for (const [name, count] of Object.entries(record.byCity || {})) {
          cityMap[name] = (cityMap[name] || 0) + count;
        }
        for (const ipHash of record.uniqueIps || []) uniqueIPs.add(ipHash);
        if (record.uniqueOverflow) uniqueApprox = true;
      }

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
        uniqueVisitorsApproximate: uniqueApprox,
        totalDaysTracked: allDates.length,
        dailyCounts,
        topCountries,
        topCities,
      });
    }

    const targetDate = requestedDate || today;
    const record = await getRecord(targetDate);

    res.json({
      date: targetDate,
      totalVisits: record.total,
      showing: (record.recent || []).length,
      visits: (record.recent || []).map((v) => ({
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
