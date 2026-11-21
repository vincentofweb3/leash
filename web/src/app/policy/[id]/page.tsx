import type { Metadata } from "next";
import { PolicyClient } from "./PolicyClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Policy #${id}`,
    description: `Onchain spend policy #${id} on QDay Aevum testnet: remaining budget, caps, vendors and every spend.`,
  };
}

export default function PolicyPage() {
  return <PolicyClient />;
}
