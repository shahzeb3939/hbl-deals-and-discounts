import { loadDeals } from "@/lib/deals";
import DealsPageClient from "@/components/DealsPageClient";

export const dynamic = "force-dynamic";

export default function Home() {
  const data = loadDeals();
  return <DealsPageClient initialData={data} />;
}
