# Verification

Status as of 2026-11-17. This file separates fork evidence (already run) from live testnet evidence (pending faucet + deploy).

## Public source

Repo: https://github.com/vincentofweb3/leash (public). Clean clone + `make check` is the documented path.

## Tests

| Suite | Command | Result |
| --- | --- | --- |
| Unit (Foundry) | `forge test --no-match-path 'test/fork/*'` | **47 passed, 0 failed** |
| Fork vs real tUSD8 | `forge test --match-path 'test/fork/*' --fork-url https://rpc-test.qday.info` | **2 passed** |
| Web build | `pnpm build` | passes |
| Typecheck (cli/examples/web/packages) | `pnpm -r typecheck` | clean |
| Shanghai opcode check | `node tools/check-shanghai.mjs contracts/out` | runs in `make check` |

## Fork E2E (local fork of Aevum, real tUSD8, anvil chain 440050)

All steps executed 2026-11-17 on `http://127.0.0.1:8555`:

1. `Deploy.s.sol` broadcast → Leash at `0xb87c0c359aee8ff5da1a12ff6027d8430c22d574`, deploy block `3424117`.
2. `configureMinter` + `mint` via the tUSD8 master minter (fork-only impersonation) → buyer funded 1,000 tUSD8 + 10 tQDAY.
3. `approve(Leash, 500e6)` → tx `0x6e9b3ac555a207e263c1edd7116c4ae53e5eafaec6ec2f158314937231b58b08` (status 1).
4. `createPolicy(agent=0xDb43…, cap=10, budget=100, daily=25, expiry=+30d, allowlist=[])` → policy id `0`, tx `0xf15f5c2e939eb9693b7a75bc82f81ed3d2ecac3f55d37a0e3aa22c4ceb6d02cc` (status 1).
5. `leash pay --amount 5` → settled, tx `0x9be94a523b31874255607ed3685bd8b8693b7c58ea0564d2894aa89d307c1db9` (status 1);
   receipt shows `Transfer` of 5e6 (`0x4c4b40`) buyer→vendor + `Spent` event; CLI printed `remaining: 95 tUSD8`.
6. `leash activity` → lists the spend with purpose hash and cumulative 5 tUSD8.
7. Buyer `revoke(0)` → tx `0x7255c9f398f9a4b90ecda92a78b532dcb0f7660fec59f32552f64d72f87dd332` (PolicyRevoked).
8. `leash pay` after revocation → **fails closed**: `leash: policy is revoked — the buyer killed this session key. Nothing was sent.`

## Live Aevum testnet (chain 44005) — PENDING

Waiting on faucet funds (Discord `/faucet 0xBdfA76A871Fba289914f9e40a545BBceb30150C7`, or faucet.qday.info).
To be filled:

| Check | Value |
| --- | --- |
| Deployer | 0xBdfA76A871Fba289914f9e40a545BBceb30150C7 |
| Leash address | `[fill]` |
| Deploy tx | `[fill]` |
| Deploy block | `[fill]` |
| approve (budget) tx | `[fill]` |
| createPolicy tx | `[fill]` |
| First spend (`Spent`) tx | `[fill]` |
| revoke tx | `[fill]` |
| Sample receipt screenshot | `public/screenshots/proof-testnet.png` |

Deploy command used:

```bash
forge script script/Deploy.s.sol --rpc-url https://rpc-test.qday.info \
  --broadcast --legacy --private-key $(cat ~/aevum-deployer.key)
```
