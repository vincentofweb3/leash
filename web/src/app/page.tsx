import Link from "next/link";
import { links } from "@aevum-kit/aevum";
import { GitHubIcon } from "@/components/Icons";
import { getOverview, policyStatus, tokenAmount, type Overview, type OverviewPolicy, type OverviewSpend } from "@/lib/chain-read";
import { repoUrl } from "@/lib/env";
import { short } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  let overview: Overview | null = null;
  try {
    overview = await getOverview();
  } catch {
    overview = null;
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Agentic payments · QDay Aevum</p>
          <h1>
            Your agent pays.
            <br />
            <span className="gradient-text">Only what you allow.</span>
          </h1>
          <p className="lede">
            Leash is the spend-allowance layer for AI agents. Set a per-transaction cap, a total budget, an optional
            daily cap and a vendor allowlist onchain - then hand your agent a session key. It pays in tUSD8 inside the
            limits you set, or not at all. Revoke the key in one transaction; unspent money never moves.
          </p>
          <div className="hero-actions">
            <Link href="/new" className="btn big">
              Create an allowance <span className="arrow" aria-hidden="true">→</span>
            </Link>
            <Link href="/docs" className="btn secondary big">Read the docs</Link>
          </div>
          <div className="hero-trust">
            <span className="pill"><span className="dot" aria-hidden="true" /> Non-custodial</span>
            <span className="pill">No admin keys</span>
            <span className="pill">One-transaction revoke</span>
            <span className="pill">Onchain audit trail</span>
          </div>
        </div>
        <div className="hero-visual">
          <PolicyPreview overview={overview} />
        </div>
      </section>

      <section aria-label="Live network statistics">
        <Stats overview={overview} />
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">The gap</p>
            <h2>An agent with a wallet is an unbounded API key.</h2>
            <p className="sub">
              Agents are becoming the ones that actually spend money: buying compute, paying invoices, settling API
              bills. Existing tools force a bad choice between total trust and total friction.
            </p>
          </div>
        </div>
        <div className="grid-3">
          <div className="card card-hover feature">
            <span className="feature-icon" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v2" />
              </svg>
            </span>
            <h3>A raw key is all-or-nothing</h3>
            <p>Hand an agent a funded key and a prompt injection, a bug or a leak drains everything. There is no cap, no allowlist and nothing to revoke but the whole wallet.</p>
          </div>
          <div className="card card-hover feature">
            <span className="feature-icon peach" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" />
              </svg>
            </span>
            <h3>Approving every payment kills autonomy</h3>
            <p>A human has to be awake for every invoice. That defeats the point of an always-on agent, and it gets worse as the number of agents grows.</p>
          </div>
          <div className="card card-hover feature">
            <span className="feature-icon cyan" aria-hidden="true">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2.5" y="6" width="19" height="13" rx="2" /><path d="M2.5 10h19" /><path d="M6 15h4" />
              </svg>
            </span>
            <h3>Shared cards hide who spent what</h3>
            <p>Corporate cards were built for people. They cannot express &ldquo;this agent may spend 10 tUSD8 per invoice, only at these vendors, until Friday&rdquo; — and they leave no machine-verifiable trail.</p>
          </div>
        </div>
        <div className="card info">
          <div className="spread">
            <div>
              <h3>The missing middle: machine speed, human limits</h3>
              <p className="sub" style={{ marginBottom: 0 }}>
                Leash enforces the policy in the settlement contract itself - not in the agent&apos;s prompt, not in a
                backend. The agent can pay without asking; the buyer keeps every control.
              </p>
            </div>
            <Link href="/docs#security" className="btn secondary small">How enforcement works</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2>Four steps, two signatures, one policy.</h2>
            <p className="sub">The buyer signs twice. After that the agent pays within the policy - and anyone can verify every payment.</p>
          </div>
          <a className="btn secondary small" href={repoUrl} target="_blank" rel="noreferrer">
            <GitHubIcon /> Source code
          </a>
        </div>
        <div className="split-panel">
          <div className="timeline">
            <div className="tl-item">
              <span className="tl-num">01</span>
              <div className="tl-body">
                <h3>Approve exactly the budget</h3>
                <p>One ERC-20 approval to the Leash contract. Never infinite: the allowance equals the policy budget, and you can zero it at any time.</p>
              </div>
            </div>
            <div className="tl-item">
              <span className="tl-num">02</span>
              <div className="tl-body">
                <h3>Create the policy onchain</h3>
                <p>Per-transaction cap, total budget, optional daily cap, vendor allowlist (≤ 16) and an expiry. The agent&apos;s session address goes in - your key never leaves your wallet.</p>
              </div>
            </div>
            <div className="tl-item">
              <span className="tl-num">03</span>
              <div className="tl-body">
                <h3>Your agent signs SpendAuth</h3>
                <p>Each purchase is an EIP-712 message: vendor, amount, purpose hash, single-use nonce and a short expiry. The CLI refuses to sign anything that would revert.</p>
              </div>
            </div>
            <div className="tl-item">
              <span className="tl-num">04</span>
              <div className="tl-body">
                <h3>The contract enforces and settles</h3>
                <p>Leash checks the signature, revocation, expiry, caps, daily limit and allowlist - then pulls tUSD8 from buyer to vendor and emits a typed <code>Spent</code> event.</p>
              </div>
            </div>
          </div>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="spread">
              <h3 style={{ fontSize: 14 }}>The agent side is one command</h3>
              <span className="badge good">fail-closed</span>
            </div>
            <pre className="code" style={{ flex: 1 }}>{`$ leash pay --bundle policy-0.json \\
    --key agent.key \\
    --vendor 0xInvoices… \\
    --amount 0.50 \\
    --purpose "invoice #1042"

policy   #0 · active (checked onchain)
caps     per-tx 1.00 · budget 1.00
vendor   allowed
submit   spend(auth, v, r, s)
settled  0.50 tUSD8 → 0xInvoices…
remaining 0.50 tUSD8`}</pre>
            <p className="fine">
              Signatures are EIP-712, replay protection is per-policy nonces, and the purpose text stays offchain while
              its hash goes onchain. <Link href="/docs#spendauth">Read the schema</Link>.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Product</p>
            <h2>Everything a buyer needs to say yes to an agent.</h2>
            <p className="sub">The desk, the CLI, the SDK and the receipt verifier are one product — no hidden backend, no database, no custody.</p>
          </div>
        </div>
        <div className="grid-2">
          <div className="surface-list card">
            <div className="surface">
              <span className="surface-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 9h18" /><path d="M8 14h4" /></svg>
              </span>
              <div className="surface-body">
                <h3>The desk</h3>
                <p>Create policies, watch budgets draw down, adjust caps, extend expiry and revoke — with your own wallet.</p>
              </div>
              <Link className="surface-link" href="/new">Open <span className="arrow">→</span></Link>
            </div>
            <div className="surface">
              <span className="surface-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-5-6-5" /><path d="M12 19h8" /></svg>
              </span>
              <div className="surface-body">
                <h3>The agent CLI</h3>
                <p><code>leash keygen</code>, <code>show</code>, <code>pay</code>, <code>activity</code>. Reads the policy before signing and fails closed.</p>
              </div>
              <Link className="surface-link" href="/docs#flow">Docs <span className="arrow">→</span></Link>
            </div>
            <div className="surface">
              <span className="surface-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6l-5 6 5 6" /><path d="M16 6l5 6-5 6" /></svg>
              </span>
              <div className="surface-body">
                <h3>The SDK</h3>
                <p><code>@leash/kit</code> ships the ABI, EIP-712 builders and the bundle format, so any agent framework can integrate in an afternoon.</p>
              </div>
              <Link className="surface-link" href="/docs#integration">Integrate <span className="arrow">→</span></Link>
            </div>
            <div className="surface">
              <span className="surface-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14v18l-7-4-7 4V3z" /><path d="M9 8h6" /><path d="M9 12h6" /></svg>
              </span>
              <div className="surface-body">
                <h3>The receipt verifier</h3>
                <p>Paste any transaction hash and the page re-derives the <code>Spent</code> event from the chain receipt. No trust in us required.</p>
              </div>
              <Link className="surface-link" href="/receipts">Verify <span className="arrow">→</span></Link>
            </div>
          </div>
          <div className="card">
            <h2>Watch the allowance, not the agent.</h2>
            <p className="sub">The policy page is the buyer&apos;s cockpit: remaining budget, every spend, and the one button that ends it.</p>
            <dl className="kv" style={{ marginTop: 6 }}>
              <dt>Budget</dt><dd>1.00 tUSD8</dd>
              <dt>Per transaction</dt><dd>1.00 tUSD8</dd>
              <dt>Daily cap</dt><dd>1.00 tUSD8</dd>
              <dt>Vendors</dt><dd>any (allowlist optional)</dd>
              <dt>Expiry</dt><dd>30 days</dd>
              <dt>Revoke</dt><dd>one transaction, final</dd>
            </dl>
            <div className="divider" style={{ margin: "16px 0" }} />
            <p className="fine">
              A stolen session key can spend at most the per-transaction cap × the remaining budget, only at allowed
              vendors, only before expiry. That is the entire blast radius - and it is public.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Safety</p>
            <h2>No custody. No admin. Nothing to trust.</h2>
            <p className="sub">The contract is deliberately boring: it verifies and it settles. It never holds funds and has no owner, pause switch, upgrade path or fee.</p>
          </div>
        </div>
        <div className="grid-3">
          <div className="card feature">
            <span className="feature-icon good" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
            </span>
            <h3>Buyer-only controls</h3>
            <p>Only the address that created a policy can revoke it, change its limits, extend expiry or edit the allowlist. No third party can move your money.</p>
          </div>
          <div className="card feature">
            <span className="feature-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16" /><path d="M4 6h16" /><path d="M4 18h10" /></svg>
            </span>
            <h3>Least privilege</h3>
            <p>A session key can only sign <code>SpendAuth</code>. It cannot approve tokens, transfer to itself, create policies or touch another policy.</p>
          </div>
          <div className="card feature">
            <span className="feature-icon peach" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3" /><path d="M12 18v3" /><path d="M3 12h3" /><path d="M18 12h3" /><circle cx="12" cy="12" r="4" /></svg>
            </span>
            <h3>Fail closed, in public</h3>
            <p>Every rejection has a named error. Every spend emits a typed event with a purpose hash. The CLI refuses to sign blind; the contract checks again onchain.</p>
          </div>
        </div>
        <div className="notice warn">
          <strong>Honest status: testnet software, unaudited.</strong>
          <span>
            Leash targets the QDay Aevum testnet and tUSD8. Do not point it at money you cannot lose. The full threat
            model and known limitations are in <Link href="/docs#limitations">the docs</Link>.
          </span>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Compare</p>
            <h2>Why not just approve everything, or hand over the key?</h2>
          </div>
        </div>
        <div className="compare-wrap">
          <table className="data">
            <thead>
              <tr><th>Capability</th><th>Raw agent key</th><th>Approve every payment</th><th>Leash</th></tr>
            </thead>
            <tbody>
              <tr><td>Agent acts without a human</td><td>yes</td><td>no</td><td><strong>yes, inside the policy</strong></td></tr>
              <tr><td>Blast radius if the key leaks</td><td>the whole wallet</td><td>none</td><td><strong>per-tx cap × remaining budget</strong></td></tr>
              <tr><td>Vendor restrictions</td><td>none</td><td>per payment</td><td><strong>onchain allowlist</strong></td></tr>
              <tr><td>Daily pace</td><td>none</td><td>manual</td><td><strong>optional daily cap</strong></td></tr>
              <tr><td>Revoke in one transaction</td><td>rotate everything</td><td>n/a</td><td><strong>yes - revoke()</strong></td></tr>
              <tr><td>Audit trail</td><td>wallet history</td><td>wallet history</td><td><strong>typed Spent events + purpose hashes</strong></td></tr>
              <tr><td>Works with any agent framework</td><td>yes</td><td>no</td><td><strong>yes - CLI, SDK, or raw calldata</strong></td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2>Questions buyers actually ask.</h2>
          </div>
          <Link className="btn ghost small" href="/docs">All documentation <span className="arrow">→</span></Link>
        </div>
        <div className="faq-list">
          <details>
            <summary>Does the agent ever hold my funds?</summary>
            <p>No. tUSD8 stays in your wallet. Leash pulls it through your ERC-20 allowance at the moment of a spend, directly to the vendor. Unspent budget is never inside the contract, and the contract has no rescue or withdraw function.</p>
          </details>
          <details>
            <summary>What happens if the session key leaks?</summary>
            <p>The attacker can spend at most the per-transaction cap, per transaction, up to the remaining budget — only at allowlisted vendors, only before expiry. Revoke the policy and the key is dead immediately. That is a very different failure mode from losing a funded wallet.</p>
          </details>
          <details>
            <summary>Do I need to keep the agent online to monitor it?</summary>
            <p>No. The policy is enforced by the contract, not by a babysitter. The desk is for creating and adjusting policy, not for approving each payment. You can check the public activity feed whenever you want.</p>
          </details>
          <details>
            <summary>How do I verify a payment later?</summary>
            <p>Open <Link href="/receipts">the receipt verifier</Link> and paste the transaction hash. It reads the chain receipt and re-derives the <code>Spent</code> event, amount, vendor and purpose hash — no backend involved. Every spend on the policy page links there.</p>
          </details>
          <details>
            <summary>What is tUSD8 and where do I get it?</summary>
            <p>tUSD8 is the 6-decimal settlement token on QDay Aevum testnet. Use the <a href={links.faucetWeb} target="_blank" rel="noreferrer">web faucet</a> or the QDay Discord <code>/faucet</code> command. <a href="https://discord.gg/bYPhjmrSfK" target="_blank" rel="noreferrer">Discord invite</a>.</p>
          </details>
        </div>
      </section>

      <section className="cta-band">
        <div className="inner">
          <div>
            <p className="eyebrow">Ready when you are</p>
            <h2>Give the agent a leash, not your keys.</h2>
            <p>Connect a wallet on QDay Aevum testnet, approve the budget and create a policy in two transactions. The agent can be spending a minute later.</p>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Link href="/new" className="btn big">Create an allowance</Link>
            <Link href="/receipts" className="btn secondary big">Verify a receipt</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function PolicyPreview({ overview }: { overview: Overview | null }) {
  const policy = overview?.policy0 ?? null;
  const latest: OverviewSpend | undefined = overview?.spends.at(-1);
  if (!overview || !policy) {
    return (
      <div className="card pcard">
        <div className="pcard-top">
          <span className="pcard-title"><span className="dot" aria-hidden="true" /> Policy preview</span>
          <span className="badge">Aevum testnet</span>
        </div>
        <div className="pcard-skeleton">Live policy data is temporarily unavailable. <Link href="/activity">Open the activity feed</Link>.</div>
      </div>
    );
  }
  const status = policyStatus(policy);
  const pct = policy.budget > 0n ? Math.min(100, Number((policy.spent * 1000n) / policy.budget) / 10) : 0;
  const remaining = policy.budget > policy.spent ? policy.budget - policy.spent : 0n;
  return (
    <div className="card pcard">
      <div className="pcard-top">
        <span className="pcard-title"><span className="dot pulse" aria-hidden="true" /> Policy #{policy.policyId.toString()}</span>
        <span className={`badge ${status === "active" ? "good" : status === "revoked" ? "bad" : "warn"}`}>{status}</span>
      </div>
      <div className="pcard-body">
        <div className="pcard-agent">
          <span className="avatar-ring" aria-hidden="true">AG</span>
          <div>
            <div className="pcard-agent-name">Agent session key</div>
            <div className="pcard-agent-sub">{short(policy.agent, 10, 6)}</div>
          </div>
          <span className="badge blue" style={{ marginLeft: "auto" }}>live</span>
        </div>
        <div className="pcard-meter">
          <div className="pcard-meter-row">
            <span>Budget remaining</span>
            <strong>{tokenAmount(remaining)} <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-body)", fontWeight: 500 }}>tUSD8</span></strong>
          </div>
          <div className={`meter ${pct > 80 ? "warn" : ""}`}><span style={{ width: `${pct}%` }} /></div>
          <div className="pcard-meter-row" style={{ fontSize: 12 }}>
            <span>{tokenAmount(policy.spent)} spent</span>
            <span>{tokenAmount(policy.budget)} total</span>
          </div>
        </div>
        <div className="pcard-grid">
          <div className="pcard-cell"><span>Per tx</span><strong>{tokenAmount(policy.perTxCap)}</strong></div>
          <div className="pcard-cell"><span>Daily cap</span><strong>{policy.dailyCap === 0n ? "none" : tokenAmount(policy.dailyCap)}</strong></div>
          <div className="pcard-cell"><span>Expires</span><strong>{new Date(Number(policy.expiry) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong></div>
        </div>
        {latest ? (
          <Link href={`/receipts/${latest.tx}`} className="pcard-spend" style={{ color: "inherit" }}>
            <span className="left">
              <span className="dot" aria-hidden="true" />
              <span>
                <span className="amount">{tokenAmount(latest.amount)} tUSD8</span>
                <span className="vendor" style={{ display: "block" }}>to {short(latest.vendor)}</span>
              </span>
            </span>
            <span className="fine">receipt →</span>
          </Link>
        ) : policy?.spent > 0n ? (
          <div className="pcard-spend" style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}>
            <span className="left">
              <span className="dot" aria-hidden="true" />
              <span className="vendor">{tokenAmount(policy.spent)} tUSD8 settled - <Link href="/activity">view activity</Link></span>
            </span>
          </div>
        ) : (
          <div className="pcard-spend" style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}>
            <span className="left"><span className="dot warn" aria-hidden="true" /><span className="vendor">No spends yet. Create the first policy.</span></span>
          </div>
        )}
      </div>
      <div className="pcard-foot">
        <span>Live on Aevum · block {overview.head.toLocaleString("en-US")}</span>
        <Link href={`/policy/${policy.policyId}`}>Open the desk →</Link>
      </div>
    </div>
  );
}

function Stats({ overview }: { overview: Overview | null }) {
  const policies = overview?.policies ?? 0n;
  const settled = overview?.settled ?? 0n;
  const spends = overview?.spends.length ?? 0;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="stats-band">
        <div>
          <div className="label">Policies created</div>
          <div className="value">{policies.toString()}</div>
          <div className="note">Read from the contract</div>
        </div>
        <div>
          <div className="label">Settled through Leash</div>
          <div className="value">{tokenAmount(settled)} <small>tUSD8</small></div>
          <div className="note">{spends} typed Spent event{spends === 1 ? "" : "s"}</div>
        </div>
        <div>
          <div className="label">Unique vendors paid</div>
          <div className="value">{overview?.uniqueVendors ?? 0}</div>
          <div className="note">Derived from public logs</div>
        </div>
        <div>
          <div className="label">Network</div>
          <div className="value">Aevum <small>· 44005</small></div>
          <div className="note">Block {overview ? overview.head.toLocaleString("en-US") : "—"}</div>
        </div>
      </div>
      <p className="fine">
        Live from chain {overview?.chainId ?? 44005}, cached for 45 seconds.{" "}
        {overview ? (
          <>
            Contract{" "}
            <a className="moni" href={`${links.explorer}/address/${overview.contract}`} target="_blank" rel="noreferrer">
              {short(overview.contract, 10, 8)}
            </a>
            {overview.source === "explorer"
              ? " · full log history via the Blockscout explorer API"
              : overview.source === "rpc"
                ? " · recent 20,000 blocks via RPC"
                : " · derived from public logs"}. {overview.complete ? "" : " · most recent 20,000 blocks only"}.
          </>
        ) : (
          "RPC temporarily unavailable - the desk still reads onchain state directly."
        )}
      </p>
    </div>
  );
}
