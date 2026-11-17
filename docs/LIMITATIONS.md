# Limitations

- **Not audited.** Do not point this at real funds. A professional audit precedes any mainnet deployment.
- **The contract is the enforcement point.** A buyer who approves more than their budget risks the difference.
- **No delivery proof.** Leash proves authorization and settlement, not that the vendor delivered.
- **Expiry ≠ revocation scope.** A policy spends until budget, daily cap or expiry — whichever hits first.
- **tUSD8 is centrally issued.** Blocklisting can stall a spend (the whole tx reverts).
- **Allowance-based pull.** If the buyer lowers the allowance below a pending spend, the spend reverts (safe direction).
- **purposeHash is public.** The purpose text stays offchain but anyone with the bundle/receipt can guess it if it's predictable.
- **Frontend reads a public RPC.** Reorgs or a lagging node can briefly show stale budgets; the chain is the truth.
- **UTC day bucket.** Daily caps reset at 00:00 UTC, not rolling 24h.
- **No ERC-4337 yet.** Session keys are EOAs; Kernel v3.1 smart-account session keys are the roadmap (see `docs/ARCHITECTURE.md` and the docs page).
- **Explorer verification on Aevum is unavailable.** Source of truth = this repo + deploy block + tx hashes.
- **Bundle files are sensitive-ish.** They contain vendor/purpose metadata; treat distribution accordingly (no PII in `label`/`purpose`).
