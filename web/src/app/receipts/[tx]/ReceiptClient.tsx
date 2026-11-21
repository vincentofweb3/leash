"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { txUrl } from "@aevum-kit/aevum";
import { leashAbi } from "@leash/kit";
import { createPublicClient, formatUnits, http, parseEventLogs, type Hex } from "viem";
import { CopyButton } from "@/components/CopyButton";
import { LogoMark } from "@/components/Logo";
import { siteUrl } from "@/lib/env";
import { short } from "@/lib/format";
import { useNetwork } from "@/lib/network";
import { VerifyForm } from "../VerifyForm";

interface SpentEntry {
  policyId: bigint;
  vendor: string;
  amount: bigint;
  purposeHash: Hex;
  nonce: Hex;
  spentAfter: bigint;
}

export function ReceiptClient() {
  const params = useParams<{ tx: string }>();
  const { net } = useNetwork();
  const tx = (params.tx ?? "").toLowerCase() as Hex;

  const [entries, setEntries] = useState<SpentEntry[] | null>(null);
  const [block, setBlock] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(null);
    setBlock(null);
    setError(null);
    if (!/^0x[0-9a-f]{64}$/.test(tx)) {
      setError("That is not a 32-byte transaction hash.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const client = createPublicClient({ transport: http(net.chain.rpcUrls.default.http[0]) });
        const receipt = await client.getTransactionReceipt({ hash: tx });
        if (receipt.status !== "success") {
          if (!cancelled) setError(`This transaction reverted (status: ${receipt.status}). No spend settled.`);
          return;
        }
        const parsed = parseEventLogs({ abi: leashAbi, logs: receipt.logs, eventName: "Spent" });
        if (cancelled) return;
        setBlock(receipt.blockNumber);
        setEntries(
          parsed.map((l) => {
            const a = l.args as { policyId?: bigint; vendor?: string; amount?: bigint; purposeHash?: Hex; nonce?: Hex; spentAfter?: bigint };
            return {
              policyId: a.policyId ?? 0n,
              vendor: a.vendor ?? "0x0000000000000000000000000000000000000000",
              amount: a.amount ?? 0n,
              purposeHash: a.purposeHash ?? (`0x${"00".repeat(32)}` as Hex),
              nonce: a.nonce ?? (`0x${"00".repeat(32)}` as Hex),
              spentAfter: a.spentAfter ?? 0n,
            };
          }),
        );
      } catch (e) {
        if (!cancelled) setError(`Could not load this transaction from ${net.label}: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tx, net.chain, net.label]);

  return (
    <main className="shell">
      <div className="page-head no-print">
        <div>
          <p className="eyebrow">Receipt verifier</p>
          <h1>Proof of settlement.</h1>
          <p className="lede">Paste another hash, or read the receipt below straight from the chain.</p>
        </div>
        <div className="page-actions">
          <Link className="btn ghost small" href="/activity">← Activity</Link>
        </div>
      </div>

      <div className="card no-print">
        <VerifyForm defaultValue={/^0x[0-9a-f]{64}$/.test(tx) ? tx : ""} />
      </div>

      {entries === null && !error && (
        <div className="card" style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
          <div className="stack">
            <div className="skeleton" style={{ width: 180, height: 20 }} />
            <div className="skeleton" style={{ width: 260, height: 52 }} />
            <div className="skeleton" style={{ width: "100%", height: 160 }} />
          </div>
          <p className="fine" style={{ marginTop: 12 }}>Reading the receipt from {net.label}…</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
          <div className="notice bad">
            <strong>No valid receipt.</strong>
            <span>{error}</span>
          </div>
          <p className="fine" style={{ marginTop: 12 }}>
            Check the network selected in the header and the hash. A transaction on another chain cannot be verified here.
          </p>
        </div>
      )}

      {entries !== null && entries.length === 0 && !error && (
        <div className="card" style={{ maxWidth: 760, margin: "0 auto", width: "100%" }}>
          <div className="notice warn">
            <strong>Valid transaction, but no Leash spend.</strong>
            <span>It carried no <code>Spent</code> event from the Leash contract. It may be a policy creation, a revoke, or an unrelated transaction.</span>
          </div>
          <p className="fine" style={{ marginTop: 12 }}>
            <a href={txUrl(tx)} target="_blank" rel="noreferrer">Open the transaction on the explorer →</a>
          </p>
        </div>
      )}

      {entries && entries.length > 0 && (
        <>
          <div className="receipt-card card">
            <div className="receipt-head">
              <span className="receipt-brand"><LogoMark size={22} /> Leash receipt</span>
              <span className="status-pill active"><span className="dot" aria-hidden="true" /> verified onchain</span>
            </div>
            <div className="receipt-body">
              {entries.map((e, i) => (
                <div key={i} style={{ marginBottom: entries.length > 1 && i < entries.length - 1 ? 26 : 0 }}>
                  <div className="receipt-amount">
                    {formatUnits(e.amount, 6)} <small>tUSD8</small>
                  </div>
                  <div className="receipt-meta">
                    settled to <span className="mono">{short(e.vendor, 10, 8)}</span> · policy{" "}
                    <Link href={`/policy/${e.policyId}`}>#{e.policyId.toString()}</Link>
                  </div>
                  <div className="receipt-rows">
                    <div className="receipt-row"><span className="k">Vendor</span><span className="v">{e.vendor}</span></div>
                    <div className="receipt-row"><span className="k">Transaction</span><span className="v">{tx}</span></div>
                    <div className="receipt-row"><span className="k">Block</span><span className="v">{block?.toString() ?? "—"}</span></div>
                    <div className="receipt-row"><span className="k">Purpose hash</span><span className="v">{e.purposeHash}</span></div>
                    <div className="receipt-row"><span className="k">Nonce</span><span className="v">{e.nonce}</span></div>
                    <div className="receipt-row"><span className="k">Budget used after</span><span className="v">{formatUnits(e.spentAfter, 6)} tUSD8</span></div>
                  </div>
                </div>
              ))}
              <p className="fine" style={{ marginTop: 18 }}>
                The purpose text stays offchain; the hash above is <code>keccak256(utf8(purpose))</code>. If someone claims a
                different purpose, the hashes will not match.
              </p>
            </div>
            <div className="receipt-foot no-print">
              <span className="fine">Read from the transaction receipt · no backend involved</span>
              <div className="row" style={{ gap: 8 }}>
                <CopyButton text={`${siteUrl}/receipts/${tx}`} label="Copy link" />
                <a className="btn ghost small" href={txUrl(tx)} target="_blank" rel="noreferrer">Explorer ↗</a>
                <button className="btn secondary small" type="button" onClick={() => window.print()}>Print</button>
              </div>
            </div>
          </div>
          <p className="fine no-print" style={{ textAlign: "center" }}>
            Anyone can reproduce this by reading transaction <span className="mono">{short(tx, 14, 8)}</span> on the Aevum explorer.
          </p>
        </>
      )}
    </main>
  );
}
