"use client";

import { getLogsChunked, txUrl } from "@aevum-kit/aevum";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { formatUnits, getAbiItem, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { leashAbi } from "@leash/kit";
import { useNetwork } from "@/lib/network";
import { short } from "@/lib/format";

const WINDOWS = [
  { blocks: 1_000n, label: "Last 1k blocks" },
  { blocks: 5_000n, label: "Last 5k blocks" },
  { blocks: 20_000n, label: "Last 20k blocks" },
];

export default function ActivityPage() {
  const { net } = useNetwork();
  const appChain = net.chain;
  const leash = net.leash;
  const deployBlock = net.deployBlock;
  const client = usePublicClient({ chainId: appChain.id }) as PublicClient | undefined;
  const [windowSize, setWindowSize] = useState(5_000n);
  const [progress, setProgress] = useState(0);

  const logs = useQuery({
    queryKey: ["spent-logs", appChain.id, leash, windowSize.toString()],
    enabled: Boolean(client && leash),
    queryFn: async () => {
      const head = await client!.getBlockNumber();
      let from = head > windowSize ? head - windowSize + 1n : 0n;
      if (deployBlock !== undefined && deployBlock > from) from = deployBlock;
      setProgress(0);
      const result = await getLogsChunked(client!, {
        address: leash!,
        event: getAbiItem({ abi: leashAbi, name: "Spent" }),
        fromBlock: from,
        toBlock: head,
        onProgress: (done, total) => setProgress(Number((done * 100n) / (total || 1n))),
      });
      return result;
    },
  });

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h1>Every spend, onchain.</h1>
          <p className="lede">
            Leash writes a typed <span className="mono">Spent</span> event for each payment. This is the whole ledger —
            no backend, no database. Aevum returns at most 1,000 blocks per <span className="mono">eth_getLogs</span> call, so we scan in chunks.
          </p>
        </div>
      </div>

      <div className="row" style={{ gap: 16, alignItems: "center" }}>
        <div className="modes" role="radiogroup" aria-label="Blocks to scan">
          {WINDOWS.map((w) => (
            <button
              key={w.blocks.toString()}
              type="button"
              role="radio"
              aria-checked={windowSize === w.blocks}
              className={`mode ${windowSize === w.blocks ? "active" : ""}`}
              onClick={() => setWindowSize(w.blocks)}
            >
              <span className="mode-top"><span className="mode-desc">{w.label}</span></span>
            </button>
          ))}
        </div>
        <Link className="btn ghost small" href="/new">Create a policy</Link>
      </div>

      {!leash && (
        <div className="notice warn">
          Leash is not configured for {net.label}. Set <code>NEXT_PUBLIC_LEASH_AEVUM</code> (or fork/local) and redeploy.
        </div>
      )}

      {leash && logs.isLoading && (
        <div className="card">
          <p className="sub" style={{ marginBottom: 10 }}>Scanning blocks… {progress}%</p>
          <div className="progress"><span style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {leash && logs.error && <div className="notice bad">{(logs.error as Error).message}</div>}

      {leash && logs.data && (
        <div className="card">
          <h2>{logs.data.length} spend{logs.data.length === 1 ? "" : "s"}</h2>
          {logs.data.length === 0 ? (
            <p className="fine">No spends in this window. Widen the range, or create a policy and pay it.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Block</th><th>Policy</th><th>Vendor</th><th className="right">Amount</th><th>Purpose hash</th><th></th></tr></thead>
                <tbody>
                  {[...logs.data].reverse().map((l, i) => {
                    const a = l.args as { policyId?: bigint; vendor?: string; amount?: bigint; purposeHash?: `0x${string}`; spentAfter?: bigint };
                    return (
                      <tr key={i}>
                        <td className="num">{l.blockNumber?.toString()}</td>
                        <td className="num"><Link href={`/policy/${a.policyId ?? 0}`}>#{a.policyId?.toString()}</Link></td>
                        <td className="mono">{a.vendor ? short(a.vendor) : "—"}</td>
                        <td className="right num">{formatUnits(a.amount ?? 0n, 6)}</td>
                        <td className="mono">{a.purposeHash ? short(a.purposeHash, 8, 6) : "—"}</td>
                        <td><a href={l.transactionHash ? txUrl(l.transactionHash) : "#"} target="_blank" rel="noreferrer">explorer</a></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
