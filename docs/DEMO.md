# Demo script

Target length: 3:30–4:30 including buffer. Preflight the evening before and 30 min before.

## Preflight

- [ ] `make check` green on the exact commit you will show
- [ ] Public app logged out renders `/`, `/new`, `/docs`; wallet NOT connected at start
- [ ] Testnet contract has the demo policy (buyer wallet ready, session key ready)
- [ ] One vendor address (a second wallet) funded with nothing; watch its tUSD8 balance arrive
- [ ] Explorer tabs queued: Leash contract, approve tx, createPolicy tx, spend tx, revoke tx
- [ ] No `.env`, no private keys, no personal data on screen; browser zoom ~110%
- [ ] Faucet: confirm deployer/buyer wallets still hold tQDAY + tUSD8

## Beats

1. **Hook (20s).** "Every team piloting agents hits the same wall: an agent that can spend needs
   limits, or a human permanently in the loop. Show the problem in one sentence." Open the home page.
2. **The policy (45s).** `/new` — paste the session address (from `leash keygen` CLI, show command output),
   set per-tx cap 10, budget 100, daily cap 25, expiry 30 days, allowlist = the vendor. Click
   Approve → createPolicy. Narrate: exact-budget approval, two transactions, nothing else.
3. **The spend (60s).** Terminal: `leash show bundle.json` (point out: no secrets). Then
   `leash pay --vendor <vendor> --amount 5 --purpose "invoice #1042"`. Show the tx hash.
   Explorer: `Transfer` buyer→vendor + `Spent` event with purpose hash. Policy page: spend table
   shows the row; progress bar moved; budget remaining 95.
4. **Fail closed (30s).** `leash pay --amount 15` → per-tx cap revert, CLI prints the reason, nothing moves.
   `leash pay --amount 96` → remaining-budget revert. (Camera on terminal only.)
5. **The kill switch (45s).** Buyer desk: policy page → Revoke → confirm. Terminal: `leash pay --amount 1 …`
   → `policy is revoked…`. Back on explorer: PolicyRevoked event. "Buyer sovereignty, one transaction."
6. **Receipt verifier (30s).** `/receipts/<spend-tx>` — paste hash, show it re-derives the Spent event
   from the chain; click purposeHash. "Anyone can verify without trusting us."
7. **Close (30s).** Repo, live app URL, contract address, roadmap (ERC-4337 session accounts on Aevum —
   qday-io/kernel is already there), `docs/VERIFICATION.md` with real hashes. Thank judges.

## Fallbacks

- RPC flake → have fork ready (`make fork`, `make deal`) and say the words "this is a local copy of the same chain, same contract, same tUSD8".
- Wallet rejects network add → use the one-click add page at explorer-test.qday.info.
- Bucket of fail-closed takes: amounts over cap (15) and over budget (96). Over daily cap (26 after today's spends) optional.

## Submission checklist (DoraHacks)

- [ ] Repo public + logged-out opens; exact deployed commit linked
- [ ] Contract address + deploy block + tx hashes in README and submission form
- [ ] Live deployment URL working; demo video link works without login (unlisted YouTube/Loom)
- [ ] Project doc: problem, architecture diagram, core workflows, tech list (see docs/ARCHITECTURE.md)
- [ ] Docs list what was built vs what was not (LIMITATIONS.md) — judges reward honesty
- [ ] DoraHacks registration completed; team size accurate (solo)
