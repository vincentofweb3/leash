import "server-only";

import { createPublicClient, getAbiItem, http, keccak256, toBytes, type Address, type Hash, type Hex } from "viem";
import { leashAbi } from "@leash/kit";
import { links } from "@aevum-kit/aevum";
import { defaultNetwork } from "./env";

const SPENT_TOPIC = keccak256(toBytes("Spent(uint256,address,uint256,bytes32,bytes32,uint256)"));

const CACHE_MS = 30_000;
const EXPLORER_PAGE_CAP = 20;
const FALLBACK_WINDOW = 20_000n;
const FALLBACK_CHUNK = 1_000n;
const FALLBACK_PARALLEL = 6;

export interface SpendEvent {
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
  spends: SpendEvent[];
  source: "explorer" | "rpc";
  complete: boolean;
  head: bigint | null;
  fetchedAt: number;
}

interface ExplorerLog {
  block_number: number;
  index: number;
  transaction_hash?: string;
  tx_hash?: string;
  topics: Array<string | null>;
  data: string;
}

interface ExplorerPage {
  items: ExplorerLog[];
  next_page_params?: Record<string, string | number | null> | null;
}

let cache: { at: number; data: SpendHistory } | null = null;
let inFlight: Promise<SpendHistory> | null = null;

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

function parseSpent(log: ExplorerLog): SpendEvent | null {
  if (log.topics[0]?.toLowerCase() !== SPENT_TOPIC) return null;
  const tx = log.transaction_hash ?? log.tx_hash;
  if (!tx) return null;
  const data = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
  const word = (i: number) => data.slice(i * 64, (i + 1) * 64);
  const policyTopic = log.topics[1];
  const vendorTopic = log.topics[2];
  if (word(0).length !== 64 || !vendorTopic || !policyTopic || !/^0x[0-9a-fA-F]{64}$/.test(policyTopic)) return null;
  return {
    policyId: BigInt(policyTopic),
    vendor: `0x${vendorTopic.slice(-40)}` as Address,
    amount: BigInt(`0x${word(0)}`),
    purposeHash: `0x${word(1)}` as Hex,
    nonce: `0x${word(2)}` as Hex,
    spentAfter: BigInt(`0x${word(3)}`),
    tx: tx as Hash,
    block: BigInt(log.block_number),
    logIndex: Number(log.index ?? 0),
  };
}

async function fetchExplorerPage(url: URL): Promise<ExplorerPage> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Explorer API returned ${res.status}`);
      return (await res.json()) as ExplorerPage;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Explorer API unavailable");
}

async function fetchExplorerSpends(contract: Address): Promise<SpendEvent[]> {
  const endpoint = `${links.explorer}/api/v2/addresses/${contract}/logs`;
  const spends: SpendEvent[] = [];
  let params: Record<string, string | number | null> | null = null;

  for (let page = 0; page < EXPLORER_PAGE_CAP; page++) {
    const url = new URL(endpoint);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    const body = await fetchExplorerPage(url);
    for (const log of body.items ?? []) {
      try {
        const parsed = parseSpent(log);
        if (parsed) spends.push(parsed);
      } catch {
        // A single malformed log must not discard the rest of the history.
      }
    }
    if (!body.next_page_params) break;
    params = body.next_page_params;
  }

  return spends.sort((a, b) => (a.block === b.block ? a.logIndex - b.logIndex : a.block < b.block ? -1 : 1));
}

function publicClient() {
  const chain = defaultNetwork.chain;
  return createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0], { timeout: 9_000, retryCount: 1, retryDelay: 250 }),
  });
}

async function fetchRpcFallback(contract: Address): Promise<{ spends: SpendEvent[]; complete: boolean; head: bigint | null }> {
  const client = publicClient();
  let head: bigint | null = null;
  try {
    head = await client.getBlockNumber();
  } catch {
    head = null;
  }
  if (head === null) return { spends: [], complete: false, head };

  const deployBlock = defaultNetwork.deployBlock ?? 0n;
  const recentFrom = head > FALLBACK_WINDOW ? head - FALLBACK_WINDOW + 1n : 0n;
  const from = deployBlock > recentFrom ? deployBlock : recentFrom;
  const complete = from <= deployBlock;

  const ranges: Array<{ from: bigint; to: bigint }> = [];
  for (let start = from; start <= head; start += FALLBACK_CHUNK) {
    const end = start + FALLBACK_CHUNK - 1n > head ? head : start + FALLBACK_CHUNK - 1n;
    ranges.push({ from: start, to: end });
  }
  const event = getAbiItem({ abi: leashAbi, name: "Spent" });
  const pages = await mapLimit(ranges, FALLBACK_PARALLEL, async (range) => {
    const logs = await client.getLogs({ address: contract, event, fromBlock: range.from, toBlock: range.to });
    return logs.map((log) => {
      const args = log.args as {
        policyId?: bigint;
        vendor?: Address;
        amount?: bigint;
        purposeHash?: Hex;
        nonce?: Hex;
        spentAfter?: bigint;
      };
      return {
        policyId: args.policyId ?? 0n,
        vendor: args.vendor ?? ("0x0000000000000000000000000000000000000000" as Address),
        amount: args.amount ?? 0n,
        purposeHash: args.purposeHash ?? (`0x${"00".repeat(32)}` as Hex),
        nonce: args.nonce ?? (`0x${"00".repeat(32)}` as Hex),
        spentAfter: args.spentAfter ?? 0n,
        tx: log.transactionHash as Hash,
        block: log.blockNumber ?? 0n,
        logIndex: log.logIndex ?? 0,
      } satisfies SpendEvent;
    });
  });
  const spends = pages.flat().sort((a, b) => (a.block === b.block ? a.logIndex - b.logIndex : a.block < b.block ? -1 : 1));
  return { spends, complete, head };
}

/**
 * Full Spent history, newest last. Prefers the public Blockscout API (one call per 50 events,
 * no 1,000-block limit) and falls back to batched eth_getLogs over a recent window.
 */
export async function getSpendHistory(force = false): Promise<SpendHistory> {
  if (!force && cache) {
    if (Date.now() - cache.at < CACHE_MS) return cache.data;
    // Stale-while-revalidate: serve the last known history while a refresh runs.
    const stale = cache.data;
    if (!inFlight) {
      inFlight = loadHistory()
        .then((data) => {
          cache = { at: Date.now(), data };
          return data;
        })
        .catch(() => stale)
        .finally(() => {
          inFlight = null;
        });
    }
    return stale;
  }
  if (!force && inFlight) return inFlight;
  inFlight = loadHistory().finally(() => {
    inFlight = null;
  });
  const data = await inFlight;
  cache = { at: Date.now(), data };
  return data;
}

async function loadHistory(): Promise<SpendHistory> {
  const contract = defaultNetwork.leash ?? "0xdec9195d6f321b9e078b0d70a8fe15dea2e99a7f";

  let head: bigint | null = null;
  try {
    head = await publicClient().getBlockNumber();
  } catch {
    head = null;
  }

  if (defaultNetwork.hasExplorer) {
    try {
      const spends = await fetchExplorerSpends(contract);
      return { spends, source: "explorer", complete: true, head, fetchedAt: Date.now() };
    } catch (error) {
      // Fall through to the RPC window below; the UI labels the result as recent-only.
      console.warn(
        "[spends] explorer history unavailable, using the RPC window:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  try {
    const fallback = await fetchRpcFallback(contract);
    return {
      spends: fallback.spends,
      source: "rpc",
      complete: fallback.complete,
      head: fallback.head ?? head,
      fetchedAt: Date.now(),
    };
  } catch {
    return { spends: [], source: "rpc", complete: false, head, fetchedAt: Date.now() };
  }
}
