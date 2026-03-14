#!/usr/bin/env node

/**
 * Main orchestrator: Scrape HBL deals and optionally send notifications.
 * 
 * Usage:
 *   node scripts/run.js                          # Scrape with defaults (Islamabad, HBL Platinum CreditCard)
 *   node scripts/run.js --city Lahore             # Different city
 *   node scripts/run.js --card "HBL FuelSaver"    # Different card
 *   node scripts/run.js --notify                  # Scrape + send notifications
 *   node scripts/run.js --notify-only             # Send notifications without scraping (use existing data)
 *   node scripts/run.js --headed --debug          # Run browser in headed mode with debug output
 *   node scripts/run.js --csv                     # Also export to CSV
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { scrapeDeals } = require("./scrape");
const { notifyAll } = require("./notify");

const DATA_DIR = path.join(__dirname, "..", "data");

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    city: "Islamabad",
    card: "HBL Platinum CreditCard",
    headless: !args.includes("--headed"),
    debug: args.includes("--debug"),
    notify: args.includes("--notify"),
    notifyOnly: args.includes("--notify-only"),
    csv: args.includes("--csv"),
    fast: args.includes("--fast"),
    email: !args.includes("--no-email"),
    whatsapp: !args.includes("--no-whatsapp"),
  };

  const cityIdx = args.indexOf("--city");
  if (cityIdx !== -1 && args[cityIdx + 1]) options.city = args[cityIdx + 1];

  const cardIdx = args.indexOf("--card");
  if (cardIdx !== -1 && args[cardIdx + 1]) options.card = args[cardIdx + 1];

  return options;
}

async function exportCSV(data) {
  const { createObjectCsvWriter } = require("csv-writer");

  const csvPath = path.join(DATA_DIR, "deals.csv");
  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: [
      { id: "merchantName", title: "Merchant" },
      { id: "discount", title: "Discount" },
      { id: "validDays", title: "Valid Days" },
      { id: "maxCap", title: "Max Cap" },
      { id: "city", title: "City" },
      { id: "card", title: "Card" },
    ],
  });

  const records = data.deals.map((d) => ({
    ...d,
    city: data.filters.city,
    card: data.filters.card,
  }));

  await csvWriter.writeRecords(records);
  console.log(`📄 CSV exported to ${csvPath}`);
}

async function main() {
  const options = parseArgs();

  console.log("╔══════════════════════════════════════════╗");
  console.log("║     🏦 HBL Deals & Discounts Tool       ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`  City: ${options.city}`);
  console.log(`  Card: ${options.card}`);
  console.log();

  let data;

  if (!options.notifyOnly) {
    // Step 1: Scrape
    console.log("━━━ Step 1: Scraping Deals ━━━\n");
    data = await scrapeDeals({
      city: options.city,
      card: options.card,
      headless: options.headless,
      debug: options.debug,
      fast: options.fast,
    });

    // Step 2: Export to CSV if requested
    if (options.csv) {
      console.log("\n━━━ Step 2: Exporting CSV ━━━\n");
      await exportCSV(data);
    }
  } else {
    // Load existing data
    const dataFile = path.join(DATA_DIR, "deals.json");
    if (!fs.existsSync(dataFile)) {
      console.error("❌ No existing data found. Run scraper first (without --notify-only).");
      process.exit(1);
    }
    data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
    console.log(`📂 Loaded ${data.totalDeals} existing deals from ${dataFile}\n`);
  }

  // Step 3: Notify if requested
  if (options.notify || options.notifyOnly) {
    console.log("\n━━━ Step 3: Sending Notifications ━━━\n");
    await notifyAll({
      email: options.email,
      whatsapp: options.whatsapp,
    });
  }

  console.log("\n✅ Done!");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
