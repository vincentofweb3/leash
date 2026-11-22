import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { leashAbi } from "@leash/kit";
import { links } from "@aevum-kit/aevum";
import { CopyButton } from "@/components/CopyButton";
import { defaultNetwork } from "@/lib/env";
import { getSpendHistory } from "@/lib/spends";
import { policyStatus, tokenAmount } from "@/lib/chain-read";
import { short } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Policy #${id}`,
    description: `Onchain spend policy #${id} on QDay Aevum testnet: remaining budget, caps, vendors and every spend.`,
  };
}

function formatExpiry(expiry: bigint): string {
  const date = new Date(Number(expiry) * 1000);
  return `${date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  })} UTC`;
}

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const policyId = BigInt(id);
  const net = defaultNetwork;
  const contract = net.leash;
  if (!contract) notFound();

  const client = createPublicClient({
    chain: net.chain,
    transport: http(net.chain.rpcUrls.default.http[0], { timeout: 12_000, retryCount: 1 }),
  });

  type RawPolicy = {
    buyer: Address;
    agent: Address;
    perTxCap: bigint;
    budget: bigint;
    spent: bigint;
    dailyCap: bigint;
    daySpent: bigint;
    expiry: bigint;
    revoked: boolean;
    labelHash: `0x${string}`;
  };

  const count = await client
    .readContract({ address: contract, abi: leashAbi, functionName: "nextPolicyId" })
    .catch(() => 0n);
  if (policyId >= count) notFound();

  let p: RawPolicy;
  let allowlist: Address[];
  try {
    const [rawPolicy, rawAllowlist] = await Promise.all([
      client.readContract({ address: contract, abi: leashAbi, functionName: "policyOf", args: [policyId] }),
      client.readContract({ address: contract, abi: leashAbi, functionName: "allowlistOf", args: [policyId] }),
    ]);
    p = rawPolicy as RawPolicy;
    allowlist = [...rawAllowlist] as Address[];
  } catch {
    notFound();
  }

  const status = policyStatus(p);
  const remaining = p.budget > p.spent ? p.budget - p.spent : 0n;
  const dailyRemaining = p.dailyCap > p.daySpent ? p.dailyCap - p.daySpent : 0n;
  const usedPct = p.budget > 0n ? Number((p.spent * 10_000n) / p.budget) / 100 : 0;
  const history = await Promise.race([
    getSpendHistory().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_500)),
  ]);
  const spends = (history?.spends ?? [])
    .filter((s) => s.policyId === policyId)
    .slice()
    .reverse();
  const zeroLabel = /^0x0{64}$/.test(p.labelHash);

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Agent allowance</p>
          <h1>
            Policy #{id}{" "}
            <span className={`badge ${status === "active" ? "good" : status === "revoked" ? "bad" : "warn"}`}>{status}</span>
          </h1>
          <p className="lede">
            {status === "active"
              ? `${tokenAmount(remaining)} tUSD8 still available to the agent, under the terms the buyer signed.`
              : status === "revoked"
                ? "The buyer killed this policy. It is final and cannot be resumed."
                : "The policy expiry passed. No further spends are possible."}
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn ghost" href="/activity">All activity</Link>
          <Link className="btn" href="/new">Create another</Link>
        </div>
      </div>

      <div className="metric-grid">
        <div className="card metric">
          <div className="metric-label">Remaining budget</div>
          <div className="metric-value">{tokenAmount(remaining)} <small>tUSD8</small></div>
        </div>
        <div className="card metric">
          <div className="metric-label">Settled / budget</div>
          <div className="metric-value">{tokenAmount(p.spent)} <small>/ {tokenAmount(p.budget)} tUSD8</small></div>
        </div>
        <div className="card metric">
          <div className="metric-label">Per-transaction cap</div>
          <div className="metric-value">{tokenAmount(p.perTxCap)} <small>tUSD8</small></div>
        </div>
        <div className="card metric">
          <div className="metric-label">Daily cap left</div>
          <div className="metric-value">{tokenAmount(dailyRemaining)} <small>tUSD8</small></div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="spread">
            <h2>Budget burned</h2>
            <span className="fine">{usedPct.toFixed(usedPct >= 10 ? 0 : 1)}% used</span>
          </div>
          <div className="progress" style={{ margin: "14px 0 10px" }}>
            <span style={{ width: `${Math.min(100, usedPct)}%` }} />
          </div>
          <dl className="kv" style={{ marginTop: 16 }}>
            <dt>Budget</dt>
            <dd>{formatUnits(p.budget, 6)} tUSD8</dd>
            <dt>Settled</dt>
            <dd>{formatUnits(p.spent, 6)} tUSD8</dd>
            <dt>Today</dt>
            <dd>{formatUnits(p.daySpent, 6)} / {formatUnits(p.dailyCap, 6)} tUSD8</dd>
            <dt>Expiry</dt>
            <dd>{formatExpiry(p.expiry)}</dd>
          </dl>
        </div>

        <div className="card">
          <h2>Policy terms</h2>
          <div className="detail-list" style={{ marginTop: 12 }}>
            <div className="detail-row">
              <span className="dt">Buyer</span>
              <span className="dd">
                <a href={`${links.explorer}/address/${p.buyer}`} target="_blank" rel="noreferrer">{short(p.buyer)} ↗</a>
                <CopyButton text={p.buyer} label="Copy" />
              </span>
            </div>
            <div className="detail-row">
              <span className="dt">Agent key</span>
              <span className="dd">
                <a href={`${links.explorer}/address/${p.agent}`} target="_blank" rel="noreferrer">{short(p.agent)} ↗</a>
                <CopyButton text={p.agent} label="Copy" />
              </span>
            </div>
            <div className="detail-row">
              <span className="dt">Label hash</span>
              <span className="dd">
                {zeroLabel ? <span className="fine">none</span> : short(p.labelHash, 10, 8)}
                {!zeroLabel && <CopyButton text={p.labelHash} label="Copy" />}
              </span>
            </div>
            <div className="detail-row">
              <span className="dt">Policy id</span>
              <span className="dd">{id}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="spread">
            <h2>Vendor allowlist</h2>
            <span className="badge blue">{allowlist.length} allowed</span>
          </div>
          {allowlist.length === 0 ? (
            <p className="fine" style={{ marginTop: 10 }}>
              This policy is open: the agent can pay any address, up to the caps and remaining budget. Create a policy with an
              allowlist when you want a true merchant allowlist.
            </p>
          ) : (
            <div className="detail-list" style={{ marginTop: 10 }}>
              {allowlist.map((vendor, index) => (
                <div className="detail-row" key={vendor}>
                  <span className="dt">#{index + 1}</span>
                  <span className="dd">
                    <a href={`${links.explorer}/address/${vendor}`} target="_blank" rel="noreferrer">{short(vendor, 10, 8)} ↗</a>
                    <CopyButton text={vendor} label="Copy" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Buyer-only controls</h2>
          <p className="fine" style={{ marginTop: 10 }}>
            Only the buyer can change these terms. Every action is a single onchain transaction and takes effect immediately.
          </p>
          <ul>
            <li><strong>revoke()</strong> — kill the policy permanently.</li>
            <li><strong>setLimits()</strong> — lower the caps and budget.</li>
            <li><strong>extend()</strong> — move the expiry forward.</li>
            <li><strong>setAllowlist()</strong> — replace the vendor list.</li>
          </ul>
          <p className="fine">
            The CLI and any wallet expose the same calls. See <Link href="/docs#contract">the contract API</Link> for the
            exact signatures and events.
          </p>
        </div>
      </div>

      <div className="card flush" style={{ marginTop: 16 }}>
        <div className="spread" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <h2 style={{ margin: 0 }}>Spends on this policy</h2>
          <span className="fine">
            {history ? (history.complete ? "full history" : "recent window") : "history loading"}
          </span>
        </div>
        {spends.length === 0 ? (
          <div className="empty">
            <strong>{history ? "No spends recorded for this policy." : "Spend history is still loading."}</strong>
            <p className="fine">
              {history
                ? "The agent has not paid from this policy yet."
                : "The public explorer is slow; open Activity in a moment to see the full record."}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Block</th><th>Vendor</th><th className="right">Amount</th><th>Purpose hash</th><th>Receipt</th></tr>
              </thead>
              <tbody>
                {spends.map((spend) => (
                  <tr key={`${spend.tx}-${spend.logIndex}`}>
                    <td className="num">{spend.block.toString()}</td>
                    <td className="mono">
                      <a href={`${links.explorer}/address/${spend.vendor}`} target="_blank" rel="noreferrer">
                        {short(spend.vendor)}
                      </a>
                    </td>
                    <td className="right num strong">{tokenAmount(spend.amount)} tUSD8</td>
                    <td className="mono">
                      <span className="row-inline">
                        {short(spend.purposeHash, 8, 6)}
                        <CopyButton text={spend.purposeHash} label="Copy" />
                      </span>
                    </td>
                    <td>
                      <Link href={`/receipts/${spend.tx}`}>verify</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="fine" style={{ marginTop: 16 }}>
        Policy {id} on {net.chain.name}. Contract{" "}
        <a href={`${links.explorer}/address/${contract}`} target="_blank" rel="noreferrer" className="mono">
          {short(contract)}
        </a>
        . The policy is the source of truth; this page is a read-only view.
      </p>
    </main>
  );
}
