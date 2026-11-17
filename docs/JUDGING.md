# Judging traceability (Aevum Builder Challenge #1)

Rubric source: starter kit §6 Competition Rules + challenge page §Judging criteria. **Weights are published there** — we optimize against them deliberately.

| # | Criterion | Weight | Where we address it | Evidence |
| --- | --- | --- | --- | --- |
| 4 | Innovation and originality | **20** | Bounded agent autonomy — a spend primitive, not a payment wrapper. Non-derivative vs the kit's Checkout (per-order once-payment) and vs Requisition (approve-every-payment): Leash is *policy enforcement for agents* with kill switch + allowlist + daily cap | `contracts/src/Leash.sol`, README table, innovation blurb |
| 1 | User experience & presentation | **15** | Desk: two-transaction wizard with plain-language errors (`lib/errors.ts`), live budget bar, one-click revoke with confirm, bundle download, responsive grid, dark QDay-palette theme | `web/src/app/*`, screenshots |
| 5 | Technical quality & platform integration | **15** | Shanghai-safe build (opcode check in CI), real tUSD8 (fork-tested), scoped session keys + budgets + expiry (the rubric's own words), EIP-712 typed data, replay protection, reentrancy guard, legacy txs, 1,000-block chunked logs, 47 unit + 2 fork tests | `contracts/`, `packages/leash`, `cli/`, tools/check-shanghai.mjs |
| 7 | Safety, trust & controls | **15** | Least-privilege session keys, EIP-712 expiry, budget caps, daily cap, vendor allowlist, instant `revoke()`, no-custody pull pattern, onchain `Spent` audit trail, purpose hashes, CLI fail-closed pre-checks | `docs/SECURITY.md`, contract + CLI |
| 6 | Real-world utility & market potential | **15** | Agentic AP/ops spend (API credits, cloud invoices) for teams piloting agents; path: internal policy SDK → team plans → Aevum mainnet when it launches (Feb 2027) + ERC-4337 session accounts | README §why, docs roadmap |
| 2 | Demo clear & well-structured | **10** | DEMO.md script; explorer tx links; fork E2E already proven; receipts page re-derives settlement from any tx hash | docs/DEMO.md, /receipts |
| 3 | Comprehensive documentation | **10** | README + ARCHITECTURE (flowchart, API table, trust boundaries), SECURITY (threat model), LIMITATIONS, VERIFICATION (hashes + fork E2E log), NOTICE, inline code comments | docs/* |
| 8 | *(not weighted in starter-kit rubric; bonus)* | — | `@leash/kit` is a reusable SDK other builders can adopt (types, ABI, bundle format); CLI is `leash` bin; fork-friendly repo | packages/, cli/, examples/ |
| — | **Submission requirements** (mandatory) | gate | public repo, Aevum evidence, live deployment, demo video, docs — see DEMO.md and pre-submit checklist (kit §5) | VERIFICATION.md |

## Known gaps, honestly

- **279 competing builders**; judging is comparative and unknowable here — no weights are inferable beyond the published rubric.
- **No third-party audit**; security rests on tests, minimal design, and OpenZeppelin primitives.
- **Live testnet evidence pending** at time of writing (see VERIFICATION.md) — the submission must not be sent before those hashes exist.
- **Innovation differentiation** depends on what the field submits; can't be verified until judging.
- Demo Day is a live video call; DEMO.md preflight must be run fresh on the judging day.
