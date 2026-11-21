import type { Metadata } from "next";
import { NewPolicyClient } from "./NewPolicyClient";

export const metadata: Metadata = {
  title: "New policy",
  description:
    "Approve exactly the budget and create an onchain spend policy for your AI agent: per-transaction cap, budget, optional daily cap, vendor allowlist and expiry.",
};

export default function NewPolicyPage() {
  return <NewPolicyClient />;
}
