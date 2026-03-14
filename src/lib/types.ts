export interface Deal {
  merchantName: string;
  discount: string;
  validDays: string;
  maxCap: string;
  city?: string;
  card?: string;
  category?: string;
  imageUrl?: string | null;
  rawText?: string;
  allDeals?: { discount: string; validDays: string; maxCap: string }[];
}

export interface DealsData {
  scrapedAt: string;
  filters: {
    city: string;
    card: string;
  };
  totalDeals: number;
  deals: Deal[];
}

export function filterDeals(
  deals: Deal[],
  search: string,
  dayFilter: string
): Deal[] {
  let filtered = [...deals];

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (d) =>
        d.merchantName.toLowerCase().includes(q) ||
        d.discount.toLowerCase().includes(q) ||
        (d.category && d.category.toLowerCase().includes(q))
    );
  }

  if (dayFilter && dayFilter !== "All") {
    filtered = filtered.filter(
      (d) =>
        d.validDays.toLowerCase().includes(dayFilter.toLowerCase()) ||
        d.validDays === "Everyday" ||
        d.validDays === "Daily" ||
        d.validDays === "All Days" ||
        d.validDays === "N/A"
    );
  }

  return filtered;
}
