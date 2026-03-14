const fs = require("fs");
const path = require("path");
const https = require("https");

const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(__dirname, "data");

const API_BASE = "https://secure-sdk.peekaboo.guru";
const OWNER_KEY = "0a1755c7e5691a8f3380180979414d31";

const ENDPOINTS = {
  merchants: "/uljin2s3nitoi89njkhklgkj5",
  deals: "/ksbolruuahrndcjchshjhejgjhasdo787kjieo767kjsgeskoyfgwwhkl6",
};

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/plain, */*",
  medium: "IFRAME",
  ownerkey: OWNER_KEY,
  version: "1.0.0",
  Origin: "https://hbl-web.peekaboo.guru",
  Referer: "https://hbl-web.peekaboo.guru/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

function apiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + endpoint);
    const data = JSON.stringify(body);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: { ...HEADERS, "Content-Length": Buffer.byteLength(data) },
    };

    const req = https.request(options, (res) => {
      let chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        try {
          resolve(JSON.parse(text));
        } catch {
          reject(new Error(`API parse error (${res.statusCode}): ${text.substring(0, 200)}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function fetchMerchants(city, pageSize = 100, offset = 0) {
  return apiPost(ENDPOINTS.merchants, {
    fksyd: city,
    n4ja3s: "Pakistan",
    js6nwf: "0",
    pan3ba: "0",
    mstoaw: "en",
    angaks: "all",
    j87asn: "_all",
    makthya: "trending",
    mnakls: pageSize,
    opmsta: String(offset),
    kaiwnua: "_all",
    klaosw: false,
  });
}

async function fetchDeals(city, merchantId, merchantName) {
  return apiPost(ENDPOINTS.deals, {
    fksyd: city,
    n4ja3s: "Pakistan",
    js6nwf: "0",
    pan3ba: "0",
    mstoaw: "en",
    cotuia: merchantId,
    nai3asnu: "All",
    ia3uas: "All",
    kaiwnua: "_all",
    matsw: merchantName,
    yudwq: "_all",
    njsue: "sdk",
    hgoeni: merchantId,
    mnakls: "100",
    opmsta: "0",
    mghes: "true",
    klaosw: false,
    makthya: "discount",
  });
}

function extractMaxCap(description) {
  if (!description) return "";
  const match = description.match(
    /(?:maximum\s+discount\s+of\s+)?(?:pkr|rs\.?)\s*([\d,]+)\/?-?\s*/i
  );
  return match ? `PKR ${match[1]}` : "";
}

function extractValidDays(description) {
  if (!description) return "All Days";
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const found = days.filter((d) => description.toLowerCase().includes(d.toLowerCase()));
  return found.length > 0 ? found.join(", ") : "All Days";
}

async function scrapeDeals(city = "Islamabad", cardFilter = "HBL Platinum CreditCard") {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  console.log(`Fetching deals for: ${city} / ${cardFilter}`);

  // Step 1: Fetch all merchants
  console.log("Fetching merchants...");
  let allMerchants = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const merchants = await fetchMerchants(city, pageSize, offset);
    if (!Array.isArray(merchants) || merchants.length === 0) break;
    allMerchants.push(...merchants);
    console.log(`  Fetched ${allMerchants.length} merchants (page offset ${offset})`);
    if (!merchants[merchants.length - 1]?.nextPage) break;
    offset += pageSize;
  }

  console.log(`Total merchants: ${allMerchants.length}`);

  // Step 2: Fetch deals for each merchant
  console.log("Fetching deals for each merchant...");
  const allDeals = [];

  for (let i = 0; i < allMerchants.length; i++) {
    const m = allMerchants[i];
    if (m.associatedDealCount === 0) continue;

    try {
      const deals = await fetchDeals(city, m.entityId, m.name);
      if (!Array.isArray(deals)) continue;

      for (const deal of deals) {
        const cards = (deal.associations || []).map((a) => a.name);
        const matchesCard =
          cardFilter.toLowerCase() === "all" ||
          cards.some((c) => c.toLowerCase().includes(cardFilter.toLowerCase()));

        allDeals.push({
          merchant: deal.targetEntityName || m.name,
          merchantLogo: deal.targetEntityLogo || m.logo || "",
          discount: deal.title || `${deal.percentageValue}%`,
          percentageValue: deal.percentageValue,
          maxCap: extractMaxCap(deal.description),
          validDays: extractValidDays(deal.description),
          cards,
          matchesCard,
          startDate: deal.startDate,
          endDate: deal.endDate,
          branches: deal.targetBranches || {},
          description: deal.description || "",
          dealId: deal.dealId,
        });
      }

      if ((i + 1) % 10 === 0) {
        console.log(`  Processed ${i + 1}/${allMerchants.length} merchants, ${allDeals.length} deals found`);
      }

      // Small delay to be respectful
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.error(`  Error for ${m.name}: ${err.message}`);
    }
  }

  console.log(`\nTotal deals found: ${allDeals.length}`);

  // Step 3: Filter and sort
  const filteredDeals = cardFilter.toLowerCase() === "all"
    ? allDeals
    : allDeals.filter((d) => d.matchesCard);

  filteredDeals.sort((a, b) => b.percentageValue - a.percentageValue);

  const output = {
    scrapedAt: new Date().toISOString(),
    filters: { city, card: cardFilter },
    totalDeals: filteredDeals.length,
    totalUnfilteredDeals: allDeals.length,
    deals: filteredDeals,
  };

  fs.writeFileSync(path.join(DATA_DIR, "deals.json"), JSON.stringify(output, null, 2));
  console.log(`\nSaved ${filteredDeals.length} matching deals to data/deals.json`);

  return output;
}

// Run directly
if (require.main === module) {
  require("dotenv").config();
  const city = process.argv[2] || process.env.DEFAULT_CITY || "Islamabad";
  const card = process.argv[3] || process.env.DEFAULT_CARD || "HBL Platinum CreditCard";
  scrapeDeals(city, card)
    .then((result) => {
      console.log(`\nDone! ${result.totalDeals} deals for "${card}" in ${city}.`);
      if (result.deals.length > 0) {
        console.log("\nTop deals:");
        result.deals.slice(0, 10).forEach((d, i) => {
          console.log(
            `  ${i + 1}. ${d.merchant} - ${d.discount} | Cap: ${d.maxCap || "N/A"} | Days: ${d.validDays} | Cards: ${d.cards.join(", ")}`
          );
        });
      }
    })
    .catch((err) => {
      console.error("Failed:", err.message);
      process.exit(1);
    });
}

module.exports = { scrapeDeals };
