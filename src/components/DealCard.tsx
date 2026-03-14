"use client";

import { Deal } from "@/lib/types";

interface DealCardProps {
  deal: Deal;
  index: number;
}

export default function DealCard({ deal, index }: DealCardProps) {
  return (
    <div className="group relative bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-5 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
      {/* Discount Badge */}
      <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg shadow-emerald-500/30">
        {deal.discount}
      </div>

      {/* Merchant Info */}
      <div className="flex items-start gap-3 mb-4">
        {deal.imageUrl ? (
          <img
            src={deal.imageUrl}
            alt={deal.merchantName}
            className="w-12 h-12 rounded-lg object-cover bg-gray-700 flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
            <span className="text-emerald-400 font-bold text-lg">
              {deal.merchantName.charAt(0)}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-white text-base leading-tight truncate">
            {deal.merchantName}
          </h3>
          {deal.category && (
            <span className="text-xs text-gray-500 mt-0.5 block">
              {deal.category}
            </span>
          )}
        </div>
      </div>

      {/* Deal Details */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <svg
            className="w-4 h-4 text-gray-500 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-gray-300">{deal.validDays}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <svg
            className="w-4 h-4 text-gray-500 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-gray-300">
            Cap: <span className="font-mono text-emerald-400">{deal.maxCap}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
