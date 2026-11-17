"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPublicClient, formatUnits, getAbiItem, http, parseUnits, type Address, type Chain, type Hash } from "viem";
import { useAccount, useConfig, useReadContract } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { getLogsChunked, txUrl } from "@aevum-kit/aevum";
import { leashAbi } from "@leash/kit";
import { useNetwork } from "@/lib/network";
import { explain } from "@/lib/errors";
import { short } from "@/lib/format";
import { loadBundle, saveBundle } from "@/lib/bundle-store";

interface SpendRow {
  block: bigint;
  vendor: Address;
  amount: bigint;
  purposeHash: `0x${string}`;
  spentAfter: bigint;
  tx: Hash;
}

async function fetchSpends(chain: Chain, leash: Address, policyId: bigint, fromBlock: bigint): Promise<SpendRow[]> {
  const client = createPublicClient({ transport: http(chain.rpcUrls.default.http[0]) });
  const head = await client.getBlockNumber();
  const logs = await getLogsChunked(client, {
    address: leash,
    event: getAbiItem({ abi: leashAbi, name: "Spent" }),
    args: { policyId },
    fromBlock,
    toBlock: head,
  });
  return logs.map((l) => {
    const a = l.args as { vendor?: Address; amount?: bigint; purposeHash?: `0x${string}`; spentAfter?: bigint };
    return {
      block: l.blockNumber ?? 0n,
      vendor: a.vendor ?? ("0x0000000000000000000000000000000000000000" as Address),
      amount: a.amount ?? 0n,
      purposeHash: a.purposeHash ?? (`0x${"00".repeat(32)}` as `0x${string}`),
      spentAfter: a.spentAfter ?? 0n,
      tx: l.transactionHash as Hash,
    };
  });
}

export default function PolicyPage() {
  const params = useParams<{ id: string }>();
  const policyIdText = params.id ?? "";
  const policyId = /^\d+$/.test(policyIdText) ? BigInt(policyIdText) : null;

  const { net } = useNetwork();
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === net.chain.id;
  const leash = net.leash;

  const policy = useReadContract({
    address: leash,
    abi: leashAbi,
    functionName: "policyOf",
    args: policyId !== null ? [policyId] : undefined,
    chainId: net.chain.id,
    query: { enabled: Boolean(leash && policyId !== null) },
  });
  const remaining = useReadContract({
    address: leash,
    abi: leashAbi,
    functionName: "remainingBudget",
    args: policyId !== null ? [policyId] : undefined,
    chainId: net.chain.id,
    query: { enabled: Boolean(leash && policyId !== null && policy.data !== undefined) },
  });
  const allowlist = useReadContract({
    address: leash,
    abi: leashAbi,
    functionName: "allowlistOf",
    args: policyId !== null ? [policyId] : undefined,
    chainId: net.chain.id,
    query: { enabled: Boolean(leash && policyId !== null && policy.data !== undefined) },
  });

  const p = policy.data;
  const isBuyer = p && address && address.toLowerCase() === p.buyer.toLowerCase();
  const spentPct = p && p.budget > 0n ? Number((p.spent * 1000n) / p.budget) / 10 : 0;
  const status = !p ? "loading" : p.revoked ? "revoked" : BigInt(Math.floor(Date.now() / 1000)) >= BigInt(p.expiry) ? "expired" : "active";

  const [spends, setSpends] = useState<SpendRow[] | null>(null);
  const [spendsError, setSpendsError] = useState<string | null>(null);
  const reloadSpends = useCallback(async () => {
    if (!leash || policyId === null) return;
    setSpendsError(null);
    try {
      setSpends(await fetchSpends(net.chain, leash, policyId, net.deployBlock ?? 0n));
    } catch (e) {
      setSpendsError(explain(e));
    }
  }, [leash, policyId, net.chain, net.deployBlock]);
  useEffect(() => {
    void reloadSpends();
  }, [reloadSpends]);

  const [perTxCap, setPerTxCap] = useState("");
  const [budget, setBudget] = useState("");
  const [dailyCap, setDailyCap] = useState("");
  const [extendDays, setExtendDays] = useState("30");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (p) {
      setPerTxCap(formatUnits(p.perTxCap, 6));
      setBudget(formatUnits(p.budget, 6));
      setDailyCap(p.dailyCap === 0n ? "" : formatUnits(p.dailyCap, 6));
    }
  }, [p]);

  async function transact(kind: "revoke" | "limits" | "extend") {
    if (!leash || policyId === null || !address) return;
    setBusy(kind);
    setNotice(null);
    try {
      let hash;
      if (kind === "revoke") {
        hash = await writeContract(config, { address: leash, abi: leashAbi, functionName: "revoke", args: [policyId], chainId: net.chain.id, type: "legacy" });
      } else if (kind === "limits") {
        hash = await writeContract(config, {
          address: leash,
          abi: leashAbi,
          functionName: "setLimits",
          args: [policyId, parseUnits(perTxCap || "0", 6), parseUnits(budget || "0", 6), dailyCap.trim() === "" ? 0n : parseUnits(dailyCap, 6)],
          chainId: net.chain.id,
          type: "legacy",
        });
      } else {
        const days = Number(extendDays);
        if (!Number.isFinite(days) || days <= 0) throw new Error("extend days must be a positive number");
        const base = p ? BigInt(p.expiry) : BigInt(Math.floor(Date.now() / 1000));
        hash = await writeContract(config, {
          address: leash,
          abi: leashAbi,
          functionName: "extend",
          args: [policyId, base + BigInt(Math.floor(days * 86400))],
          chainId: net.chain.id,
          type: "legacy",
        });
      }
      await waitForTransactionReceipt(config, { hash, chainId: net.chain.id });
      setNotice(`${kind === "revoke" ? "Policy revoked" : kind === "limits" ? "Limits updated" : "Expiry extended"} — ${txUrl(hash)}`);
      await policy.refetch();
      await remaining.refetch();
      setConfirmRevoke(false);
    } catch (e) {
      setNotice(explain(e));
    } finally {
      setBusy(null);
    }
  }

  function downloadBundle() {
    if (policyId === null) return;
    const stored = loadBundle(net.chain.id, policyId.toString());
    if (stored) {
      const blob = new Blob([JSON.stringify(stored, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leash-policy-${policyId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (!p) return;
    const bundle = {
      version: 1 as const,
      chainId: net.chain.id,
      leash: leash!,
      policyId: policyId.toString(),
      buyer: p.buyer,
      agent: p.agent,
      label: "",
      perTxCap: p.perTxCap.toString(),
      budget: p.budget.toString(),
      dailyCap: p.dailyCap.toString(),
      expiry: p.expiry.toString(),
      createdAt: new Date().toISOString(),
    };
    saveBundle(net.chain.id, bundle);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leash-policy-${policyId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (policyId === null) return <main className="shell"><div className="notice bad">Not a valid policy id.</div></main>;
  if (!leash) {
    return (
      <main className="shell">
        <div className="notice warn">
          Leash is not configured for {net.label}. Set <code>NEXT_PUBLIC_LEASH_AEVUM</code> / <code>NEXT_PUBLIC_LEASH_FORK</code>.
        </div>
      </main>
    );
  }
  if (policy.isPending) return <main className="shell"><p className="lede">Reading policy #{policyId.toString()} from {net.label}…</p></main>;
  if (policy.isError || !p) {
    return (
      <main className="shell">
        <div className="notice bad">
          Policy #{policyId.toString()} does not exist on {net.label}. Check the id or the selected network.
        </div>
        <Link href="/new" className="btn">Create a new policy</Link>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Policy #{policyId.toString()} · {status}</p>
          <h1>Agent allowance</h1>
          <p className="lede">
            Agent <span className="mono">{short(p.agent, 8, 6)}</span> may spend up to{" "}
            <strong>{formatUnits(p.perTxCap, 6)} tUSD8</strong> per transaction,{" "}
            <strong>{formatUnits(p.budget, 6)} tUSD8</strong> in total{p.dailyCap !== 0n && <>, <strong>{formatUnits(p.dailyCap, 6)} tUSD8</strong> per day</>},
            until {new Date(Number(p.expiry) * 1000).toLocaleDateString()}.
          </p>
        </div>
        <button className="btn secondary" type="button" onClick={downloadBundle}>Download bundle.json</button>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Budget used</h2>
          <p className="sub num" style={{ fontSize: 28 }}>
            {formatUnits(p.spent, 6)} <span style={{ fontSize: 16, color: "var(--text-muted)" }}>/ {formatUnits(p.budget, 6)} tUSD8</span>
          </p>
          <div className="progress" aria-label="budget used"><span style={{ width: `${Math.min(100, spentPct)}%` }} /></div>
          <p className="fine num" style={{ marginTop: 8 }}>{spentPct.toFixed(1)}% spent · {remaining.data !== undefined ? formatUnits(remaining.data, 6) : "…"} tUSD8 remaining</p>
          <table className="data" style={{ marginTop: 14 }}>
            <tbody>
              <tr><td>Buyer</td><td className="mono"><a href={`https://explorer-test.qday.info/address/${p.buyer}`} target="_blank" rel="noreferrer">{short(p.buyer, 8, 6)}</a></td></tr>
              <tr><td>Status</td><td>{status}</td></tr>
              <tr><td>Allowlist</td><td className="mono">{allowlist.data && allowlist.data.length > 0 ? allowlist.data.map((a: Address) => short(a)).join(", ") : "none (any vendor)"}</td></tr>
              <tr><td>Expiry</td><td>{new Date(Number(p.expiry) * 1000).toLocaleString()}</td></tr>
              <tr><td>Label hash</td><td className="mono">{p.labelHash === `0x${"00".repeat(32)}` ? "none" : short(p.labelHash, 10, 6)}</td></tr>
            </tbody>
          </table>
        </div>

        {isBuyer && (
          <div className="card">
            <h2>Controls</h2>
            <p className="sub">Buyer-only. Every change is one transaction, effective immediately.</p>

            <label className="field"><span>Per-transaction cap (tUSD8)</span><input className="input num" value={perTxCap} onChange={(e) => setPerTxCap(e.target.value)} /></label>
            <label className="field"><span>Budget (tUSD8)</span><input className="input num" value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
            <label className="field"><span>Daily cap (tUSD8, empty = none)</span><input className="input num" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} /></label>
            <button className="btn secondary block" type="button" disabled={busy !== null} onClick={() => transact("limits")}>
              {busy === "limits" ? "Updating…" : "Update limits"}
            </button>

            <div className="row" style={{ marginTop: 14, gap: 10 }}>
              <label className="field" style={{ marginBottom: 0, flex: 1 }}><span>Extend by (days)</span><input className="input num" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} /></label>
              <button className="btn secondary" type="button" style={{ alignSelf: "flex-end" }} disabled={busy !== null} onClick={() => transact("extend")}>
                {busy === "extend" ? "Extending…" : "Extend"}
              </button>
            </div>

            {!confirmRevoke ? (
              <button className="btn warn block" style={{ marginTop: 18 }} type="button" disabled={busy !== null || status === "revoked"} onClick={() => setConfirmRevoke(true)}>
                {status === "revoked" ? "Already revoked" : "Revoke session key"}
              </button>
            ) : (
              <div className="notice bad" style={{ marginTop: 18 }}>
                <strong>Kill this session key?</strong>
                <span>The agent immediately loses the ability to spend. Unspent tUSD8 stays in your wallet. This cannot be undone — make a new policy instead.</span>
                <div className="row" style={{ gap: 10 }}>
                  <button className="btn warn" type="button" disabled={busy !== null} onClick={() => transact("revoke")}>
                    {busy === "revoke" ? "Revoking…" : "Yes, revoke forever"}
                  </button>
                  <button className="btn ghost" type="button" onClick={() => setConfirmRevoke(false)}>Keep it</button>
                </div>
              </div>
            )}
            {notice && <div className="notice" style={{ marginTop: 14 }}>{notice}</div>}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Spends</h2>
        <p className="sub">Every row is a <span className="mono">Spent</span> event on Aevum, read 1,000 blocks at a time. Click through to the explorer to verify.</p>
        {spendsError && <div className="notice bad">{spendsError}</div>}
        {spends === null ? (
          <p className="lede">Reading events…</p>
        ) : spends.length === 0 ? (
          <p className="fine">No spends yet for this policy.</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Block</th><th>Vendor</th><th className="right">Amount</th><th>Purpose hash</th><th className="right">Total spent</th><th></th></tr></thead>
              <tbody>
                {spends.map((s) => (
                  <tr key={`${s.tx}`}>
                    <td className="num">{s.block.toString()}</td>
                    <td className="mono">{short(s.vendor)}</td>
                    <td className="right num">{formatUnits(s.amount, 6)}</td>
                    <td className="mono">{short(s.purposeHash, 8, 6)}</td>
                    <td className="right num">{formatUnits(s.spentAfter, 6)}</td>
                    <td><a href={txUrl(s.tx)} target="_blank" rel="noreferrer">explorer</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {onChain && <p className="fine" style={{ marginTop: 10 }}><a onClick={reloadSpends} href="#">Refresh</a></p>}
      </div>
    </main>
  );
}
