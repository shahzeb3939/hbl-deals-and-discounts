"use client";

import { Deal } from "@/lib/types";

interface DealsTableProps {
  deals: Deal[];
}

export default function DealsTable({ deals }: DealsTableProps) {
  if (deals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
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
          Run the scraper first: <code className="bg-gray-800 px-2 py-1 rounded text-emerald-400">npm run scrape</code>
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700/50 shadow-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-800/80 text-gray-300 uppercase tracking-wider text-xs">
            <th className="px-4 py-3 text-left font-semibold">#</th>
            <th className="px-4 py-3 text-left font-semibold">Merchant</th>
            <th className="px-4 py-3 text-left font-semibold">Discount</th>
            <th className="px-4 py-3 text-left font-semibold">Valid Days</th>
            <th className="px-4 py-3 text-left font-semibold">Max Cap</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {deals.map((deal, index) => (
            <tr
              key={index}
              className="hover:bg-gray-800/40 transition-colors duration-150"
            >
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                {index + 1}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {deal.imageUrl && (
                    <img
                      src={deal.imageUrl}
                      alt={deal.merchantName}
                      className="w-8 h-8 rounded-md object-cover bg-gray-700"
                    />
                  )}
                  <span className="font-medium text-white">
                    {deal.merchantName}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {deal.discount}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-300">{deal.validDays}</td>
              <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                {deal.maxCap}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
