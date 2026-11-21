import "server-only";

import { createPublicClient, formatUnits, http, type Address, type Hex } from "viem";
import { leashAbi } from "@leash/kit";
import { links } from "@aevum-kit/aevum";
import { defaultNetwork } from "./env";
import { getSpendHistory, type SpendEvent } from "./spends";

const CACHE_MS = 45_000;
const MAX_POLICIES = 100;

export type OverviewSpend = SpendEvent;

export interface OverviewPolicy {
  policyId: bigint;
  buyer: Address;
  agent: Address;
  perTxCap: bigint;
  budget: bigint;
  spent: bigint;
  dailyCap: bigint;
  daySpent: bigint;
  expiry: bigint;
  revoked: boolean;
  labelHash: Hex;
  allowlist: Address[];
}

export interface Overview {
  chainId: number;
  chainName: string;
  explorer?: string;
  contract: Address;
  deployBlock?: bigint;
  head: bigint;
  source: "explorer" | "rpc" | null;
  complete: boolean;
  policies: bigint;
  settled: bigint;
  spends: OverviewSpend[];
  uniqueVendors: number;
  activePolicies: number;
  policy0: OverviewPolicy | null;
  updatedAt: number;
}

let cache: { at: number; data: Overview } | null = null;
let inFlight: Promise<Overview> | null = null;

function client() {
  const chain = defaultNetwork.chain;
  return createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0], { timeout: 12_000, retryCount: 2, retryDelay: 300 }),
  });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * One cached snapshot for the desk: exact policy totals from contract state, full Spent history
 * and policy #0. Cached per server instance for 45s; the API route adds a CDN cache on top.
 */
export async function getOverview(): Promise<Overview> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (inFlight) return inFlight;
  inFlight = loadOverview().finally(() => {
    inFlight = null;
  });
  const data = await inFlight;
  cache = { at: Date.now(), data };
  return data;
}

async function loadOverview(): Promise<Overview> {
  const net = defaultNetwork;
  const chain = net.chain;
  const publicClient = client();
  const contract = net.leash ?? "0xdec9195d6f321b9e078b0d70a8fe15dea2e99a7f";

  const [head, count, history] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.readContract({ address: contract, abi: leashAbi, functionName: "nextPolicyId" }),
    getSpendHistory().catch(() => null),
  ]);

  const ids = Array.from({ length: Math.min(Number(count), MAX_POLICIES) }, (_, i) => BigInt(i));
  const reads = await mapLimit(ids, 5, async (id) => {
    try {
      return await publicClient.readContract({ address: contract, abi: leashAbi, functionName: "policyOf", args: [id] });
    } catch {
      return null;
    }
  });
  const loaded = reads.filter((p): p is NonNullable<typeof p> => p !== null);
  const settled = loaded.reduce((acc, p) => acc + p.spent, 0n);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const activePolicies = loaded.filter((p) => !p.revoked && now < p.expiry).length;

  const spends = history?.spends ?? [];
  const uniqueVendors = new Set(spends.map((s) => s.vendor.toLowerCase())).size;

  let policy0: OverviewPolicy | null = null;
  const raw0 = reads[0];
  if (raw0) {
    let allowlist: Address[] = [];
    try {
      allowlist = [...(await publicClient.readContract({ address: contract, abi: leashAbi, functionName: "allowlistOf", args: [0n] }))];
    } catch {
      allowlist = [];
    }
    policy0 = {
      policyId: 0n,
      buyer: raw0.buyer,
      agent: raw0.agent,
      perTxCap: raw0.perTxCap,
      budget: raw0.budget,
      spent: raw0.spent,
      dailyCap: raw0.dailyCap,
      daySpent: raw0.daySpent,
      expiry: raw0.expiry,
      revoked: raw0.revoked,
      labelHash: raw0.labelHash,
      allowlist,
    };
  }

  return {
    chainId: chain.id,
    chainName: chain.name,
    explorer: links.explorer,
    contract,
    deployBlock: net.deployBlock,
    head,
    source: history?.source ?? null,
    complete: history?.complete ?? false,
    policies: count,
    settled,
    spends,
    uniqueVendors,
    activePolicies,
    policy0,
    updatedAt: Date.now(),
  };
}

/** "12.5" for display, trimmed of trailing zeros. */
export function tokenAmount(value: bigint, decimals = 6): string {
  const text = formatUnits(value, decimals);
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

export function policyStatus(p: Pick<OverviewPolicy, "revoked" | "expiry">): "active" | "revoked" | "expired" {
  if (p.revoked) return "revoked";
  return BigInt(Math.floor(Date.now() / 1000)) >= p.expiry ? "expired" : "active";
}
