import { NextResponse } from "next/server";
import { getOverview } from "@/lib/chain-read";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let overview = await getOverview();
    if (!overview.complete) overview = await getOverview(true);
    return NextResponse.json(
      {
        ...overview,
        head: overview.head.toString(),
        deployBlock: overview.deployBlock?.toString(),
        policies: overview.policies.toString(),
        settled: overview.settled.toString(),
        spends: overview.spends.map((s) => ({
          ...s,
          amount: s.amount.toString(),
          spentAfter: s.spentAfter.toString(),
          block: s.block.toString(),
          policyId: s.policyId.toString(),
        })),
        policy0: overview.policy0
          ? {
              ...overview.policy0,
              policyId: overview.policy0.policyId.toString(),
              perTxCap: overview.policy0.perTxCap.toString(),
              budget: overview.policy0.budget.toString(),
              spent: overview.policy0.spent.toString(),
              dailyCap: overview.policy0.dailyCap.toString(),
              daySpent: overview.policy0.daySpent.toString(),
              expiry: overview.policy0.expiry.toString(),
            }
          : null,
      },
      { headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=300" } },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "RPC unavailable" }, { status: 503 });
  }
}
