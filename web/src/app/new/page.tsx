"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatUnits, isAddress, keccak256, parseUnits, stringToBytes, type Address, type Hash } from "viem";
import { useAccount, useConfig } from "wagmi";
import { readContract, simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { erc20Abi } from "@aevum-kit/aevum";
import { leashAbi, BUNDLE_VERSION } from "@leash/kit";
import { useToken } from "@/components/useToken";
import { useNetwork } from "@/lib/network";
import { explain } from "@/lib/errors";
import { saveBundle } from "@/lib/bundle-store";

type Phase = "idle" | "approving" | "creating" | "done" | "error";

export default function NewPolicyPage() {
  const { net } = useNetwork();
  const config = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === net.chain.id;
  const leash = net.leash;
  const token = useToken();

  const [agentAddress, setAgentAddress] = useState("");
  const [perTxCap, setPerTxCap] = useState("10");
  const [budget, setBudget] = useState("100");
  const [dailyCap, setDailyCap] = useState(""); // empty = no daily cap
  const [expiryDays, setExpiryDays] = useState("30");
  const [label, setLabel] = useState("");
  const [allowlistText, setAllowlistText] = useState("");

  const [devKey, setDevKey] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ policyId: string; tx: Hash; bundleJson: string } | null>(null);

  const parsed = useMemo(() => {
    const allowlist = allowlistText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return {
      agent: agentAddress.trim(),
      allowlist,
      perTxCap: safeParse(perTxCap),
      budget: safeParse(budget),
      dailyCap: dailyCap.trim() === "" ? 0n : safeParse(dailyCap),
      expiryDays: Number(expiryDays),
    };
  }, [agentAddress, allowlistText, perTxCap, budget, dailyCap, expiryDays]);

  const problems: string[] = [];
  if (!isAddress(parsed.agent)) problems.push("agent session address must be a 0x address (use `leash keygen`, or generate one below)");
  parsed.allowlist.forEach((a) => {
    if (!isAddress(a)) problems.push(`allowlist entry is not an address: ${a}`);
  });
  if (parsed.allowlist.length > 16) problems.push("allowlist is limited to 16 vendors");
  if (parsed.perTxCap === null || parsed.perTxCap === 0n) problems.push("per-transaction cap must be more than zero");
  if (parsed.budget === null || parsed.budget === 0n) problems.push("budget must be more than zero");
  if (parsed.perTxCap !== null && parsed.budget !== null && parsed.perTxCap > parsed.budget) {
    problems.push("per-transaction cap cannot exceed the budget");
  }
  if (parsed.dailyCap === null) problems.push("daily cap must be a number, or empty for none");
  if (!Number.isFinite(parsed.expiryDays) || parsed.expiryDays <= 0) problems.push("expiry must be at least 1 day");

  const busy = phase === "approving" || phase === "creating";
  const ready = onChain && leash && problems.length === 0 && !busy;

  function generateDevKey() {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    setAgentAddress(account.address);
    setDevKey(key);
  }

  async function approveAndCreate() {
    if (!ready || !address || !leash || !token.address || parsed.budget === null) return;
    setPhase("approving");
    setError(null);
    try {
      const budgetUnits = parsed.budget;
      // 1. Approve exactly the budget (never an infinite approval).
      const allowance = await readContract(config, {
        address: token.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, leash],
        chainId: net.chain.id,
      });
      if (allowance < budgetUnits) {
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

      // 2. Create the policy. simulate first to get the policyId.
      setPhase("creating");
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Math.floor(parsed.expiryDays * 86400));
      const labelHash = label.trim() ? keccak256(stringToBytes(label.trim())) : ("0x" + "00".repeat(32) as `0x${string}`);
      const allowlist = parsed.allowlist as Address[];
      const simulation = await simulateContract(config, {
        address: leash,
        abi: leashAbi,
        functionName: "createPolicy",
        args: [parsed.agent as Address, parsed.perTxCap!, budgetUnits, parsed.dailyCap ?? 0n, expiry, labelHash, allowlist],
        chainId: net.chain.id,
        account: address,
      });
      const hash = await writeContract(config, {
        address: leash,
        abi: leashAbi,
        functionName: "createPolicy",
        args: [parsed.agent as Address, parsed.perTxCap!, budgetUnits, parsed.dailyCap ?? 0n, expiry, labelHash, allowlist],
        chainId: net.chain.id,
        type: "legacy",
      });
      await waitForTransactionReceipt(config, { hash, chainId: net.chain.id });

      const policyId = simulation.result.toString();
      const bundle = {
        version: BUNDLE_VERSION as 1,
        chainId: net.chain.id,
        leash,
        policyId,
        buyer: address,
        agent: parsed.agent as Address,
        label: label.trim(),
        perTxCap: parsed.perTxCap!.toString(),
        budget: budgetUnits.toString(),
        dailyCap: (parsed.dailyCap ?? 0n).toString(),
        expiry: expiry.toString(),
        createdAt: new Date().toISOString(),
      };
      saveBundle(net.chain.id, bundle);
      setResult({ policyId, tx: hash, bundleJson: JSON.stringify(bundle, null, 2) });
      setPhase("done");
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
            <h1>This deployment of Leash isn&apos;t configured yet.</h1>
            <p className="lede">
              Set <span className="mono">NEXT_PUBLIC_LEASH_AEVUM</span> (or <span className="mono">NEXT_PUBLIC_LEASH_FORK</span> for a local fork)
              to a Leash contract address, plus <span className="mono">NEXT_PUBLIC_DEPLOY_BLOCK_AEVUM</span>, then redeploy the web app.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">New allowance</p>
          <h1>Bound your agent&apos;s spend.</h1>
          <p className="lede">
            Two transactions: approve Leash for exactly your budget, then create the policy.
            The agent gets a session key it can use — within every limit you set — and nothing else.
          </p>
        </div>
      </div>

      {phase === "done" && result ? (
        <div className="card">
          <div className="notice good" style={{ marginBottom: 16 }}>
            <strong>Policy #{result.policyId} created.</strong>
            <span>
              <a className="mono" href={`https://explorer-test.qday.info/tx/${result.tx}`} target="_blank" rel="noreferrer">{result.tx.slice(0, 14)}…</a>
            </span>
          </div>
          <h2>Hand this bundle to your agent</h2>
          <p className="sub">No secrets inside — the session key file is separate (<span className="mono">leash keygen</span>). The agent uses it to sign spends.</p>
          <pre className="code">{result.bundleJson}</pre>
          <div className="row" style={{ gap: 12, marginTop: 16 }}>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                const blob = new Blob([result.bundleJson], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `leash-policy-${result.policyId}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download bundle.json
            </button>
            <Link className="btn" href={`/policy/${result.policyId}`}>Open policy desk</Link>
          </div>
        </div>
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)" }}>
          <div className="card">
            <h2>Policy limits</h2>
            <p className="sub">All amounts are tUSD8 (6 decimals). Empty daily cap = no daily limit. Empty allowlist = any vendor may be paid.</p>

            <label className="field">
              <span>Agent session address</span>
              <input className="input mono" placeholder="0x…" value={agentAddress} onChange={(e) => setAgentAddress(e.target.value)} spellCheck={false} autoComplete="off" />
            </label>
            <div className="row" style={{ gap: 10, marginBottom: 14 }}>
              <button className="btn ghost small" type="button" onClick={generateDevKey}>Generate one in this browser (dev mode)</button>
              {parsed.agent && isAddress(parsed.agent) && <span className="fine">key holder: your agent, not this page</span>}
            </div>
            {devKey && (
              <div className="notice warn" style={{ marginBottom: 14 }}>
                <strong>Dev-mode session key — shown once.</strong>
                <code style={{ wordBreak: "break-all", fontSize: 12 }}>{devKey}</code>
                <button
                  className="btn ghost small"
                  type="button"
                  onClick={() => {
                    const blob = new Blob([`${devKey}\n`], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "agent.key";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download agent.key
                </button>
                <span className="fine">Feeds straight into <code>leash pay --key agent.key</code>. Treat it like a password.</span>
              </div>
            )}

            <div className="grid-2" style={{ gap: 14 }}>
              <label className="field">
                <span>Per-transaction cap</span>
                <input className="input num" inputMode="decimal" value={perTxCap} onChange={(e) => setPerTxCap(e.target.value)} />
              </label>
              <label className="field">
                <span>Total budget</span>
                <input className="input num" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </label>
              <label className="field">
                <span>Daily cap (optional)</span>
                <input className="input num" inputMode="decimal" placeholder="e.g. 25" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} />
              </label>
              <label className="field">
                <span>Expiry (days)</span>
                <input className="input num" inputMode="numeric" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
              </label>
            </div>

            <label className="field">
              <span>Label (optional, goes onchain as a hash)</span>
              <input className="input" placeholder="e.g. cloud-invoice payment bot" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={64} />
            </label>
            <label className="field">
              <span>Vendor allowlist — one address per line (optional)</span>
              <textarea className="input mono" rows={3} placeholder="0xVendor1&#10;0xVendor2" value={allowlistText} onChange={(e) => setAllowlistText(e.target.value)} spellCheck={false} />
            </label>

            {problems.length > 0 && (
              <ul className="fine" style={{ color: "var(--warn)", marginTop: 4 }}>
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
            {error && <div className="notice bad" style={{ marginTop: 12 }}>{error}</div>}

            {!onChain && (
              <div className="notice warn" style={{ marginTop: 12 }}>
                Connect a wallet on {net.label} to create the policy.
              </div>
            )}

            <button className="btn big block" style={{ marginTop: 14 }} type="button" disabled={!ready} onClick={approveAndCreate}>
              {phase === "approving" ? "Approving budget…" : phase === "creating" ? "Creating policy…" : "Approve budget & create policy"}
            </button>
            <p className="fine" style={{ marginTop: 10 }}>
              You sign two transactions with your own wallet: <span className="mono">approve(Leash, budget)</span> then
              <span className="mono"> createPolicy(…)</span>. Unspent tUSD8 never leaves your wallet, and you can zero the allowance at any time.
            </p>
          </div>

          <div className="card info">
            <h2>What this policy does</h2>
            <ul>
              <li>Agent may pay any vendor up to <strong>{parsed.perTxCap !== null ? formatUnits(parsed.perTxCap, 6) : "—"} tUSD8</strong> per transaction, until the <strong>{parsed.budget !== null ? formatUnits(parsed.budget, 6) : "—"} tUSD8</strong> budget is spent.</li>
              <li>{parsed.dailyCap ? <>At most <strong>{formatUnits(parsed.dailyCap, 6)} tUSD8</strong> per UTC day.</> : <>No daily cap.</>}</li>
              <li>{parsed.allowlist.length ? <>Payments only to {parsed.allowlist.length} listed vendor{parsed.allowlist.length > 1 ? "s" : ""}.</> : <>Any vendor address may be paid.</>}</li>
              <li>Expires in <strong>{Number.isFinite(parsed.expiryDays) ? parsed.expiryDays : "—"} days</strong> unless extended.</li>
              <li><span className="mono">revoke()</span> kills the session key in one transaction.</li>
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}

function safeParse(v: string): bigint | null {
  try {
    const t = v.trim();
    if (t === "") return null;
    const n = parseUnits(t, 6);
    return n >= 0n ? n : null;
  } catch {
    return null;
  }
}
