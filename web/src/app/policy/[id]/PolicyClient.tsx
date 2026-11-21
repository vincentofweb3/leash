"use client";

import { useParams } from "next/navigation";
import { useReadContract } from "wagmi";
import { leashAbi } from "@leash/kit";
import { createPublicClient, formatUnits, http, type Address, type Hex } from "viem";
import { short } from "@/lib/format";

export function PolicyClient() {
  const { id } = useParams<{ id: string }>();
  const contract = "0xdec9195d6f321b9e078b0d70a8fe15dea2e99a7f";
  const client = createPublicClient({
    chain: { id: 44005, name: "QDay Aevum Testnet", nativeCurrency: { name: "Test QDAY", symbol: "tQDAY", decimals: 18 }, rpcUrls: { default: { http: ["https://rpc-test.qday.info"] } } },
    transport: http("https://rpc-test.qday.info"),
  });

  const policy = useReadContract({
    address: contract,
    abi: leashAbi,
    functionName: "policyOf",
    args: [BigInt(id ?? "0")],
    query: { enabled: Boolean(id) },
  });

  const remaining = useReadContract({
    address: contract,
    abi: leashAbi,
    functionName: "remainingBudget",
    args: [BigInt(id ?? "0")],
    query: { enabled: Boolean(policy.data?.budget) },
  });

  const p = policy.data;
  const remainingValue = remaining.data ?? (p?.budget ?? 0n) - (p?.spent ?? 0n);

  const status = !p
    ? "loading"
    : p.revoked
      ? "revoked"
      : BigInt(Math.floor(Date.now() / 1000)) >= BigInt(p.expiry)
        ? "expired"
        : "active";

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <h1>Policy #{id}</h1>
          <p className="lede">Live on QDay Aevum testnet</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="card metric">
          <div className="metric-label">Status</div>
          <div className="metric-value">{status}</div>
        </div>
        {p && (
          <div className="card metric">
            <div className="metric-label">Remaining</div>
            <div className="metric-value">{formatUnits(remainingValue, 6)} tUSD8</div>
          </div>
        )}
      </div>

      <p className="fine">
        Policy {id} on QDay Aevum testnet. Use the desk at /new to create or adjust policies.
      </p>
    </main>
  );
}