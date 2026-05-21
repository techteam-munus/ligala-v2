import { NextResponse } from "next/server";
import { api } from "@/lib/api";

type SubscriptionDto = {
  lastPaidAt: string | null;
};

export async function GET() {
  try {
    const { subscription } = await api<{ subscription: SubscriptionDto }>(
      "/lawyer/subscription",
    );
    return NextResponse.json({ lastPaidAt: subscription.lastPaidAt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 },
    );
  }
}
