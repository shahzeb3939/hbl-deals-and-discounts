const { notify } = require("../notifier");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await notify();
    res.json({ success: true, message: "Notifications sent!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
