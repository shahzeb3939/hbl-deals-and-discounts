#!/usr/bin/env node

/**
 * HBL Deals & Discounts Scraper
 *
 * Two-phase approach:
 *   Phase 1: Peekaboo REST API to get all merchants + discount % (fast, no browser)
 *   Phase 2: Puppeteer to navigate the Peekaboo widget, select card filter,
 *            and click each merchant to scrape per-deal details (days, max cap)
 *
 * The HBL deals page embeds an iframe from hbl-web.peekaboo.guru.
 * The Peekaboo API is at secure-sdk.peekaboo.guru with ownerkey auth.
 */

const puppeteer = require("puppeteer-core");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PEEKABOO_API = "secure-sdk.peekaboo.guru";
const PEEKABOO_OWNER_KEY = "0a1755c7e5691a8f3380180979414d31";
const PEEKABOO_WIDGET_URL = "https://hbl-web.peekaboo.guru";
const ENDPOINTS = {
  merchants: "uljin2s3nitoi89njkhklgkj5",
  cards: "saovrumensjlqdsaiocassasdasociasdasdtns",
  categories: "kcjaastndoeauisgjod78oqnkkasrd7asAsky5",
  cities: "klaoshcjanaij2ktnbjkmiasvtafoabxtenstn5",
};

const CHROME_PATH =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "deals.json");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Peekaboo REST API ───────────────────────────────────────────────────────

function apiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: PEEKABOO_API,
      path: "/" + endpoint,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ownerkey: PEEKABOO_OWNER_KEY,
        medium: "IFRAME",
        version: "1.0.0",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error("Invalid JSON from API: " + body.substring(0, 200)));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function fetchMerchants(city, country = "Pakistan") {
  console.log(`📡 Fetching merchants for ${city} via API...`);
  const data = await apiPost(ENDPOINTS.merchants, {
    fksyd: city,
    n4ja3s: country,
    js6nwf: "0",
    pan3ba: "0",
    mstoaw: "en",
    angaks: "all",
    j87asn: "_all",
    makthya: "discount",
    mnakls: 500,
    opmsta: "0",
    kaiwnua: "_all",
    klaosw: false,
  });
  if (!Array.isArray(data)) {
    throw new Error("Unexpected API response: " + JSON.stringify(data).substring(0, 200));
  }
  console.log(`   Found ${data.length} merchants`);
  return data;
}

async function fetchCards(city, country = "Pakistan") {
  console.log(`📡 Fetching card types via API...`);
  const data = await apiPost(ENDPOINTS.cards, {
    fksyd: city,
    n4ja3s: country,
    js6nwf: "0",
    pan3ba: "0",
    mstoaw: "en",
    mnakls: "50",
    opmsta: "0",
  });
  return Array.isArray(data) ? data : [];
}

// ─── Puppeteer-based deal detail scraping ────────────────────────────────────

async function scrapeDetailedDeals(city, cardName, headless, debug) {
  // Phase 1: Use the reliable API to get the merchant list
  console.log("📡 Phase 1: Fetching merchant list via API...");
  const merchants = await fetchMerchants(city);
  const apiDeals = merchants
    .filter((m) => m.associatedDealCount > 0 || m.maxDiscount > 0)
    .map((m) => ({
      merchantName: m.name,
      discount: m.maxDiscount ? `${m.discountFlag || "Up to"} ${m.maxDiscount}%` : "N/A",
      slug: m.slug,
      entityId: m.entityId,
      imageUrl: m.logo || null,
    }));
  console.log(`   Got ${apiDeals.length} merchants from API`);

  // Phase 2: Use Puppeteer to visit each merchant's detail page directly
  console.log(`\n🚀 Phase 2: Launching Chrome for deal details...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: headless ? "new" : false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const deals = [];
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    for (let idx = 0; idx < apiDeals.length; idx++) {
      const merchant = apiDeals[idx];
      process.stdout.write(`   [${idx + 1}/${apiDeals.length}] ${merchant.merchantName}... `);

      // Navigate directly to the merchant detail page on peekaboo.guru
      const detailUrl = `https://peekaboo.guru/${city.toLowerCase()}/detail/${merchant.entityId}/${merchant.slug}/discounts`;
      try {
        await page.goto(detailUrl, { waitUntil: "networkidle2", timeout: 20000 });
      } catch {
        // Timeout is OK — the SPA may still be loading but we can try to extract
      }
      await delay(3000);

      // Extract deal details from the rendered page
      const detail = await page.evaluate((targetCard) => {
        const text = document.body.innerText || "";
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

        const dealBlocks = [];
        let current = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Match "15% off", "FLAT 40% off on Every Wednesday & Thursday"
          const discMatch = line.match(/^(?:FLAT\s+)?(\d+)%\s*off(.*)$/i);
          if (discMatch) {
            if (current) dealBlocks.push(current);
            const pct = discMatch[1] + "%";
            const rest = (discMatch[2] || "").trim();
            current = { discount: pct, cards: [], rawLine: line, validDays: "N/A", maxCap: "N/A" };

            const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            const foundDays = dayNames.filter((d) => rest.toLowerCase().includes(d.toLowerCase()));
            if (foundDays.length > 0) {
              current.validDays = foundDays.join(", ");
            } else if (/every\s*day|daily|all\s*days/i.test(rest)) {
              current.validDays = "Everyday";
            }
            if (/^FLAT/i.test(line)) current.discount = "Flat " + pct;

            const capMatch = rest.match(/(?:max|cap|upto|up\s*to|saving|limit)\D{0,10}(?:rs\.?|pkr\.?)?\s*([\d,]+)/i);
            if (capMatch) current.maxCap = "Rs. " + capMatch[1].replace(/,/g, "");
            continue;
          }

          // Standalone "Up to\n15%" in header
          if (line === "Up to" && i + 1 < lines.length && /^\d+%$/.test(lines[i + 1])) {
            if (current) dealBlocks.push(current);
            current = { discount: "Up to " + lines[i + 1], cards: [], rawLine: line + " " + lines[i + 1], validDays: "N/A", maxCap: "N/A" };
            i++;
            continue;
          }

          if (current && /^HBL\s/.test(line)) { current.cards.push(line); continue; }

          if (current) {
            const capLine = line.match(/(?:max|maximum|cap|saving|capped|limit)\D{0,10}(?:rs\.?|pkr\.?)?\s*([\d,]+)/i);
            if (capLine) { current.maxCap = "Rs. " + capLine[1].replace(/,/g, ""); continue; }
          }
        }
        if (current) dealBlocks.push(current);

        // Find the deal for target card
        let matchedDeal = null;
        for (const block of dealBlocks) {
          if (block.cards.some((c) => c.toLowerCase().includes(targetCard.toLowerCase()))) {
            matchedDeal = block;
            break;
          }
        }
        if (!matchedDeal && dealBlocks.length > 0) matchedDeal = dealBlocks[0];

        return {
          matchedDeal,
          allDeals: dealBlocks.map((b) => ({
            discount: b.discount, validDays: b.validDays, maxCap: b.maxCap,
            cards: b.cards, rawLine: b.rawLine,
          })),
        };
      }, cardName);

      const matched = detail.matchedDeal;
      const dealEntry = {
        merchantName: merchant.merchantName,
        discount: matched ? matched.discount : merchant.discount,
        validDays: matched ? matched.validDays : "N/A",
        maxCap: matched ? matched.maxCap : "N/A",
        category: "N/A",
        imageUrl: merchant.imageUrl,
      };
      if (detail.allDeals && detail.allDeals.length > 1) {
        dealEntry.allDeals = detail.allDeals;
      }

      deals.push(dealEntry);
      console.log(`${dealEntry.discount} | ${dealEntry.validDays} | ${dealEntry.maxCap}`);
    }
  } finally {
    await browser.close();
  }

  return deals;
}

// ─── Main scrape function ────────────────────────────────────────────────────

async function scrapeDeals(options = {}) {
  const {
    city = "Islamabad",
    card = "HBL Platinum CreditCard",
    headless = true,
    debug = false,
    fast = false,
  } = options;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let deals;

  if (fast) {
    // Fast mode: API-only, no per-merchant details
    console.log("⚡ Fast mode: using API only (no deal details)");
    const merchants = await fetchMerchants(city);
    const cards = await fetchCards(city);

    // Find matching card
    const matchedCard = cards.find((c) =>
      c.typeName && c.typeName.toLowerCase().includes(card.toLowerCase())
    );
    console.log(`   Card match: ${matchedCard ? matchedCard.typeName : "none (showing all)"}`);

    deals = merchants
      .filter((m) => m.associatedDealCount > 0 || m.maxDiscount > 0)
      .map((m) => ({
        merchantName: m.name,
        discount: m.maxDiscount ? `${m.discountFlag || "Up to"} ${m.maxDiscount}%` : "N/A",
        validDays: "N/A",
        maxCap: "N/A",
        category: "N/A",
        imageUrl: m.logo || null,
        slug: m.slug,
        entityId: m.entityId,
        branches: m.totalBranches || 0,
      }));
  } else {
    // Full mode: API listing + Puppeteer for deal details
    deals = await scrapeDetailedDeals(city, card, headless, debug);
  }

  // Sort by max discount descending
  deals.sort((a, b) => {
    const getNum = (d) => { const m = (d.discount || "").match(/(\d+)/); return m ? parseInt(m[1]) : 0; };
    return getNum(b) - getNum(a);
  });

  // Build output
  const output = {
    scrapedAt: new Date().toISOString(),
    filters: { city, card },
    totalDeals: deals.length,
    deals,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\n✅ Scraped ${deals.length} deals. Saved to ${OUTPUT_FILE}`);

  return output;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    city: "Islamabad",
    card: "HBL Platinum CreditCard",
    headless: !args.includes("--headed"),
    debug: args.includes("--debug"),
    fast: args.includes("--fast"),
  };

  const cityIdx = args.indexOf("--city");
  if (cityIdx !== -1 && args[cityIdx + 1]) options.city = args[cityIdx + 1];

  const cardIdx = args.indexOf("--card");
  if (cardIdx !== -1 && args[cardIdx + 1]) options.card = args[cardIdx + 1];

  console.log(`\n🏦 HBL Deals & Discounts Scraper`);
  console.log(`   City: ${options.city}`);
  console.log(`   Card: ${options.card}`);
  console.log(`   Mode: ${options.fast ? "Fast (API only)" : options.headless ? "Full (headless)" : "Full (headed)"}\n`);

  scrapeDeals(options)
    .then((result) => {
      console.log(`\n📊 Summary: ${result.totalDeals} deals found for ${options.city} / ${options.card}`);
      if (result.deals.length > 0) {
        console.log("\nTop deals:");
        result.deals.slice(0, 5).forEach((d, i) => {
          console.log(`  ${i + 1}. ${d.merchantName} - ${d.discount} (${d.validDays}) Cap: ${d.maxCap}`);
        });
      }
    })
    .catch((err) => {
      console.error("Failed:", err.message);
      process.exit(1);
    });
}

module.exports = { scrapeDeals };
