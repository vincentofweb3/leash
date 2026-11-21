import type { Metadata } from "next";
import { ReceiptClient } from "./ReceiptClient";

export async function generateMetadata({ params }: { params: Promise<{ tx: string }> }): Promise<Metadata> {
  const { tx } = await params;
  return {
    title: `Receipt ${tx.slice(0, 10)}…${tx.slice(-4)}`,
    description: "Leash settlement receipt, verified directly from the QDay Aevum transaction receipt.",
  };
}

export default function ReceiptPage() {
  return <ReceiptClient />;
}
