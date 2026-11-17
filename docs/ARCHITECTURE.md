# Architecture

```text
leash keygen ──▶ agent session keypair (local file, chmod 600 — never printed)
                       │ session address
                       ▼
buyer ── approve(Leash, budget) ─────────────────┐   (Aevum, tUSD8)
        ─ createPolicy(agent, caps, expiry) ─────▼
                                     Leash.sol  (chain 44005)
                                        ▲
agent ── leash pay ── SpendAuth(EIP-712)┘
                                        │ verify sig + caps
                                        ▼
                     transferFrom(buyer → vendor)
                                        │
                                        ▼
                        Spent event ──▶ desk / activity / receipts / explorer
buyer ── revoke() / setLimits() / extend() ──▶ kill switch, cap edits (buyer only)
```

## Contract (`contracts/src/Leash.sol`)

Single non-upgradeable contract. Owns no funds — it executes `transferFrom` against the buyer's
ERC-20 allowance at spend time.

State:

- `policies[id]` — buyer, agent (session key address), perTxCap, budget, spent, expiry,
  dailyCap, daySpent/dayBucket (UTC rolling day), revoked, labelHash.
- `usedNonce[policyId][nonce]` — replay protection, scoped per policy.
- `_allowlists[id]` — up to 16 vendors; empty = any.

Write paths:

| Fn | Caller | Effect |
| --- | --- | --- |
| `createPolicy(agent, perTxCap, budget, dailyCap, expiry, labelHash, allowlist)` | buyer | new policy, `nextPolicyId++`, emits `PolicyCreated` |
| `spend(auth, v, r, s)` | anyone | verify + enforce + transfer, emits `Spent` |
| `revoke(id)` | buyer | `revoked = true`, emits `PolicyRevoked` |
| `setLimits(id, perTxCap, budget, dailyCap)` | buyer | caps may not leave budget below spent |
| `extend(id, expiry)` | buyer | expiry may only increase |
| `setAllowlist(id, vendors)` | buyer | replace list (≤16), empty clears |

Views: `policyOf`, `remainingBudget`, `todaySpent`, `allowlistOf`, `hashSpendAuth`, `nextPolicyId`, `token`.

Spend verification order (checks-effects-interactions, `nonReentrant`):
revoked → policy expiry → SpendAuth expiry → amount>0 → agent match → nonce → per-tx cap →
budget → day bucket/daily cap → allowlist → ECDSA recover vs `policy.agent` → allowance ≥ amount →
mark nonce + accounting → `SafeERC20.safeTransferFrom`.

## SDK (`packages/leash`, `@leash/kit`)

- `LEASH_ADDRESS` — the deployed Leash on Aevum testnet (single source of truth for app/CLI/examples).
- `leashAbi`, `TUSD8_ADDRESS` (re-exported from `@aevum-kit/aevum`).
- EIP-712: `SPEND_AUTH_TYPES`, `spendAuthDomain(chainId, verifyingContract)`, `spendAuthTypedData(...)`,
  `purposeHashOf(text) = keccak256(utf8(text))`, `randomNonce()`.
- `PolicyBundle` + `parseBundle` — the JSON the buyer hands the agent (no secrets).
- `SPEND_FAILURE_HINTS` — machine-readable revert → human reason mapping shared by CLI and desk.

## Agent CLI (`cli/`, `@leash/cli`)

| Command | Behavior |
| --- | --- |
| `leash keygen` | viem `generatePrivateKey` → file chmod 600; prints address only |
| `leash show <bundle.json>` | decodes and prints the bundle |
| `leash pay` | reads policy onchain → refuses to sign on revert paths (revoked/expired/caps) → `signTypedData` → simulate → `type: "legacy"` submit → waits → prints explorer links |
| `leash activity` | `getLogsChunked` over `Spent` for one policy |

The session key is read from a file or `LEASH_AGENT_KEY` — never a CLI flag, never printed.

## Web desk (`web/`, Next.js)

Pages: `/` overview + live stats (policy count, tUSD8 moved via chunked event reads), `/new` wizard
(approve → createPolicy → bundle download, or browser-dev keygen), `/policy/[id]` (budget progress,
spend table, revoke/limits/extend, bundle re-download), `/activity` (all Spent events),
`/receipts/[tx]` (re-derives the Spent events from any transaction receipt), `/docs`.

Writes use the connected wallet via wagmi; reads use chunked `eth_getLogs` (Aevum's 1,000-block limit).
No backend. The relayer from the starter kit was removed — Leash has no server-side actor.

## Trust boundaries

- The CLI and the web UI are conveniences; **the contract is the only enforcement point**.
- The buyer's wallet is the only source of tUSD8; the agent never custodies funds.
- Explorer verification on Aevum is unavailable — evidence = public repo + exact commit + deploy block + tx hashes.
