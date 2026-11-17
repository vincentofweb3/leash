import type { Address, Hex } from "viem";

/**
 * Policy bundle: the JSON a buyer hands to the agent operator.
 * Contains no secrets — the session key lives in a separate key file the agent holds.
 * `keyFile` is a hint for humans; the CLI never reads paths from the bundle without the user passing it.
 */
export const BUNDLE_VERSION = 1;

export interface PolicyBundle {
  version: typeof BUNDLE_VERSION;
  chainId: number;
  leash: Address;
  policyId: string; // bigint as decimal string
  buyer: Address;
  agent: Address;
  label: string;
  perTxCap: string; // base units, 6 decimals
  budget: string;
  dailyCap: string; // 0 = disabled
  expiry: string; // unix seconds
  createdAt: string; // ISO 8601
}

export function parseBundle(json: unknown): PolicyBundle {
  const b = json as Partial<PolicyBundle>;
  if (b?.version !== BUNDLE_VERSION) throw new Error(`Unsupported bundle version: ${String(b?.version)}`);
  for (const k of ["leash", "buyer", "agent", "policyId", "perTxCap", "budget", "dailyCap", "expiry", "chainId"] as const) {
    if (b[k] === undefined || b[k] === null) throw new Error(`Bundle is missing "${k}"`);
  }
  return b as PolicyBundle;
}

/** What the agent CLI prints for a failed check — mirrors the contract's custom errors. */
export const SPEND_FAILURE_HINTS: Record<string, string> = {
  Revoked: "policy was revoked by the buyer — the session key is dead",
  PolicyExpired: "policy expired — ask the buyer to extend it",
  SpendExpired: "the signed authorization expired before submission",
  ExceedsPerTxCap: "amount exceeds the per-transaction cap",
  ExceedsBudget: "amount exceeds the remaining budget",
  ExceedsDailyCap: "amount would exceed the daily rolling cap",
  VendorNotAllowed: "vendor is not on the policy allowlist",
  NonceUsed: "this authorization nonce was already used",
  BadSignature: "signature does not recover to the agent session key",
  AllowanceTooSmall: "buyer's tUSD8 allowance to Leash is below the spend amount",
  SpendAuthAgentMismatch: "authorization names a different agent than the policy",
};
