"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits, getAbiItem, type Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { getLogsChunked } from "@aevum-kit/aevum";
import { leashAbi } from "@leash/kit";
import { useNetwork } from "@/lib/network";
import { useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { short } from "@/lib/format";

function useLiveStats() {
  const { net } = useNetwork();
  const config = useConfig();
  const [stats, setStats] = useState<{ policies: bigint; moved: bigint } | null>(null);
  const leash = net.leash;
  const fromBlock = net.deployBlock;

  useEffect(() => {
    if (!leash) return;
    let cancelled = false;
    (async () => {
      try {
        const policies = await readContract(config, {
          address: leash,
          abi: leashAbi,
          functionName: "nextPolicyId",
          chainId: net.chain.id,
        });
        let moved = 0n;
        if (fromBlock !== undefined) {
          const { createPublicClient, http } = await import("viem");
          const client = createPublicClient({ chain: net.chain, transport: http(net.chain.rpcUrls.default.http[0]) });
          const head = await client.getBlockNumber();
          const logs = await getLogsChunked(client, {
            address: leash,
            event: getAbiItem({ abi: leashAbi, name: "Spent" }),
            fromBlock,
            toBlock: head,
          });
          moved = logs.reduce((acc, l) => acc + ((l.args as { amount?: bigint }).amount ?? 0n), 0n);
        }
        if (!cancelled) setStats({ policies, moved });
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leash, fromBlock, net.chain, config]);

  return stats;
}

export default function Home() {
  const { net } = useNetwork();
  const { isConnected, chainId } = useAccount();
  const stats = useLiveStats();
  const onChain = isConnected && chainId === net.chain.id;

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Agentic payments on QDay Aevum</p>
          <h1>Your agent pays.<br />Only what you allow.</h1>
          <p className="lede">
            Leash is the spend-allowance layer for AI agents. Set a per-transaction cap, a total budget,
            an optional daily cap and a vendor allowlist — then hand your agent a session key. It pays in
            tUSD8 on Aevum, inside the limits you set, or not at all. Revoke the key anytime; unspent money never moves.
          </p>
        </div>
        <div className="stack" style={{ gap: 12, minWidth: 280 }}>
          <Link href="/new" className="btn big">Create an allowance</Link>
          <Link href="/docs" className="btn secondary">How it works</Link>
          {net.leash && (
            <p className="fine">
              Leash on {net.label}:{" "}
              <a className="mono" href={`https://explorer-test.qday.info/address/${net.leash}`} target="_blank" rel="noreferrer">{short(net.leash, 8, 6)}</a>
            </p>
          )}
        </div>
      </div>

      {stats && (
        <div className="grid-2">
          <div className="card">
            <p className="eyebrow">Live on {net.label}</p>
            <h2><span className="num">{stats.policies.toString()}</span> policies created</h2>
            <p className="sub">Counted from the contract, not a database.</p>
          </div>
          <div className="card">
            <p className="eyebrow">Settled through Leash</p>
            <h2><span className="num">{formatUnits(stats.moved, 6)}</span> tUSD8</h2>
            <p className="sub">Every spend is a public <span className="mono">Spent</span> event — audit it on the explorer anytime.</p>
          </div>
        </div>
      )}

      <div className="stack">
        <p className="eyebrow">How it works</p>
        <div className="grid-2">
          <div className="card">
            <h2>1 · You set the limits</h2>
            <p className="sub">
              One transaction approves Leash for exactly your budget. A second creates the policy:
              per-tx cap, budget, daily cap, vendor allowlist, expiry. The agent&apos;s session address goes in — your key never leaves your wallet.
            </p>
          </div>
          <div className="card">
            <h2>2 · Your agent pays inside them</h2>
            <p className="sub">
              The agent signs an EIP-712 <span className="mono">SpendAuth</span> (vendor, amount, purpose hash, nonce, expiry) and submits
              <span className="mono"> spend()</span>. Leash verifies the signature and every cap onchain, then pulls tUSD8 straight from you to the vendor — atomic, auditable, no custody.
            </p>
          </div>
          <div className="card">
            <h2>3 · You stay in charge</h2>
            <p className="sub">
              Kill the session key with one transaction — the next spend reverts. Lower the caps, shrink the
              allowlist, or extend the expiry anytime. Buyer&apos;s allowance can also be zeroed: unspent money is never at risk.
            </p>
          </div>
          <div className="card">
            <h2>Why not just approve everything?</h2>
            <p className="sub">
              Per-transaction approval scales badly for agents; a raw key scales catastrophically.
              Leash is the missing middle: machine speed, human limits, and a public audit trail your finance team can read without a dashboard login.
            </p>
          </div>
        </div>
      </div>

      <div className="card flush">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Capability</th><th>Raw agent key</th><th>Approve every payment</th><th>Leash</th></tr></thead>
            <tbody>
              <tr><td>Agent acts without a human</td><td>yes</td><td>no</td><td><strong>yes, inside the policy</strong></td></tr>
              <tr><td>Blast radius if the key leaks</td><td>the whole wallet</td><td>none</td><td><strong>per-tx cap × remaining budget</strong></td></tr>
              <tr><td>Vendor restrictions</td><td>none</td><td>per payment</td><td><strong>onchain allowlist</strong></td></tr>
              <tr><td>Revoke in one transaction</td><td>rotate everything</td><td>n/a</td><td><strong>yes — <span className="mono">revoke()</span></strong></td></tr>
              <tr><td>Audit trail</td><td>wallet history</td><td>wallet history</td><td><strong>typed <span className="mono">Spent</span> events + purpose hashes</strong></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="fine">
        Built on QDay Aevum testnet (chain 44005) · tUSD8 (6 decimals, EIP-2612/EIP-3009) · Shanghai EVM ·{" "}
        {onChain ? `you are on ${net.label}` : `connect a wallet on ${net.label} to create a policy`}.
      </p>
    </main>
  );
}
