"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { erc20Abi } from "@aevum-kit/aevum";
import { BUNDLE_VERSION, leashAbi, type PolicyBundle } from "@leash/kit";
import {
  formatUnits,
  isAddress,
  keccak256,
  parseUnits,
  stringToBytes,
  type Address,
  type Hash,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount, useBalance, useConfig, useReadContract } from "wagmi";
import { readContract, simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { CodeBlock } from "@/components/CodeBlock";
import { CopyButton } from "@/components/CopyButton";
import { useToken } from "@/components/useToken";
import { saveBundle } from "@/lib/bundle-store";
import { explain } from "@/lib/errors";
import { short } from "@/lib/format";
import { useNetwork } from "@/lib/network";

type Step = 1 | 2 | 3;
type Phase = "idle" | "approving" | "creating" | "done" | "error";

interface Result {
  policyId: string;
  tx: Hash;
  bundle: PolicyBundle;
  bundleJson: string;
  devKey: string | null;
}

const PRESETS = [
  { name: "Starter", perTx: "10", budget: "100", daily: "25", days: "30", note: "Agent buys small services" },
  { name: "Tight", perTx: "2", budget: "20", daily: "5", days: "7", note: "Invoice bot, one week" },
  { name: "Runway", perTx: "50", budget: "500", daily: "100", days: "90", note: "Long-running operations" },
];

export function NewPolicyClient() {
  const { net } = useNetwork();
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === net.chain.id;
  const leash = net.leash;
  const token = useToken();
  const decimals = token.decimals;

  const [step, setStep] = useState<Step>(1);
  const [agentAddress, setAgentAddress] = useState("");
  const [devKey, setDevKey] = useState<string | null>(null);
  const [perTxCap, setPerTxCap] = useState("10");
  const [budget, setBudget] = useState("100");
  const [dailyCap, setDailyCap] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [label, setLabel] = useState("");
  const [allowlistText, setAllowlistText] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const balance = useBalance({
    address,
    token: token.address,
    chainId: net.chain.id,
    query: { enabled: Boolean(address && token.address) },
  });
  const gasBalance = useBalance({ address, chainId: net.chain.id, query: { enabled: Boolean(address) } });
  const allowance = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && leash ? [address, leash] : undefined,
    chainId: net.chain.id,
    query: { enabled: Boolean(address && leash && token.address) },
  });

  const parsed = useMemo(() => {
    const allowlist = allowlistText
      .split(/[\n,]/)
      .map((l) => l.trim())
      .filter(Boolean);
    return {
      agent: agentAddress.trim(),
      allowlist,
      perTxCap: safeParse(perTxCap, decimals),
      budget: safeParse(budget, decimals),
      dailyCap: dailyCap.trim() === "" ? 0n : safeParse(dailyCap, decimals),
      expiryDays: Number(expiryDays),
    };
  }, [agentAddress, allowlistText, perTxCap, budget, dailyCap, expiryDays, decimals]);

  const agentProblems: string[] = [];
  if (!isAddress(parsed.agent)) agentProblems.push("Paste the agent's session address, or generate one below.");
  else if (address && parsed.agent.toLowerCase() === address.toLowerCase()) agentProblems.push("Use a dedicated session key, not your buyer wallet.");
  const limitProblems: string[] = [];
  parsed.allowlist.forEach((a) => {
    if (!isAddress(a)) limitProblems.push(`Allowlist entry is not an address: ${a}`);
  });
  if (parsed.allowlist.length > 16) limitProblems.push("The allowlist is limited to 16 vendors.");
  if (parsed.perTxCap === null || parsed.perTxCap === 0n) limitProblems.push("Per-transaction cap must be more than zero.");
  if (parsed.budget === null || parsed.budget === 0n) limitProblems.push("Budget must be more than zero.");
  if (parsed.perTxCap !== null && parsed.budget !== null && parsed.perTxCap > parsed.budget) {
    limitProblems.push("Per-transaction cap cannot exceed the budget.");
  }
  if (parsed.dailyCap === null) limitProblems.push("Daily cap must be a number, or empty for no daily limit.");
  if (!Number.isFinite(parsed.expiryDays) || parsed.expiryDays <= 0) limitProblems.push("Expiry must be at least 1 day.");
  if (!Number.isFinite(parsed.expiryDays) || parsed.expiryDays > 3650) limitProblems.push("Expiry cannot exceed 10 years.");

  const busy = phase === "approving" || phase === "creating";
  const ready = onChain && Boolean(leash) && limitProblems.length === 0 && agentProblems.length === 0 && !busy;
  const budgetDisplay = parsed.budget !== null ? formatUnits(parsed.budget, decimals) : "—";
  const perTxDisplay = parsed.perTxCap !== null ? formatUnits(parsed.perTxCap, decimals) : "—";
  const dailyDisplay = parsed.dailyCap === null ? "—" : parsed.dailyCap === 0n ? "none" : formatUnits(parsed.dailyCap, decimals);
  const needsApproval = parsed.budget !== null && (allowance.data === undefined || allowance.data < parsed.budget);
  const baseBalance = balance.data ? Number(formatUnits(balance.data.value, decimals)) : null;
  const budgetNumber = parsed.budget !== null ? Number(formatUnits(parsed.budget, decimals)) : null;
  const shortOfFunds = baseBalance !== null && budgetNumber !== null && budgetNumber > baseBalance;

  function applyPreset(p: (typeof PRESETS)[number]) {
    setPerTxCap(p.perTx);
    setBudget(p.budget);
    setDailyCap(p.daily);
    setExpiryDays(p.days);
  }

  function generateDevKey() {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    setAgentAddress(account.address);
    setDevKey(key);
  }

  function download(name: string, contents: string, type = "application/json") {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createPolicy() {
    if (!ready || !address || !leash || !token.address || parsed.budget === null || parsed.perTxCap === null) return;
    setPhase("approving");
    setError(null);
    try {
      const budgetUnits = parsed.budget;
      const currentAllowance = await readContract(config, {
        address: token.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, leash],
        chainId: net.chain.id,
      });
      if (currentAllowance < budgetUnits) {
        const approveHash = await writeContract(config, {
          address: token.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [leash, budgetUnits],
          chainId: net.chain.id,
          type: "legacy",
        });
        await waitForTransactionReceipt(config, { hash: approveHash, chainId: net.chain.id });
      }

      setPhase("creating");
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Math.floor(parsed.expiryDays * 86400));
      const labelHash = label.trim()
        ? keccak256(stringToBytes(label.trim()))
        : (`0x${"00".repeat(32)}` as `0x${string}`);
      const allowlist = parsed.allowlist as Address[];
      const args = [parsed.agent as Address, parsed.perTxCap, budgetUnits, parsed.dailyCap ?? 0n, expiry, labelHash, allowlist] as const;
      const simulation = await simulateContract(config, {
        address: leash,
        abi: leashAbi,
        functionName: "createPolicy",
        args,
        chainId: net.chain.id,
        account: address,
      });
      const hash = await writeContract(config, {
        address: leash,
        abi: leashAbi,
        functionName: "createPolicy",
        args,
        chainId: net.chain.id,
        type: "legacy",
      });
      await waitForTransactionReceipt(config, { hash, chainId: net.chain.id });

      const policyId = simulation.result.toString();
      const bundle: PolicyBundle = {
        version: BUNDLE_VERSION as 1,
        chainId: net.chain.id,
        leash,
        policyId,
        buyer: address,
        agent: parsed.agent as Address,
        label: label.trim(),
        perTxCap: parsed.perTxCap.toString(),
        budget: budgetUnits.toString(),
        dailyCap: (parsed.dailyCap ?? 0n).toString(),
        expiry: expiry.toString(),
        createdAt: new Date().toISOString(),
      };
      saveBundle(net.chain.id, bundle);
      setResult({ policyId, tx: hash, bundle, bundleJson: JSON.stringify(bundle, null, 2), devKey });
      setPhase("done");
      void balance.refetch();
      void allowance.refetch();
    } catch (e) {
      setError(explain(e));
      setPhase("error");
    }
  }

  if (!leash) {
    return (
      <main className="shell">
        <div className="page-head">
          <div>
            <p className="eyebrow">Setup</p>
            <h1>This deployment of Leash isn&apos;t configured.</h1>
            <p className="lede">
              Set <span className="mono">NEXT_PUBLIC_LEASH_AEVUM</span> (or <span className="mono">NEXT_PUBLIC_LEASH_FORK</span>) plus
              <span className="mono"> NEXT_PUBLIC_DEPLOY_BLOCK_AEVUM</span>, then redeploy the web app.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (result) {
    return <Success result={result} onReset={() => {
      setResult(null);
      setPhase("idle");
      setStep(1);
      setAgentAddress("");
      setDevKey(null);
      setLabel("");
      setAllowlistText("");
    }} />;
  }

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">New allowance</p>
          <h1>Bound your agent&apos;s spend.</h1>
          <p className="lede">
            Three steps: point the policy at the agent, set the limits, sign. The agent gets a session key it can use
            inside those limits — and nothing else.
          </p>
        </div>
        <div className="page-actions">
          <Link className="btn ghost small" href="/docs#flow">How it works</Link>
        </div>
      </div>

      <div className="wizard">
        <div className="wizard-main">
          <div className="wizard-steps" aria-label="Progress">
            <div className={`wizard-step ${step === 1 ? "active" : step > 1 ? "done" : ""}`} aria-current={step === 1 ? "step" : undefined}>
              <span className="n">{step > 1 ? "✓" : "1"}</span><span className="label">Agent</span>
            </div>
            <div className={`wizard-step ${step === 2 ? "active" : step > 2 ? "done" : ""}`} aria-current={step === 2 ? "step" : undefined}>
              <span className="n">{step > 2 ? "✓" : "2"}</span><span className="label">Limits</span>
            </div>
            <div className={`wizard-step ${step === 3 ? "active" : ""}`} aria-current={step === 3 ? "step" : undefined}>
              <span className="n">3</span><span className="label">Review &amp; sign</span>
            </div>
          </div>

          {step === 1 && (
            <div className="card">
              <h2>Who is spending?</h2>
              <p className="sub">
                The agent&apos;s <strong>session address</strong> — an EOA the agent controls. It can only sign spend
                authorizations; it cannot move tokens any other way. Your buyer wallet stays separate.
              </p>
              <label className="field">
                <span>Agent session address</span>
                <input
                  className="input mono"
                  placeholder="0x…"
                  value={agentAddress}
                  onChange={(e) => setAgentAddress(e.target.value)}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={agentAddress.length > 0 && !isAddress(agentAddress)}
                />
                <span className="field-hint">
                  In production, run <code>leash keygen</code> on the agent host. The private key never needs to touch this page.
                </span>
              </label>
              <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <button className="btn ghost small" type="button" onClick={generateDevKey}>
                  Generate a dev-mode key in this browser
                </button>
                {parsed.agent && isAddress(parsed.agent) && (
                  <span className="badge good">valid address</span>
                )}
              </div>
              {devKey && (
                <div className="notice warn" style={{ marginTop: 14 }}>
                  <strong>Dev-mode session key — shown once, keep it safe.</strong>
                  <code style={{ wordBreak: "break-all", fontSize: 12 }}>{devKey}</code>
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    <button className="btn ghost small" type="button" onClick={() => download("agent.key", `${devKey}\n`, "text/plain")}>
                      Download agent.key
                    </button>
                    <CopyButton text={devKey} label="Copy key" />
                  </div>
                  <span className="fine">
                    For production, generate the key on the agent machine with <code>leash keygen</code>. This browser
                    flow exists so the demo works end to end.
                  </span>
                </div>
              )}
              {agentProblems.length > 0 && agentAddress.length > 0 && (
                <div className="notice bad" style={{ marginTop: 12 }}>{agentProblems[0]}</div>
              )}
              <div className="row" style={{ justifyContent: "flex-end", marginTop: 18 }}>
                <button className="btn" type="button" disabled={agentProblems.length > 0} onClick={() => setStep(2)}>
                  Continue to limits <span className="arrow">→</span>
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="card">
              <h2>Set the limits</h2>
              <p className="sub">Amounts are in {token.symbol}. Empty daily cap means no daily limit. Empty allowlist means any vendor.</p>
              <div className="preset-row" role="group" aria-label="Presets">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" className="preset" onClick={() => applyPreset(p)} title={p.note}>
                    {p.name} · {p.perTx}/{p.budget}
                  </button>
                ))}
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Per-transaction cap</span>
                  <input className="input num" inputMode="decimal" value={perTxCap} onChange={(e) => setPerTxCap(e.target.value)} />
                </label>
                <label className="field">
                  <span>Total budget</span>
                  <input className="input num" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
                </label>
                <label className="field">
                  <span>Daily cap <span className="opt">(optional)</span></span>
                  <input className="input num" inputMode="decimal" placeholder="e.g. 25" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
                </label>
                <label className="field">
                  <span>Expiry (days)</span>
                  <input className="input num" inputMode="numeric" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
                </label>
              </div>
              <label className="field">
                <span>Label <span className="opt">(optional, stored as a hash onchain)</span></span>
                <input className="input" placeholder="e.g. cloud-invoice payment bot" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={64} />
              </label>
              <label className="field">
                <span>Vendor allowlist <span className="opt">(optional, one address per line)</span></span>
                <textarea
                  className="input mono"
                  rows={3}
                  placeholder={"0xVendor1\n0xVendor2"}
                  value={allowlistText}
                  onChange={(e) => setAllowlistText(e.target.value)}
                  spellCheck={false}
                />
                <span className="field-hint">Up to 16 addresses. Leave empty to let the agent pay any vendor.</span>
              </label>

              {limitProblems.length > 0 && (
                <div className="notice warn" style={{ marginBottom: 12 }}>
                  <strong>Fix before continuing:</strong>
                  <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>
                    {limitProblems.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                </div>
              )}

              <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                <button className="btn ghost" type="button" onClick={() => setStep(1)}>← Back</button>
                <button className="btn" type="button" disabled={limitProblems.length > 0} onClick={() => setStep(3)}>
                  Review the policy <span className="arrow">→</span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card">
              <h2>Review and sign</h2>
              <p className="sub">
                {needsApproval
                  ? `Two wallet transactions: approve exactly ${budgetDisplay} ${token.symbol}, then create the policy.`
                  : `Your allowance is already at least ${budgetDisplay} ${token.symbol} — one transaction creates the policy.`}
              </p>

              <div className="detail-list">
                <div className="detail-row"><span className="dt">Agent</span><span className="dd">{short(parsed.agent, 12, 8)}</span></div>
                <div className="detail-row"><span className="dt">Per transaction</span><span className="dd">{perTxDisplay} {token.symbol}</span></div>
                <div className="detail-row"><span className="dt">Total budget</span><span className="dd">{budgetDisplay} {token.symbol}</span></div>
                <div className="detail-row"><span className="dt">Daily cap</span><span className="dd">{dailyDisplay === "none" ? "none" : `${dailyDisplay} ${token.symbol}`}</span></div>
                <div className="detail-row"><span className="dt">Expiry</span><span className="dd">{parsed.expiryDays} days</span></div>
                <div className="detail-row"><span className="dt">Vendors</span><span className="dd">{parsed.allowlist.length === 0 ? "any" : `${parsed.allowlist.length} allowlisted`}</span></div>
                <div className="detail-row"><span className="dt">Label</span><span className="dd">{label.trim() || "none"}</span></div>
              </div>

              {!isConnected && (
                <div className="notice info" style={{ marginTop: 16 }}>
                  <strong>Connect the buyer wallet to sign.</strong>
                  <span>You are on {net.label}; the policy is created from your own wallet.</span>
                  <div style={{ marginTop: 8 }}><ConnectButton showBalance={false} /></div>
                </div>
              )}
              {isConnected && !onChain && (
                <div className="notice warn" style={{ marginTop: 16 }}>
                  <strong>Wrong network.</strong>
                  <span>Switch your wallet to {net.chain.name} ({net.chain.id}) using the header.</span>
                </div>
              )}
              {onChain && shortOfFunds && (
                <div className="notice warn" style={{ marginTop: 16 }}>
                  <strong>The policy can be created, but the wallet holds less {token.symbol} than the budget.</strong>
                  <span>
                    Approval does not move funds, but spends will revert until the buyer holds at least the budget.
                    Current balance: {baseBalance ?? 0} {token.symbol}.
                  </span>
                </div>
              )}
              {onChain && gasBalance.data && gasBalance.data.value === 0n && (
                <div className="notice warn" style={{ marginTop: 16 }}>
                  <strong>No tQDAY for gas.</strong>
                  <span>Fund this wallet from the faucet before signing.</span>
                </div>
              )}
              {error && <div className="notice bad" style={{ marginTop: 16 }}>{error}</div>}

              <button className="btn big block" style={{ marginTop: 18 }} type="button" disabled={!ready} onClick={() => void createPolicy()}>
                {phase === "approving" ? (<><span className="spinner" /> Approving budget…</>) : phase === "creating" ? (<><span className="spinner" /> Creating policy…</>) : (`Approve ${budgetDisplay} ${token.symbol} & create policy`)}
              </button>
              <p className="fine" style={{ marginTop: 10 }}>
                You sign with your own wallet. Unspent {token.symbol} never leaves it, and you can zero the allowance at
                any time. The approved amount is exactly the policy budget — never unlimited.
              </p>
              <div className="row" style={{ justifyContent: "flex-start", marginTop: 8 }}>
                <button className="btn ghost small" type="button" onClick={() => setStep(2)} disabled={busy}>← Edit limits</button>
              </div>
            </div>
          )}
        </div>

        <aside className="card summary-card" aria-label="Policy draft">
          <div className="spread">
            <h3>Policy draft</h3>
            <span className="badge">not signed</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="summary-line"><span className="k">Agent</span><span className="v">{parsed.agent && isAddress(parsed.agent) ? short(parsed.agent, 9, 6) : "—"}</span></div>
            <div className="summary-line"><span className="k">Per tx cap</span><span className="v">{perTxDisplay} {token.symbol}</span></div>
            <div className="summary-line"><span className="k">Daily cap</span><span className="v">{dailyDisplay === "none" ? "none" : dailyDisplay}</span></div>
            <div className="summary-line"><span className="k">Expiry</span><span className="v">{Number.isFinite(parsed.expiryDays) ? `${parsed.expiryDays} days` : "—"}</span></div>
            <div className="summary-line"><span className="k">Allowlist</span><span className="v">{parsed.allowlist.length === 0 ? "any vendor" : `${parsed.allowlist.length} vendors`}</span></div>
          </div>
          <div className="summary-total">
            <span className="k muted" style={{ fontSize: 13 }}>Budget</span>
            <span className="v">{budgetDisplay} <small style={{ fontSize: 13, color: "var(--text-muted)" }}>{token.symbol}</small></span>
          </div>
          {onChain && (
            <p className="fine" style={{ marginTop: 12 }}>
              Wallet {short(address ?? "", 8, 6)} · {baseBalance ?? "…"} {token.symbol} available
              {allowance.data !== undefined && <> · allowance {formatUnits(allowance.data, decimals)}</>}
            </p>
          )}
          <div className="divider" style={{ margin: "14px 0" }} />
          <p className="fine">
            A leaked session key can spend at most the per-tx cap × remaining budget, only at allowed vendors, only
            before expiry. Revoke kills it in one transaction.
          </p>
          <Link className="fine" href="/docs#security" style={{ display: "inline-block", marginTop: 8 }}>Read the security model →</Link>
        </aside>
      </div>
    </main>
  );
}

function Success({ result, onReset }: { result: Result; onReset: () => void }) {
  const { bundle } = result;
  const decimals = 6;
  return (
    <main className="shell">
      <div className="card" style={{ maxWidth: 820, margin: "0 auto", width: "100%" }}>
        <div className="notice good" style={{ marginBottom: 18 }}>
          <strong>Policy #{result.policyId} is live onchain.</strong>
          <span className="row-inline">
            <a className="mono" href={`https://explorer-test.qday.info/tx/${result.tx}`} target="_blank" rel="noreferrer">
              {short(result.tx, 14, 8)}
            </a>
            <CopyButton text={result.tx} label="Copy tx" />
          </span>
        </div>
        <h2>Hand this to your agent</h2>
        <p className="sub">
          The bundle has no secrets. The session key does — powering the agent means giving <em>it</em> the key, never
          this page.
        </p>
        <div className="row" style={{ gap: 10, marginBottom: 16 }}>
          <button className="btn secondary" type="button" onClick={() => downloadFile(`leash-policy-${result.policyId}.json`, result.bundleJson)}>
            Download bundle.json
          </button>
          {result.devKey && (
            <button className="btn ghost" type="button" onClick={() => downloadFile("agent.key", `${result.devKey}\n`, "text/plain")}>
              Download agent.key
            </button>
          )}
          <Link className="btn" href={`/policy/${result.policyId}`}>Open the policy desk</Link>
        </div>

        <h3 style={{ marginBottom: 8 }}>Run the agent</h3>
        <CodeBlock
          code={`leash pay --bundle leash-policy-${result.policyId}.json \\
  --key agent.key --vendor 0xVendor… --amount 0.5 \\
  --purpose "invoice #1042"`}
        />
        <p className="fine" style={{ marginTop: 10 }}>
          The CLI reads the policy onchain first and refuses to sign if the spend would revert. The bundle grants no
          spending power on its own.
        </p>

        <div className="divider" style={{ margin: "18px 0" }} />
        <div className="grid-2">
          <div>
            <h3 style={{ fontSize: 14 }}>Policy summary</h3>
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Agent</dt><dd>{short(bundle.agent, 10, 6)}</dd>
              <dt>Per tx</dt><dd>{formatUnits(BigInt(bundle.perTxCap), decimals)} tUSD8</dd>
              <dt>Budget</dt><dd>{formatUnits(BigInt(bundle.budget), decimals)} tUSD8</dd>
              <dt>Expiry</dt><dd>{new Date(Number(bundle.expiry) * 1000).toLocaleDateString()}</dd>
            </dl>
          </div>
          <div>
            <h3 style={{ fontSize: 14 }}>Next</h3>
            <ul style={{ marginTop: 8 }}>
              <li>Watch it draw down on <Link href={`/policy/${result.policyId}`}>the policy desk</Link>.</li>
              <li>Every payment appears on <Link href="/activity">activity</Link> and can be checked at <Link href="/receipts">receipts</Link>.</li>
              <li>Kill the key anytime with <code>revoke()</code>.</li>
            </ul>
          </div>
        </div>
        {result.devKey && (
          <div className="notice warn" style={{ marginTop: 16 }}>
            <strong>The dev-mode key was generated in this browser.</strong>
            <span>It is not stored anywhere after this page. Download it now if you need it, or regenerate the policy with a key made by <code>leash keygen</code>.</span>
          </div>
        )}
        <div className="row" style={{ marginTop: 18, justifyContent: "space-between" }}>
          <button className="btn ghost" type="button" onClick={onReset}>Create another policy</button>
          <Link className="btn secondary" href="/activity">View activity</Link>
        </div>
      </div>
    </main>
  );
}

function downloadFile(name: string, contents: string, type = "application/json") {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function safeParse(v: string, decimals: number): bigint | null {
  try {
    const t = v.trim();
    if (t === "") return null;
    const n = parseUnits(t, decimals);
    return n >= 0n ? n : null;
  } catch {
    return null;
  }
}
