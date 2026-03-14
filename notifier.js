const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "deals.json");

function loadDeals() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error("No deals data found. Run the scraper first: npm run scrape");
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function formatDealsText(data) {
  const lines = [
    `HBL Deals & Discounts`,
    `City: ${data.filters.city} | Card: ${data.filters.card}`,
    `Scraped: ${new Date(data.scrapedAt).toLocaleString()}`,
    `Total: ${data.totalDeals} deals`,
    `${"—".repeat(50)}`,
    "",
  ];

  data.deals.forEach((d, i) => {
    lines.push(`${i + 1}. ${d.merchant}`);
    lines.push(`   Discount: ${d.discount} | Cap: ${d.maxCap || "N/A"}`);
    lines.push(`   Valid: ${d.validDays}`);
    lines.push("");
  });

  return lines.join("\n");
}

function formatDealsHTML(data) {
  const rows = data.deals
    .map(
      (d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${d.merchant}</strong></td>
      <td>${d.discount}</td>
      <td>${d.validDays}</td>
      <td>${d.maxCap || "N/A"}</td>
    </tr>`
    )
    .join("");

  return `
    <h2>HBL Deals & Discounts</h2>
    <p><strong>City:</strong> ${data.filters.city} | <strong>Card:</strong> ${data.filters.card}</p>
    <p><strong>Scraped:</strong> ${new Date(data.scrapedAt).toLocaleString()} | <strong>Total:</strong> ${data.totalDeals} deals</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; font-family:sans-serif;">
      <tr style="background:#1a5632;color:white;">
        <th>#</th><th>Merchant</th><th>Discount</th><th>Valid Days</th><th>Max Cap</th>
      </tr>
      ${rows}
    </table>
  `;
}

// ---- Email via Nodemailer ----
async function sendEmail(data) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject: `HBL Deals - ${data.filters.city} - ${data.totalDeals} offers (${new Date().toLocaleDateString()})`,
    text: formatDealsText(data),
    html: formatDealsHTML(data),
  });

  console.log(`Email sent to ${process.env.EMAIL_TO}`);
}

// ---- Discord via Webhook (free) ----
async function sendDiscord(data) {
  const https = require("https");

  const webhookUrl = process.env.DISCORD_WEBHOOK;
  if (!webhookUrl) {
    throw new Error("DISCORD_WEBHOOK required in .env");
  }

  const deals = data.deals.slice(0, 25);
  const embeds = [{
    title: `HBL Deals & Discounts — ${data.filters.city}`,
    description: `**Card:** ${data.filters.card}\n**Total Deals:** ${data.totalDeals}\n**Scraped:** ${new Date(data.scrapedAt).toLocaleString()}`,
    color: 0x1a5632,
    fields: deals.map((d, i) => ({
      name: `${i + 1}. ${d.merchant} — ${d.discount}`,
      value: `Cap: ${d.maxCap || "N/A"} | Days: ${d.validDays || "All Days"}`,
      inline: false,
    })),
    footer: { text: `Showing top ${deals.length} of ${data.totalDeals} deals` },
  }];

  const payload = JSON.stringify({
    username: "HBL Deals Bot",
    embeds,
  });

  const url = new URL(webhookUrl);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          console.log("Discord notification sent!");
          resolve(body);
        } else {
          reject(new Error(`Discord error (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function notify() {
  const data = loadDeals();

  if (data.totalDeals === 0) {
    console.log("No deals to send.");
    return;
  }

  if (process.env.EMAIL_ENABLED === "true") {
    try {
      await sendEmail(data);
    } catch (err) {
      console.error("Email failed:", err.message);
    }
  } else {
    console.log("Email disabled. Set EMAIL_ENABLED=true in .env");
  }

  if (process.env.DISCORD_ENABLED === "true") {
    try {
      await sendDiscord(data);
    } catch (err) {
      console.error("Discord failed:", err.message);
    }
  } else {
    console.log("Discord disabled. Set DISCORD_ENABLED=true in .env");
  }
}

if (require.main === module) {
  require("dotenv").config();
  notify().catch(console.error);
}

module.exports = { notify, sendEmail, sendDiscord, loadDeals, formatDealsText, formatDealsHTML };
