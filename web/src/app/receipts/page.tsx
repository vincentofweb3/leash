import type { Metadata } from "next";
import Link from "next/link";
import { getOverview, tokenAmount, type Overview } from "@/lib/chain-read";
import { short } from "@/lib/format";
import { VerifyForm } from "./VerifyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Receipt verifier",
  description: "Paste any Leash transaction hash and verify the spend straight from the chain receipt — no backend required.",
};

export default async function ReceiptsPage() {
  let overview: Overview | null = null;
  try {
    overview = await getOverview();
  } catch {
    overview = null;
  }
  const recent = overview ? [...overview.spends].reverse().slice(0, 6) : [];

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Receipt verifier</p>
          <h1>Proof of settlement.</h1>
          <p className="lede">
            Paste any Leash transaction hash. This page re-reads the transaction receipt from {overview?.chainName ?? "QDay Aevum"} and
            derives the <span className="mono">Spent</span> event itself — no database, no trust in us.
          </p>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Check a transaction</h3>
        <VerifyForm />
        <p className="fine" style={{ marginTop: 10 }}>
          The verifier works for any transaction on the selected network. A valid transaction that did not emit a Leash
          event is not a receipt — it will say so plainly.
        </p>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>What verification means here</h2>
          <ul>
            <li><strong>Read the receipt.</strong> The page fetches the mined transaction receipt and confirms the status succeeded.</li>
            <li><strong>Parse the logs strictly.</strong> Only a typed <code>Spent</code> event from the Leash contract counts; topic0, policy id, vendor, amount, purpose hash and nonce are decoded.</li>
            <li><strong>Show the raw links.</strong> The explorer transaction and the policy page are one click away, so nothing depends on our rendering.</li>
          </ul>
          <p className="fine" style={{ marginTop: 12 }}>
            Purpose text is deliberately offchain. The receipt shows <code>keccak256(utf8(purpose))</code>, so a claimed
            purpose can be checked against the hash by anyone.
          </p>
        </div>
        <div className="card">
          <div className="spread">
            <h2>Recent settlements</h2>
            <Link className="btn ghost small" href="/activity">All activity</Link>
          </div>
          {recent.length === 0 ? (
            <div className="empty">
              <span className="empty-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 3h14v18l-7-4-7 4V3z" /></svg>
              </span>
              <strong>No spends recorded yet.</strong>
              <p className="fine">The first policy spend will appear here.</p>
            </div>
          ) : (
            <div className="surface-list">
              {recent.map((s) => (
                <Link key={s.tx} href={`/receipts/${s.tx}`} className="surface" style={{ color: "inherit" }}>
                  <span className="surface-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                  </span>
                  <span className="surface-body">
                    <strong style={{ fontSize: 14 }}>{tokenAmount(s.amount)} tUSD8 to {short(s.vendor)}</strong>
                    <span className="fine" style={{ display: "block" }}>policy #{s.policyId.toString()} · block {s.block.toLocaleString("en-US")}</span>
                  </span>
                  <span className="surface-link">Receipt →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
