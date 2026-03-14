"use client";

import { useState, useMemo } from "react";
import { Deal, DealsData, filterDeals } from "@/lib/types";
import FilterBar from "./FilterBar";
import DealsTable from "./DealsTable";
import DealCard from "./DealCard";

interface DealsPageClientProps {
  initialData: DealsData;
}

export default function DealsPageClient({ initialData }: DealsPageClientProps) {
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const filteredDeals = useMemo(
    () => filterDeals(initialData.deals, search, dayFilter),
    [initialData.deals, search, dayFilter]
  );

  const scrapedDate = new Date(initialData.scrapedAt).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-gray-950 to-teal-900/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              HBL Deals & Discounts
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-sm">
            <div className="flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg px-3 py-1.5">
              <svg
                className="w-4 h-4 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-gray-300">{initialData.filters.city}</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg px-3 py-1.5">
              <svg
                className="w-4 h-4 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <span className="text-gray-300">{initialData.filters.card}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-500 text-xs">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Last updated: {scrapedDate}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Filters */}
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          dayFilter={dayFilter}
          onDayFilterChange={setDayFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          totalDeals={initialData.totalDeals}
          filteredCount={filteredDeals.length}
        />

        {/* Deals Display */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDeals.length > 0 ? (
              filteredDeals.map((deal, index) => (
                <DealCard key={index} deal={deal} index={index} />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
                <svg
                  className="w-16 h-16 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                  />
                </svg>
                <p className="text-lg font-medium">No deals found</p>
                <p className="text-sm mt-1">
                  {initialData.totalDeals === 0
                    ? "Run the scraper first to fetch deals"
                    : "Try adjusting your search or filters"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <DealsTable deals={filteredDeals} />
        )}

        {/* Stats Summary */}
        {initialData.deals.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <StatCard
              label="Total Deals"
              value={String(initialData.totalDeals)}
              icon="deals"
            />
            <StatCard
              label="Best Discount"
              value={getBestDiscount(initialData.deals)}
              icon="discount"
            />
            <StatCard
              label="Unique Merchants"
              value={String(
                new Set(initialData.deals.map((d) => d.merchantName)).size
              )}
              icon="merchants"
            />
            <StatCard
              label="Highest Cap"
              value={getHighestCap(initialData.deals)}
              icon="cap"
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <p>
            Data scraped from{" "}
            <a
              href="https://www.hbl.com/personal/cards/hbl-deals-and-discounts"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-500 hover:text-emerald-400"
            >
              HBL Deals & Discounts
            </a>
          </p>
          <p>
            Run{" "}
            <code className="bg-gray-800 px-1.5 py-0.5 rounded text-emerald-400">
              npm run scrape
            </code>{" "}
            to refresh data
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  const iconColors: Record<string, string> = {
    deals: "text-blue-400",
    discount: "text-emerald-400",
    merchants: "text-purple-400",
    cap: "text-amber-400",
  };

  return (
    <div className="bg-gray-900/60 border border-gray-700/50 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${iconColors[icon] || "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function getBestDiscount(deals: Deal[]): string {
  let best = 0;
  for (const d of deals) {
    const match = d.discount.match(/(\d+)/);
    if (match) {
      const val = parseInt(match[1]);
      if (val > best) best = val;
    }
  }
  return best > 0 ? `${best}%` : "N/A";
}

function getHighestCap(deals: Deal[]): string {
  let highest = 0;
  let highestStr = "N/A";
  for (const d of deals) {
    if (d.maxCap && d.maxCap !== "N/A") {
      const match = d.maxCap.replace(/,/g, "").match(/(\d+)/);
      if (match) {
        const val = parseInt(match[1]);
        if (val > highest) {
          highest = val;
          highestStr = d.maxCap;
        }
      }
    }
  }
  return highestStr;
}
