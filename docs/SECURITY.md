# Security model

## Roles

- **Buyer** — funds nothing upfront; approves Leash for exactly `budget`; creates, edits and revokes policies.
- **Agent** — holds a session-key EOA; can only `spend` within the policy. Cannot approve, transfer, or create policies.
- **Leash** — verifier and router; holds no funds, exposes no admin surface.
- **Merchant/vendor** — receives tUSD8 directly; never interacts with the contract.

## Invariants

- Nothing moves without the agent's EIP-712 signature **and** the policy's active state.
- Cumulative spend never exceeds `budget`; per transaction never exceeds `perTxCap`; per UTC day never
  exceeds `dailyCap` (if set).
- A nonce settles once per policy.
- After `revoke`, **no** agent signature can move buyer funds via that policy.
- Contract token balance is never positive: every transfer is buyer → vendor.

## Threats

| Threat | Mitigation |
| --- | --- |
| Stolen session key | Attacker bounded by per-tx cap × remaining budget × allowlist × expiry; `revoke()` stops everything instantly |
| Prompt injection ("pay yourself") | Same bound; allowlist can exclude the agent; CLI prints policy terms before paying |
| Replay | per-policy `usedNonce`; domain binds chainId + verifying contract |
| Overspend across many txs | cumulative `spent` checked against `budget` on every call |
| Reentrancy | checks-effects-interactions + `ReentrancyGuard`; token is trusted-but-verified (USDC-style) |
| Allowance drain beyond budget | buyer can set allowance to exactly `budget`; spend enforces budget regardless of allowance size |
| Compromised host/RPC | CLI simulates before submitting and re-checks policy state; desk reads state fresh each render |
| Fiat-token freeze (blocklist) | a blocked vendor breaks `transferFrom` for that call; whole spend reverts, no partial payment |
| Front-running a `spend` | harmless — it only executes what the buyer's signature already authorized, to the authorized vendor |

## Key handling

- Agent session key: viem `generatePrivateKey`, file chmod 600 (`leash keygen`), never printed.
- Buyer key: stays in the browser wallet. Never touches the app, repo or CLI.
- Test deployer key (Aevum testnet only) lives outside this repository.

## Explicit non-goals

- Not audited. Not for mainnet value.
- No MEV protection, no oracle, no fiat rails, no KYC.
- `purposeHash` is public; don't put secrets (or customer PII) in the purpose string.
