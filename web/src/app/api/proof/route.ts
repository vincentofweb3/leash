import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient, formatUnits, http, parseEventLogs, type Hex } from "viem";
import { leashAbi } from "@leash/kit";
import { links, txUrl } from "@aevum-kit/aevum";
import { getOverview } from "@/lib/chain-read";
import { defaultNetwork, repoUrl, siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const DECIMALS = 6;

type SpentJson = {
  policyId: string;
  vendor: string;
  amount: string;
  amountDisplay: string;
  purposeHash: string;
  nonce: string;
  spentAfter: string;
  tx: string;
  block: string;
  logIndex: number;
};

function toSpentJson(s: {
  policyId: bigint;
  vendor: string;
  amount: bigint;
  purposeHash: string;
  nonce: string;
  spentAfter: bigint;
  tx: string;
  block: bigint;
  logIndex: number;
}): SpentJson {
  return {
    policyId: s.policyId.toString(),
    vendor: s.vendor,
    amount: s.amount.toString(),
    amountDisplay: `${formatUnits(s.amount, DECIMALS)} tUSD8`,
    purposeHash: s.purposeHash,
    nonce: s.nonce,
    spentAfter: s.spentAfter.toString(),
    tx: s.tx,
    block: s.block.toString(),
    logIndex: s.logIndex,
  };
}

function reply(body: unknown, download: boolean, filename: string) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  return NextResponse.json(body, { headers });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}

export async function GET(request: NextRequest) {
  const tx = request.nextUrl.searchParams.get("tx");
  const download = request.nextUrl.searchParams.get("download") === "1";
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const net = defaultNetwork;
  const contract = net.leash ?? "0xdec9195d6f321b9e078b0d70a8fe15dea2e99a7f";

  const chain = {
    id: net.chain.id,
    name: net.chain.name,
    rpc: net.chain.rpcUrls.default.http[0],
    explorer: links.explorer,
  };

  if (tx !== null) {
    if (!HASH_RE.test(tx)) {
      return reply({ error: "The tx parameter must be a 32-byte transaction hash." }, false, "");
    }
    try {
      const client = createPublicClient({
        chain: net.chain,
        transport: http(net.chain.rpcUrls.default.http[0], { timeout: 12_000, retryCount: 1 }),
      });
      const receipt = await client.getTransactionReceipt({ hash: tx as Hex });
      const parsed = parseEventLogs({ abi: leashAbi, logs: receipt.logs, eventName: "Spent" });
      const spent = parsed.map((log) => {
        const a = log.args as {
          policyId?: bigint;
          vendor?: string;
          amount?: bigint;
          purposeHash?: string;
          nonce?: string;
          spentAfter?: bigint;
        };
        return toSpentJson({
          policyId: a.policyId ?? 0n,
          vendor: a.vendor ?? "0x0000000000000000000000000000000000000000",
          amount: a.amount ?? 0n,
          purposeHash: a.purposeHash ?? `0x${"00".repeat(32)}`,
          nonce: a.nonce ?? `0x${"00".repeat(32)}`,
          spentAfter: a.spentAfter ?? 0n,
          tx,
          block: receipt.blockNumber,
          logIndex: log.logIndex,
        });
      });

      return reply(
        {
          version: 1,
          kind: "leash-receipt-proof",
          generatedAt: new Date().toISOString(),
          chain,
          contract,
          transaction: {
            hash: tx,
            blockNumber: receipt.blockNumber.toString(),
            status: receipt.status,
            from: receipt.from,
            to: receipt.to,
          },
          spent,
          interpretation:
            spent.length === 0
              ? "Valid transaction, but it emitted no Spent event from the Leash contract. It is not a spend receipt."
              : `${spent.length} Leash Spent event${spent.length === 1 ? "" : "s"} decoded from the transaction receipt.`,
          links: {
            receipt: `${siteUrl}/receipts/${tx}`,
            explorer: txUrl(tx),
            contract: `${links.explorer}/address/${contract}`,
            repo: repoUrl,
          },
          howToVerify: [
            `Fetch transaction ${tx} from ${chain.rpc} and confirm status "success".`,
            "Decode logs with the Leash ABI; only the typed Spent event counts.",
            "keccak256(utf8(purpose)) must equal purposeHash for a claimed purpose.",
            `Open ${siteUrl}/receipts/${tx} to reproduce this in the desk.`,
          ],
        },
        download,
        `leash-proof-${tx.slice(0, 10)}.json`,
      );
    } catch (error) {
      return reply(
        {
          error: error instanceof Error ? error.message : "Could not read the transaction receipt.",
          transaction: tx,
        },
        false,
        "",
      );
    }
  }

  try {
    // A proof with a missing spend is worse than a slow proof: retry once cold.
    let overview = await getOverview(refresh);
    if (!overview.complete && !refresh) overview = await getOverview(true);
    const spends = overview.spends.map((s) => toSpentJson(s));
    return reply(
      {
        version: 1,
        kind: "leash-deployment-proof",
        generatedAt: new Date().toISOString(),
        chain,
        contract,
        deployBlock: overview.deployBlock?.toString() ?? null,
        head: overview.head.toString(),
        policies: overview.policies.toString(),
        settled: {
          raw: overview.settled.toString(),
          display: `${formatUnits(overview.settled, DECIMALS)} tUSD8`,
        },
        uniqueVendors: overview.complete ? overview.uniqueVendors : null,
        activePolicies: overview.activePolicies,
        spends,
        history: { source: overview.source, complete: overview.complete },
        links: {
          desk: siteUrl,
          repo: repoUrl,
          contract: `${links.explorer}/address/${contract}`,
        },
        howToVerify: [
          `Read nextPolicyId() and policyOf(i) at ${contract} on chain ${chain.id}.`,
          "Re-fetch Spent logs from the public explorer or eth_getLogs in 1,000-block chunks.",
          "Recompute keccak256(utf8(purpose)) to match each purposeHash.",
          "Open /receipts/<tx> to re-read any transaction receipt independently.",
        ],
      },
      download,
      "leash-proof.json",
    );
  } catch (error) {
    return reply(
      { error: error instanceof Error ? error.message : "Proof data is temporarily unavailable." },
      false,
      "",
    );
  }
}
