"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPublicClient, formatUnits, http, parseEventLogs, type Hex } from "viem";
import { txUrl } from "@aevum-kit/aevum";
import { leashAbi } from "@leash/kit";
import { useNetwork } from "@/lib/network";
import { short } from "@/lib/format";

interface SpentEntry {
  policyId: bigint;
  vendor: string;
  amount: bigint;
  purposeHash: Hex;
  nonce: Hex;
  spentAfter: bigint;
}

export default function ReceiptsPage() {
  const params = useParams<{ tx: string }>();
  const { net } = useNetwork();
  const tx = (params.tx ?? "").toLowerCase() as Hex;

  const [entries, setEntries] = useState<SpentEntry[] | null>(null);
  const [block, setBlock] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState<boolean | null>(null);

  useEffect(() => {
    setEntries(null);
    setBlock(null);
    setError(null);
    setValid(null);
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
          setError(`This transaction reverted (status: ${receipt.status}). No spend settled.`);
          if (!cancelled) setValid(false);
          return;
        }
        const parsed = parseEventLogs({ abi: leashAbi, logs: receipt.logs, eventName: "Spent" });
        if (cancelled) return;
        setBlock(receipt.blockNumber);
        setValid(parsed.length > 0);
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
        if (!cancelled) {
          setError(`Could not load ${tx}: ${(e as Error).message}`);
          setValid(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tx, net.chain]);

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Receipt verifier</p>
          <h1>Proof of settlement</h1>
          <p className="lede">Paste any Leash transaction hash. This page reads the receipt straight from the chain — no database, no trust in us.</p>
        </div>
      </div>

      <form className="row" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem("tx") as HTMLInputElement).value.trim(); if (v) window.location.href = `/receipts/${v}`; }}>
        <input className="input mono" name="tx" placeholder="0x…" defaultValue={tx} size={70} spellCheck={false} aria-label="Transaction hash" />
        <button className="btn secondary" type="submit">Verify</button>
      </form>

      {entries === null && !error && <p className="lede">Reading the receipt from {net.label}…</p>}
      {error && <div className="notice bad">{error}</div>}

      {entries !== null && entries.length === 0 && !error && (
        <div className="notice warn">
          <strong>Valid transaction, but no Leash spend in it.</strong>
          <span>It carried no <code>Spent</code> event from a Leash contract. It may be a policy creation, a revoke, or something else entirely.</span>
        </div>
      )}

      {entries && entries.length > 0 && (
        <div className="card">
          <div className="notice good">
            <strong>Verified onchain.</strong>
            <span className="mono">{tx}</span>
            {block !== null && <span className="fine">block {block.toString()} · <a href={txUrl(tx)} target="_blank" rel="noreferrer">view on explorer</a></span>}
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="data">
              <thead><tr><th>Policy</th><th>Vendor</th><th className="right">Amount</th><th>Purpose hash</th><th className="right">Budget used after</th><th>Nonce</th></tr></thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i}>
                    <td className="num">#{e.policyId.toString()}</td>
                    <td className="mono">{short(e.vendor)}</td>
                    <td className="right num">{formatUnits(e.amount, 6)} tUSD8</td>
                    <td className="mono">{short(e.purposeHash, 10, 6)}</td>
                    <td className="right num">{formatUnits(e.spentAfter, 6)} tUSD8</td>
                    <td className="mono">{short(e.nonce, 8, 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fine" style={{ marginTop: 10 }}>
            The purpose text stays offchain; the hash you see here is <code>keccak256(utf8(purpose))</code>. If someone claims a different purpose, the hashes will not match.
          </p>
        </div>
      )}
    </main>
  );
}
