import type { Metadata } from "next";
import { ActivityClient } from "./ActivityClient";

export const metadata: Metadata = {
  title: "Activity",
  description: "Every tUSD8 spend settled through Leash on QDay Aevum testnet — read straight from public logs.",
};

export default function ActivityPage() {
  return <ActivityClient />;
}
