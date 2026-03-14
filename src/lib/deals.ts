import fs from "fs";
import path from "path";
import type { DealsData } from "./types";

const DATA_FILE = path.join(process.cwd(), "data", "deals.json");

export function loadDeals(): DealsData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to load deals:", e);
  }

  return {
    scrapedAt: new Date().toISOString(),
    filters: { city: "Islamabad", card: "HBL Platinum CreditCard" },
    totalDeals: 0,
    deals: [],
  };
}
