import { NextResponse, type NextRequest } from "next/server";
import { getSpendHistory } from "@/lib/spends";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const policyText = params.get("policy");
  const policyId = policyText && /^\d+$/.test(policyText) ? BigInt(policyText) : undefined;
  const force = params.get("refresh") === "1";

  try {
    const history = await getSpendHistory(force);
    const spends = policyId === undefined ? history.spends : history.spends.filter((s) => s.policyId === policyId);
    return NextResponse.json(
      {
        head: history.head?.toString() ?? null,
        source: history.source,
        complete: history.complete,
        fetchedAt: history.fetchedAt,
        spends: spends.map((s) => ({
          policyId: s.policyId.toString(),
          vendor: s.vendor,
          amount: s.amount.toString(),
          purposeHash: s.purposeHash,
          nonce: s.nonce,
          spentAfter: s.spentAfter.toString(),
          tx: s.tx,
          block: s.block.toString(),
          logIndex: s.logIndex,
        })),
      },
      {
        headers: {
          "Cache-Control": force ? "no-store" : "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Spend history unavailable" }, { status: 503 });
  }
}
