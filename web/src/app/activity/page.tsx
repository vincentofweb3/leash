import type { Metadata } from "next";
import { getSpendHistory } from "@/lib/spends";
import { spendHistoryToJson, type SpendHistoryJson } from "@/lib/spends-client";
import { defaultNetwork } from "@/lib/env";
import { ActivityClient } from "./ActivityClient";

export const metadata: Metadata = {
  title: "Activity",
  description: "Every tUSD8 spend settled through Leash on QDay Aevum testnet — read straight from public logs.",
};

export const dynamic = "force-dynamic";

async function initialHistory(): Promise<SpendHistoryJson | null> {
  try {
    const history = await Promise.race([
      getSpendHistory(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_500)),
    ]);
    return history ? spendHistoryToJson(history) : null;
  } catch {
    return null;
  }
}

export default async function ActivityPage() {
  const initial = await initialHistory();
  return <ActivityClient initial={initial} initialChainId={defaultNetwork.chain.id} />;
}
