"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { formatUnits } from "viem";
import { useToken } from "@/components/useToken";
import { CopyButton } from "@/components/CopyButton";
import { useNetwork } from "@/lib/network";
import {
  fetchSpendHistory,
  spendHistoryFromJson,
  type SpendHistoryJson,
} from "@/lib/spends-client";
import { short } from "@/lib/format";
import { links, txUrl } from "@aevum-kit/aevum";

export function ActivityClient({
  initial,
  initialChainId,
}: {
  initial: SpendHistoryJson | null;
  initialChainId?: number;
}) {
  const { net } = useNetwork();
  const leash = net.leash;
  const token = useToken();

  const initialData = useMemo(
    () =>
      initial && (initialChainId === undefined || initialChainId === net.chain.id)
        ? spendHistoryFromJson(initial)
        : undefined,
    [initial, initialChainId, net.chain.id],
  );

  const { data: spendHistory, error, isLoading, refetch } = useQuery({
    queryKey: ["activity-spends", net.chain.id, leash],
    enabled: Boolean(leash),
    queryFn: async () => {
      if (!leash) return null;
      return await fetchSpendHistory({});
    },
    initialData,
    initialDataUpdatedAt: initialData?.fetchedAt,
    staleTime: 30_000,
    refetchInterval: false,
  });

  // All spends from the explorer; client-side filter currently always shows all.
  const allSpends = spendHistory?.spends ?? [];
  const rows = allSpends;

  const stats = useMemo(() => {
    const volume = rows.reduce((acc, r) => acc + r.amount, 0n);
    const policies = new Set(rows.map((r) => r.policyId.toString())).size;
    const vendors = new Set(rows.map((r) => r.vendor.toLowerCase())).size;
    return { volume, policies, vendors };
  }, [rows]);

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h1>Every spend, onchain.</h1>
          <p className="lede">
            Leash writes a typed <span className="mono">Spent</span> event for each payment. This page reads the full spend history from the public Blockscout explorer API, with RPC chunks as a fallback. No backend, no database.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn" href="/new">Create a policy</Link>
        </div>
      </div>

      {!leash && (
        <div className="notice warn">
          Leash is not configured for {net.label}. Set <code>NEXT_PUBLIC_LEASH_AEVUM</code> (or fork/local) and redeploy.
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-group">
          <button className="btn ghost small" type="button" onClick={() => void refetch()} disabled={isLoading}>
            {isLoading ? "Loading…" : "Refresh"}
          </button>
          <span className="fine">public explorer · no 1,000-block limit</span>
        </div>
      </div>

      {error && <div className="notice bad">{error.message}</div>}

      {isLoading && (
        <div className="card">
          <div className="spread" style={{ marginBottom: 10 }}>
            <span className="sub" style={{ margin: 0 }}>Loading spend history…</span>
            <span className="badge blue">public explorer</span>
          </div>
          <div className="progress"><span style={{ width: "100%" }} /></div>
        </div>
      )}

      {leash && !isLoading && (!spendHistory || spendHistory.spends.length === 0) && (
        <>
          <p className="fine" style={{ marginTop: 14 }}>
            💡 <strong>Approve tUSD8</strong> to Leash to see your balance and set budgets.
          </p>
          <div className="card">
            <div className="empty">
              <span className="empty-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>
              </span>
              <strong>No spends recorded.</strong>
              <p className="fine">Create a policy and pay it with the CLI.</p>
              <Link href="/new" className="btn ghost small" style={{ marginTop: 6 }}>Create a policy</Link>
            </div>
          </div>
        </>
      )}

      {leash && spendHistory && (
        <>
          <div className="metric-grid">
            <div className="card metric">
              <div className="metric-label">Spends recorded</div>
              <div className="metric-value">{rows.length}</div>
            </div>
            <div className="card metric">
              <div className="metric-label">Volume</div>
              <div className="metric-value">{formatUnits(stats.volume, token.decimals)} {token.symbol}</div>
            </div>
            <div className="card metric">
              <div className="metric-label">Policies touched</div>
              <div className="metric-value">{stats.policies}</div>
            </div>
            <div className="card metric">
              <div className="metric-label">Unique vendors</div>
              <div className="metric-value">{stats.vendors}</div>
            </div>
          </div>

          <div className="card flush">
            <div className="spread" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <h3>{rows.length === 0 ? "No spends recorded" : `${rows.length} spend${rows.length === 1 ? "" : "s"}`}</h3>
              <span className="fine">Newest first</span>
            </div>
            {rows.length === 0 ? (
              <div className="empty">
                <span className="empty-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 12h16" /><path d="M8 7l-4 5 4 5" /><path d="M16 7l4 5-4 5" /></svg>
                </span>
                <strong>Nothing settled recorded.</strong>
                <p className="fine">Widen the range, or create a policy and pay it with the CLI.</p>
                <Link href="/new" className="btn ghost small" style={{ marginTop: 6 }}>Create a policy</Link>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Block</th><th>Policy</th><th>Vendor</th><th className="right">Amount</th><th>Purpose hash</th><th>Receipt</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.tx}-${r.policyId}`}>
                        <td className="num">{r.block.toString()}</td>
                        <td className="num"><Link href={`/policy/${r.policyId}`}>#{r.policyId.toString()}</Link></td>
                        <td className="mono">
                          <a href={`${links.explorer}/address/${r.vendor}`} target="_blank" rel="noreferrer">{short(r.vendor)}</a>
                        </td>
                        <td className="right num strong">{formatUnits(r.amount, token.decimals)} {token.symbol}</td>
                        <td className="mono">
                          <span className="row-inline">
                            {short(r.purposeHash, 8, 6)}
                            <CopyButton text={r.purposeHash} label="Copy" />
                          </span>
                        </td>
                        <td>
                          <span className="row-inline">
                            <Link href={`/receipts/${r.tx}`}>verify</Link>
                            <a href={txUrl(r.tx)} target="_blank" rel="noreferrer" title="Open on the explorer">↗</a>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}