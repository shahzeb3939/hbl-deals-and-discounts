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
    makthya: "trending",
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
  console.log(`\n🚀 Launching Chrome to scrape deal details...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: headless ? "new" : false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1920,1080"],
    defaultViewport: { width: 1920, height: 1080 },
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    // Track API responses for deal detail data
    const detailResponses = new Map();
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes(PEEKABOO_API) && response.request().resourceType() === "xhr") {
        try {
          const ct = response.headers()["content-type"] || "";
          if (ct.includes("json")) {
            const text = await response.text();
            if (text.length > 100) {
              detailResponses.set(url, text);
            }
          }
        } catch {}
      }
    });

    console.log(`🌐 Navigating to ${PEEKABOO_WIDGET_URL}...`);
    await page.goto(PEEKABOO_WIDGET_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await delay(3000);

    // Step 1: Click the city
    console.log(`🏙️  Selecting city: ${city}...`);
    await page.evaluate((c) => {
      for (const el of document.querySelectorAll("h3")) {
        if (el.textContent.trim() === c) { el.click(); return; }
      }
    }, city);
    await delay(4000);

    // Step 2: Open card filter and select the target card
    console.log(`💳 Selecting card: ${cardName}...`);
    // Click the "HBL Cards" dropdown
    const cardDropdownClicked = await page.evaluate(() => {
      for (const el of document.querySelectorAll("*")) {
        const t = el.textContent.trim();
        if ((t === "HBL Cards" || t === "All HBL Cards") && el.offsetParent !== null && t.length < 30) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (cardDropdownClicked) {
      await delay(1500);
      // Select the specific card from the dropdown
      await page.evaluate((cn) => {
        for (const el of document.querySelectorAll("*")) {
          const t = el.textContent.trim();
          if (t === cn && el.offsetParent !== null && el.children.length <= 3) {
            el.click();
            return true;
          }
        }
        return false;
      }, cardName);
      await delay(3000);
    }
    console.log(`   Card dropdown clicked: ${cardDropdownClicked}`);

    // Step 3: Click "See More" repeatedly to load all merchants
    console.log(`📜 Loading all merchants...`);
    for (let i = 0; i < 20; i++) {
      const clicked = await page.evaluate(() => {
        for (const el of document.querySelectorAll("*")) {
          const t = el.textContent.trim();
          if (t === "See More" && el.offsetParent !== null && el.children.length <= 2) {
            el.click();
            return true;
          }
        }
        return false;
      });
      if (!clicked) break;
      await delay(2000);
    }

    // Step 4: Extract all merchant cards from the listing
    console.log(`📦 Extracting deal listing...`);
    const listing = await page.evaluate(() => {
      const results = [];
      const text = document.body.innerText || "";
      // Parse the listing: pairs of "MerchantName\nUp to\nX%" or "MerchantName\nX%"
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        // Check if the next lines form a "Up to X%" or "X%" pattern
        let discount = null;
        let prefix = "";
        if (i + 2 < lines.length && lines[i + 1] === "Up to" && /^\d+%$/.test(lines[i + 2])) {
          prefix = "Up to ";
          discount = lines[i + 2];
          // This line is the merchant name
          if (line && !["arrow_back", "Back", "See More", "Enter Keyword", "Trending",
            "All Categories", "HBL Cards", "keyboard_arrow_down", "trending_up",
            "location_on", "credit_cards", "Ramadan Offers"].includes(line) &&
            !/Pakistan$/.test(line) && line.length > 1 && line.length < 100) {
            results.push({ merchantName: line, discount: prefix + discount });
          }
          i += 3;
          continue;
        }
        if (i + 1 < lines.length && /^\d+%$/.test(lines[i + 1])) {
          discount = lines[i + 1];
          if (line && !["arrow_back", "Back", "See More", "Enter Keyword", "Trending",
            "All Categories", "HBL Cards", "keyboard_arrow_down", "trending_up",
            "location_on", "credit_cards", "Ramadan Offers"].includes(line) &&
            !/Pakistan$/.test(line) && line.length > 1 && line.length < 100) {
            results.push({ merchantName: line, discount: discount });
          }
          i += 2;
          continue;
        }
        i++;
      }
      return results;
    });
    console.log(`   Found ${listing.length} merchants in listing`);

    if (debug) {
      const ssPath = path.join(DATA_DIR, "scrape-listing.png");
      await page.screenshot({ path: ssPath, fullPage: true });
      console.log(`   Screenshot: ${ssPath}`);
    }

    // Step 5: Click each merchant to get deal details (days, max cap)
    console.log(`\n🔍 Scraping deal details for each merchant...`);
    const deals = [];

    for (let idx = 0; idx < listing.length; idx++) {
      const merchant = listing[idx];
      process.stdout.write(`   [${idx + 1}/${listing.length}] ${merchant.merchantName}... `);

      // Click the merchant by its name
      const clicked = await page.evaluate((name) => {
        for (const el of document.querySelectorAll("*")) {
          if (el.textContent.trim() === name && el.offsetParent !== null &&
              el.children.length === 0 && el.tagName !== "SCRIPT") {
            el.click();
            return true;
          }
        }
        return false;
      }, merchant.merchantName);

      if (!clicked) {
        console.log("skip (not clickable)");
        deals.push({
          merchantName: merchant.merchantName,
          discount: merchant.discount,
          validDays: "N/A",
          maxCap: "N/A",
          category: "N/A",
          imageUrl: null,
        });
        continue;
      }

      await delay(2500);

      // Extract deal details from the detail page
      const detail = await page.evaluate(() => {
        const text = document.body.innerText || "";
        const dealDetails = [];

        // Look for "Card Discounts" section with individual deal entries
        // Each deal typically shows: discount %, days, max cap/savings
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

        let currentDeal = {};
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Discount percentage
          const discMatch = line.match(/^(\d+)\s*%$/);
          if (discMatch) {
            if (currentDeal.discount) {
              dealDetails.push({ ...currentDeal });
            }
            currentDeal = { discount: discMatch[1] + "%" };
            // Check if previous line was "Up to"
            if (i > 0 && lines[i - 1] === "Up to") {
              currentDeal.discount = "Up to " + currentDeal.discount;
            }
            continue;
          }

          // Days of week
          const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          const dayMatch = dayNames.filter((d) => line.includes(d));
          if (dayMatch.length > 0 && currentDeal.discount) {
            currentDeal.validDays = line;
            continue;
          }
          if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Daily|Everyday|All Days)/i.test(line) && currentDeal.discount) {
            currentDeal.validDays = line;
            continue;
          }

          // Max cap / savings
          const capMatch = line.match(/(?:max|maximum|cap|save|saving|upto|up\s*to|capped|limit)\D{0,10}(?:rs\.?|pkr\.?)?\s*([\d,]+)/i);
          if (capMatch && currentDeal.discount) {
            currentDeal.maxCap = "Rs. " + capMatch[1].replace(/,/g, "");
            continue;
          }
          // Also match "Rs. X" patterns near discount context
          const rsMatch = line.match(/^(?:Rs\.?|PKR\.?)\s*([\d,]+)/i);
          if (rsMatch && currentDeal.discount && !currentDeal.maxCap) {
            currentDeal.maxCap = "Rs. " + rsMatch[1].replace(/,/g, "");
            continue;
          }

          // Valid till dates
          if (/valid\s*till/i.test(line) && currentDeal.discount) {
            currentDeal.validTill = line;
            continue;
          }
        }
        if (currentDeal.discount) dealDetails.push(currentDeal);

        // Also try to get category
        let category = "N/A";
        for (const line of lines) {
          if (["Dining", "Health & Fitness", "Clothing & Footwear", "Travel & Accomodation",
            "Home Decor", "Entertainment", "Beauty & Personal Care", "Electronics",
            "Education", "Automobile", "Grocery", "Photography"].includes(line)) {
            category = line;
            break;
          }
        }

        // Get the main discount info shown at the top
        let mainDiscount = "";
        for (let i = 0; i < Math.min(lines.length, 30); i++) {
          if (/^\d+%$/.test(lines[i])) {
            mainDiscount = (i > 0 && lines[i - 1] === "Up to" ? "Up to " : "") + lines[i];
            break;
          }
        }

        return { dealDetails, category, mainDiscount, pageText: text.substring(0, 3000) };
      });

      // Build the deal entry
      const dealEntry = {
        merchantName: merchant.merchantName,
        discount: detail.mainDiscount || merchant.discount,
        validDays: "N/A",
        maxCap: "N/A",
        category: detail.category || "N/A",
        imageUrl: null,
      };

      // Use the most relevant deal detail
      if (detail.dealDetails.length > 0) {
        const d = detail.dealDetails[0];
        if (d.validDays) dealEntry.validDays = d.validDays;
        if (d.maxCap) dealEntry.maxCap = d.maxCap;
        // If multiple deals, combine info
        if (detail.dealDetails.length > 1) {
          dealEntry.allDeals = detail.dealDetails.map((dd) => ({
            discount: dd.discount || "N/A",
            validDays: dd.validDays || "N/A",
            maxCap: dd.maxCap || "N/A",
          }));
        }
      }

      deals.push(dealEntry);
      console.log(`${dealEntry.discount} | ${dealEntry.validDays} | ${dealEntry.maxCap}`);

      // Go back to listing
      await page.evaluate(() => {
        for (const el of document.querySelectorAll("*")) {
          const t = el.textContent.trim();
          if ((t === "arrow_back" || t === "Back") && el.offsetParent !== null && t.length < 15) {
            el.click();
            return;
          }
        }
        window.history.back();
      });
      await delay(2000);
    }

    return deals;
  } finally {
    await browser.close();
  }
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
