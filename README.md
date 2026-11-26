# Leash

**Your agent pays. Only what you allow.**

Leash is the spend-allowance layer for AI agents. A buyer sets a per-transaction cap, a total budget,
an optional daily rolling cap and a vendor allowlist onchain, then hands the agent a **session key**.
The agent signs short-lived EIP-712 `SpendAuth` messages; the Leash contract verifies every limit and
moves tUSD8 straight from the buyer to the vendor. One transaction kills the key forever.

Built on **QDay Aevum testnet** (chain `44005`) with **tUSD8** (6 decimals), for
[Aevum Builder Challenge #1](https://dorahacks.io/hackathon/qday/detail). Shanghai EVM, legacy transactions.

## Live evidence

| Item | Value |
| --- | --- |
| Public repo | https://github.com/vincentofweb3/leash |
| Live app | https://leash-kohl.vercel.app |
| Aevum testnet contract | [`0xdec9195d6f321b9e078b0d70a8fe15dea2e99a7f`](https://explorer-test.qday.info/address/0xdec9195d6f321b9e078b0d70a8fe15dea2e99a7f) (block 3440063) |
| Testnet txs | [deploy](https://explorer-test.qday.info/tx/0xff4a4ca749f140de20b2cb29acebcf3f5b5028abc9257f48c79456b02c5d2c8b) · [spend 0.5](https://explorer-test.qday.info/tx/0x61a63983290fea87134c012fc8aeece611b2b7d79453a8ed101c9c621d4aa5fe) · [revoke](https://explorer-test.qday.info/tx/0x1789dd88e5f010575be5df6ed494d377777419148bfaed0a0eb8d5cd1f4b0df0) · [final demo create](https://explorer-test.qday.info/tx/0x666d8e653ef882569c507a4115545d9cb0c04bed194bdce7d884f6d47d46b15e) · [final demo spend](https://explorer-test.qday.info/tx/0xceab37bde2e88105ca46aa4641e9457e15026adcd17dc69d016354108c6e08f9) — full set in `docs/VERIFICATION.md` |
| Contract tests | `47 passed, 0 failed` (unit) + `2 passed` fork tests vs real tUSD8 |
| Fork E2E | full loop verified on a local fork (deal → approve → create → pay → revoke) |
| Live E2E | 5 policies, 4 active + 1 revoked, 5 settled spends, 0.7 tUSD8, 2 vendors; approve → createPolicy → agent spend → revoke → CLI fail-closed on chain 44005 |
| Machine-readable proof | `/proof.json` (CORS-open deployment snapshot) and `/api/proof?tx=<hash>` (per-receipt proof export) |
| Live demo policy | [Policy #4](https://leash-kohl.vercel.app/policy/4) — 0.05 of 0.1 tUSD8 spent · [receipt](https://leash-kohl.vercel.app/receipts/0xceab37bde2e88105ca46aa4641e9457e15026adcd17dc69d016354108c6e08f9) · [proof.json](https://leash-kohl.vercel.app/proof.json) |

## What it is

Giving an agent a funded wallet scales catastrophically; per-transaction human approval doesn't scale at
all. Leash is the bounded middle:

1. **Buyer sets the limits** — one approval of exactly the budget, one `createPolicy` transaction:
   per-tx cap, budget, optional daily cap, vendor allowlist (≤ 16, empty = any), expiry, label hash.
2. **Agent pays inside them** — `leash pay` signs a `SpendAuth` and calls `spend()`. The contract checks
   revocation, expiry, nonce, per-tx cap, remaining budget, daily cap and allowlist, then executes
   `transferFrom(buyer → vendor)`. Amounts never custody in the contract.
3. **Buyer stays in charge** — `revoke()` ends the session key in one tx; `setLimits` adjusts caps;
   `extend` pushes expiry; the wallet's allowance to Leash can be zeroed at any time.

## Why not the alternatives

| | Raw agent key | Approve every payment | Leash |
| --- | --- | --- | --- |
| Agent acts without a human | yes | no | **yes, inside the policy** |
| Blast radius if the key leaks | the wallet | none | **per-tx cap × remaining budget** |
| Vendor restrictions | none | per payment | **onchain allowlist** |
| Revoke in one tx | rotate everything | n/a | **yes** |
| Audit trail | wallet history | wallet history | **typed `Spent` events + purpose hashes** |

## Quickstart

```bash
git clone https://github.com/vincentofweb3/leash.git
cd leash
make install        # submodules + pnpm
make check          # Shanghai opcode check, unit tests, fork tests, typecheck
pnpm dev            # http://localhost:3000 (Next.js desk)
```

`make fork` + `make deal TO=<addr>` gives you a local copy of Aevum with real tUSD8 and free test balances —
the fastest way to see the whole flow without faucet funds.

### Agent CLI

```bash
cd cli && pnpm build
leash keygen                              # session keypair (chmod 600), prints the address
# buyer: desk → New policy → session address, caps, allowlist → approve + createPolicy → download bundle.json
leash show ./bundle.json                  # what the buyer approved
leash pay --bundle ./bundle.json --key ~/.leash/agent.key \
  --vendor 0xVendor… --amount 12.50 --purpose "invoice #1042"
leash activity --bundle ./bundle.json     # every Spent event, 1,000 blocks at a time
```

`pay` fails closed: it reads the policy onchain and refuses to sign when the spend would revert
(revoked, expired, over cap, over budget, over daily cap).

## Repository layout

```text
contracts/            Leash.sol (policy registry + SpendAuth verifier), MockUSD8, Foundry tests, fork tests
cli/                  @leash/cli — keygen / show / pay / activity
packages/aevum/       chain config, tUSD8 ABI, getLogsChunked (≤1,000 blocks per call)
packages/leash/       @leash/kit — Leash ABI, EIP-712 builders, policy bundle helpers
examples/             runnable TypeScript: pay, read-spends, check-setup
web/                  Next.js desk: overview, /new wizard, policy detail (terms, allowlist, spends), /activity, /receipts/<tx>, /docs, /proof.json
docs/                 ARCHITECTURE, SECURITY, VERIFICATION, LIMITATIONS, DEMO, JUDGING (rubric traceability)
```

## How Leash was built

- **Contract-first**: 47 unit tests + fork tests against the real tUSD8 were green before any UI existed.
- **Fail closed everywhere**: CLI checks revocation/expiry/caps onchain before signing; the contract enforces the same again.
- **No custody, no admin**: the contract pulls via the buyer's allowance at spend time; no owner, pause,
  upgrade or fee. See `docs/SECURITY.md`.
- **Aevum, exactly**: Shanghai EVM (`evm_version = "shanghai"`, CI opcode check), ≤1,000-block log chunks,
  HTTPS polling, legacy (type-0) transactions, no explorer verification → evidence is the repo + deploy block + tx hashes.

## License & attribution

MIT (see [LICENSE](LICENSE)). Based on the
[Aevum Starter Kit](https://github.com/qday-io/aevum-starter-kit) (MIT, © 2026 PQA Labs) — its chain config,
tUSD8 helpers, Shanghai tooling and workspace scaffolding; the Leash contract, desk, CLI and SDK are new work.
Third-party licenses in [NOTICE.md](NOTICE.md). See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) before any real use.
