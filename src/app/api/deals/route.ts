import { NextResponse } from "next/server";
import { loadDeals } from "@/lib/deals";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = loadDeals();
  return NextResponse.json(data);
}
