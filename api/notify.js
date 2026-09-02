const { notify } = require("../notifier");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Sending mail is not something an anonymous caller gets to trigger.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(500).json({ error: "CRON_SECRET is not configured" });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    await notify();
    res.json({ success: true, message: "Notifications sent!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
