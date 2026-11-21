import type { Address, Hash, Hex } from "viem";

export interface SpendJson {
  policyId: string;
  vendor: Address;
  amount: string;
  purposeHash: Hex;
  nonce: Hex;
  spentAfter: string;
  tx: Hash;
  block: string;
  logIndex: number;
}

export interface SpendHistoryJson {
  head: string | null;
  source: "explorer" | "rpc";
  complete: boolean;
  fetchedAt: number;
  spends: SpendJson[];
}

export interface SpendRow {
  policyId: bigint;
  vendor: Address;
  amount: bigint;
  purposeHash: Hex;
  nonce: Hex;
  spentAfter: bigint;
  tx: Hash;
  block: bigint;
  logIndex: number;
}

export interface SpendHistory {
  head: bigint | null;
  source: "explorer" | "rpc";
  complete: boolean;
  fetchedAt: number;
  spends: SpendRow[];
}

function toRow(s: SpendJson): SpendRow {
  return {
    policyId: BigInt(s.policyId),
    vendor: s.vendor,
    amount: BigInt(s.amount),
    purposeHash: s.purposeHash,
    nonce: s.nonce,
    spentAfter: BigInt(s.spentAfter),
    tx: s.tx,
    block: BigInt(s.block),
    logIndex: Number(s.logIndex ?? 0),
  };
}

export async function fetchSpendHistory(options: { policyId?: bigint; refresh?: boolean } = {}): Promise<SpendHistory> {
  const params = new URLSearchParams();
  if (options.policyId !== undefined) params.set("policy", options.policyId.toString());
  if (options.refresh) params.set("refresh", "1");
  const query = params.size > 0 ? `?${params.toString()}` : "";

  const res = await fetch(`/api/spends${query}`, { cache: "no-store" });
  const body = (await res.json()) as SpendHistoryJson & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Spend history unavailable (${res.status}).`);

  return {
    head: body.head === null ? null : BigInt(body.head),
    source: body.source,
    complete: body.complete,
    fetchedAt: body.fetchedAt,
    spends: (body.spends ?? []).map(toRow),
  };
}
