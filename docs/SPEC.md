# Leash — Product specification (Stage 5, frozen 2026-11-17)

> For **teams running AI agents that need to spend money**, who **cannot safely hand an
> agent a funded wallet or an open credit line**, this is **Leash** that **enforces
> scoped, onchain-spend allowances — per-tx cap, total budget, vendor allowlist, expiry,
> instant revocation — paid in tUSD8 on QDay Aevum testnet**.
> Unlike **custodial agent wallets or single-payment approval desks (Requisition)**, it
> **lets the agent pay autonomously inside a pre-approved policy and hard-stops it outside**.

## Problem statement

- Problem: Giving an AI agent a raw funded wallet means unbounded, unauditable spend; asking a
  human to approve every purchase destroys the autonomy the agent exists for. There is no budget
  primitive between "no money" and "all the money".
- Who has it: Ops and fintech teams piloting agentic purchasing (cloud invoices, data-API credits,
  vendor payments), hackathon-grade agent builders, crypto-native merchants piloting machine-driven commerce.
- What they do today: manual approval per payment (Requisition), or unrestricted keys (dangerous),
  or offchain "guardrails" the agent can ignore.
- Cost of the status quo: runaway spend, no audit trail, no clean revocation, blocked autonomy.
- Why this challenge cares: agentic payments, scoped session keys, budgets and expiry are named
  in the judging rubric (criterion 5) and safety/controls (criterion 7); the challenge explicitly
  invites agentic payment primitives (criterion 4).

## Personas

| Persona | Role | Need | Success looks like |
| --- | --- | --- | --- |
| Primary: Buyer/Ops lead | Sets policy, funds it with a tUSD8 allowance | One wallet tx to bound agent spend; instant kill switch | Creates a policy in <2 min; revokes in one click and the agent's next spend reverts |
| Secondary: Agent operator | Runs the agent, holds the session key | A tiny CLI that pays within policy without human hops | `leash pay` settles onchain; over-cap fails closed with a readable error |
| Tertiary: Merchant | Receives tUSD8 | Predictable payout + public receipt | Receipt page with explorer-verifiable tx and purpose hash |

## Value proposition

- Core value: bounded agent autonomy with an onchain, auditable enforcement layer.
- Measurable outcome: buyer approves exactly `budget` tUSD8; contract never moves more than
  `budget` + never outside allowlist/expiry; spend history is publicly verifiable events.
- Rubric served: Innovation 20, Safety 15, Technical 15, Utility 15, UX 15, Demo 10, Docs 10.

## Core user journeys

### Journey 1 (primary): create and run a bounded allowance
1. Buyer connects wallet, fills the New Policy form: agent session address (from `leash keygen`),
   per-tx cap, total budget, optional daily cap, vendor allowlist (optional), purpose label, expiry.
2. Buyer signs `approve(Leash, budget)` (or uses permit-style flow later) and `createPolicy(...)`.
   UI shows the policy id, explorer link, and a ready-made bundle JSON for the agent.
3. Operator drops the bundle + session key into the agent environment; `leash pay --policy 3 --vendor 0x… --amount 25 --purpose "invoice #1042"` signs an EIP-712 SpendAuth and submits `spend(...)`.
4. Contract validates (active policy, not expired, session-key signature, per-tx cap, allowlist,
   cumulative budget), executes `transferFrom(buyer → vendor)`, emits `Spent`.
5. Receipt page renders the onchain event + purposeHash; activity feed lists all spends.

### Journey 2 (revoke / kill switch)
1. Buyer opens policy detail, clicks **Revoke**, signs one tx.
2. Any subsequent `spend` from that session key reverts with `PolicyRevoked`; buyer's tUSD8 stays
   put (allowance can also be zeroed by the buyer at any time).

### Journey 3 (policy detail + edit caps)
Buyer raises/lowers per-tx cap and budget onchain (`setLimits`), or extends expiry (`extend`).
All mutations emit events; receipts and activity update from the same log stream.

## MVP scope

**In scope:**
- `Leash.sol`: policy registry, scoped session keys (EIP-712), per-tx cap, total budget, optional
  daily rolling cap, optional vendor allowlist, expiry, revoke, EIP-712 domain bound to chain+contract.
- tUSD8 integration via EIP-2612 permit (one signature to fund + create) with approve fallback.
- Foundry test suite (unit + fork against real tUSD8), Shanghai-safe.
- `@leash/sdk` package: chain config, ABIs, EIP-712 types, `signSpendAuth`, `buildBundle`.
- `leash` CLI: `keygen`, `show` (inspect bundle), `pay` (sign + submit), `activity` (list spends).
- Next.js desk app (from starter kit): `/` pitch, `/new` create policy wizard, `/policy/[id]` detail
  (spend progress, revoke, edit caps), `/receipts/[id]`, `/activity`, `/docs`.
- Docs set: README + ARCHITECTURE, SECURITY, VERIFICATION, LIMITATIONS, DEMO, JUDGING (traceability),
  NOTICE (attribution). Public repo, live deploy (Vercel), Aevum testnet contract.

**Explicitly out of scope (v1):**
- ERC-4337 smart-account/Kernel deployment (Aevum has Kernel v3.1 + bundlers on paper; integration
  risk > demo value in 24 days). Documented as roadmap with exact QDay PR references.
- Human-escalation queue / partial approvals (over-cap requests simply revert; CLI exits with a
  message pointing to the desk).
- Fiat on-ramp, merchant checkout SDK, subscriptions, streaming, DAO treasury UI.
- Multi-token support (tUSD8 only); multi-sig buyer; mainnet deployment; audits.
- Cross-chain; off-Aevum settlement of any kind (judging counts Aevum only).

**Deferred unless time allows (P2):**
- Daily rolling cap UI polish; CSV export; purpose-whitelist categories; EIP-3009 gasless merchant payouts.

## System architecture

- Contract layer (`contracts/`): `Leash.sol` — the only enforcement point. OpenZeppelin EIP712 +
  SignatureChecker not needed (session key must be EOA-signing; keep ECDSA + ecrecover, mirror
  Requisition's EIP-712 domain style). SafeERC20. ReentrancyGuard. No custody beyond buyer allowance.
- SDK (`packages/leash/`): chain config (44005), tUSD8 ABI, Leash ABI, EIP-712 typed data builders,
  `getLogsChunked` reuse from `@aevum-kit/aevum`.
- CLI (`cli/`): Node 22 + tsx, viem only (no ethers), env/file key, never prints keys.
- Web (`web/`): Next.js (from kit), wagmi + RainbowKit, rebranded to Leash; server relayer not needed
  (all writes via connected wallet or agent CLI).
- Data: none offchain — events are the database; getLogs chunked at 1,000 blocks.
- Deployment: contracts → Aevum testnet (keystore deploy); web → Vercel; repo → GitHub (public).

```
leash keygen ──▶ agent session keypair (local file, chmod 600)
                       │ address
buyer ── approve(budget) + createPolicy() ──▶ Leash.sol (Aevum 44005)
                       │                           ▲ spend() EIP-712
agent ── leash pay ────────────────────────────────┘
                       │ tUSD8 transferFrom(buyer → vendor)
                       ▼
              Spent event ──▶ receipt page / activity / audit trail
buyer ── revokePolicy / setLimits ──▶ kill switch, cap edits (owner only)
```

## Data flow

| Step | Trigger | Call/action | Failure mode | Fallback |
| --- | --- | --- | --- | --- |
| 1 | Buyer opens /new | wagmi connect | wrong network | switchTo aevum button + one-click add |
| 2 | Buyer submits | `approve` + `createPolicy` | user rejects / insufficient tQDAY | inline error, plain language |
| 3 | CLI `pay` | read policy state → simulate `spend` → submit | cap exceeded / revoked / bad allowlist / expired | CLI prints exact onchain reason |
| 4 | Contract | verify sig + caps → `transferFrom` | allowance < amount | revert with `InsufficientAllowance(spent, allowed)` |
| 5 | UI | poll Spent events (1k-block chunks) | >1000-block ranges | chunked reader from kit |

## Security considerations

- Session key is an EOA the buyer never funds with tQDAY if using a relayer; default = agent pays gas
  (tiny on Aevum). Buyer may zero-allowance Leash at any time to halt everything.
- Replay: per-policy `usedNonce[nonce]` set; EIP-712 domain binds chainId + verifying contract.
- Prompt injection: worst case is capped spend; CLI surfaces policy limits before every payment.
- Contract: no loops over user data except bounded spend list (skip — no arrays unbounded; policy
  stores scalars + fixed allowlist array ≤ 16). Reentrancy: checks-effects-interactions + guard.
- No secrets in repo; test keystore only; `.env*` gitignored; fork keys never on Aevum.
- Dependency risk: OpenZeppelin + kit MIT code with attribution; lockfile committed.

## Integration requirements

| Integration | Why | Credential | Available | Fallback |
| --- | --- | --- | --- | --- |
| Aevum RPC + explorer | chain truth | none (public) | yes | — |
| tUSD8 (0x4565…3483) | settlement | none | yes | MockUSD8 on local anvil |
| Faucet (Discord `/faucet`, web) | test tQDAY/tUSD8 | Discord account | yes (user-run) | fork deal |
| Vercel | hosting | existing login | yes | any static host / Docker |
| DoraHacks submission | required | user account | **user has not registered yet** | n/a |

## Acceptance criteria (milestone-gated)

- [ ] M2: `forge test` ≥ 40 tests green local; fork tests green vs real tUSD8; `make build` Shanghai-safe.
- [ ] M3: `pnpm -r typecheck` clean; CLI `keygen`/`pay` round-trip on fork produces a `Spent` event.
- [ ] M4: Buyer journey demoable on fork; web builds; policy create → pay → revoke works end to end.
- [ ] M5: Live testnet deploy + explorer links recorded in docs/VERIFICATION.md with tx hashes.
- [ ] M6: README reproduces from clean clone; demo video recorded; submission checklist complete.

## Milestones (timeboxed, deadline 2026-12-11 08:00 UTC)

| # | Milestone | Timebox | Deliverable | Status |
| --- | --- | --- | --- | --- |
| M1 | Kit adoption + repo setup | 0.5 day | working build/test baseline, rebrand skeleton | In progress |
| M2 | `Leash.sol` + tests | 3 days | contract + ≥40 tests | Pending |
| M3 | SDK + CLI | 2 days | keygen/pay/activity | Pending |
| M4 | Desk app | 4 days | create/detail/revoke/receipts/activity | Pending |
| M5 | Testnet deploy + verify docs | 1 day | live contract + tx hashes | Pending |
| M6 | Docs, demo video, submission | 2 days | submission package | Pending |
| Buffer | slip risk | ~20% | — | — |

## Decision log

| Decision | Options | Choice | Why |
| --- | --- | --- | --- |
| Product concept | A/B/C/D (this doc's parent message) | A — bounded agent allowances | Only option scoring Innovation 20 + Safety 15 + Technical 15 simultaneously; non-derivative vs Requisition (autonomy, not approval) |
| Enforcement point | contract pulls vs custody vault | approve + transferFrom via policy contract | zero upfront custody; buyer keeps unspent funds; instant allowance revoke |
| Session keys | EIP-712 session key vs full ERC-4337 Kernel v3.1 | EIP-712 session key in v1; Kernel documented as roadmap | bundler endpoints undocumented; 24-day risk; rubric satisfied by "scoped sessions, budgets, expiry" language |
| Fork starter kit | fresh repo vs fork kit | fork MIT kit | organizers allow; keeps Shanghai checks, chunked logs, pnpm workspace, Next+wagmi plumbing |
| Product name | Allowance Desk / Leash / CapDesk | **Leash** | memorable, states the value (control) in one word |
| Daily cap | include rolling daily cap | included, optional | cheap to implement, strong safety narrative |

## Time budget

| Phase | Hours |
| --- | --- |
| Discovery + criteria | 4 |
| Spec | 2 |
| Build (M1–M4) | 60 |
| Deploy + test (M5) | 6 |
| Demo + submission (M6) | 8 |
| Buffer | 16 |
