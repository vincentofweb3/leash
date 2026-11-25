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

## Live Aevum testnet (chain 44005) — DONE 2026-11-17

Deployer wallet (funded via faucet + user forward): `0xBdfA76A871Fba289914f9e40a545BBceb30150C7`.
Agent session key: `0xDB2eBD2108f1488f37723920E753D17A47907a91` (funded 0.1 tQDAY at block 3440098,
tx `0xfdd72623c02588e6bb3e7eda4e5b019e8a990aafaeb65119c76b0eff89022e6c`).
Vendor (payee): `0x806d78417495c71e4748946C6f3e0a347b068df3`.

| Check | Value |
| --- | --- |
| Leash address | `0xdec9195d6f321b9e078b0d70a8fe15dea2e99a7f` |
| Deploy tx | `0xff4a4ca749f140de20b2cb29acebcf3f5b5028abc9257f48c79456b02c5d2c8b` (block 3440063, status 1) |
| approve(Leash, 1 tUSD8) tx | `0x71ddad5c508944fd54959c8fe75bce56603adb838e7bf1d4acf3fff9de0d455b` (block 3478976) |
| createPolicy(policyId 0) tx | `0xd967a5c3e1d253e469a2a5eee9cb867c4dc4612d3181ae806cce467b181a06ea` (block 3478986) |
| First spend — 0.5 tUSD8 (policy 0) | `0x61a63983290fea87134c012fc8aeece611b2b7d79453a8ed101c9c621d4aa5fe` (block 3479008) |
| createPolicy(policyId 1, kill-switch test) tx | `0x1d686144e13c735ee23b1fa9cab79eb26050b8ec9a3a1e9c3db9a48209026dae` (block 3479050) |
| revoke(policyId 1) tx | `0x1789dd88e5f010575be5df6ed494d377777419148bfaed0a0eb8d5cd1f4b0df0` (block 3479060) |
| CLI pay on revoked policy | fails closed: `leash: policy is revoked — the buyer killed this session key. Nothing was sent.` |

Explorer: [Leash contract](https://explorer-test.qday.info/address/0xdec9195d6f321b9e078b0d70a8fe15dea2e99a7f) ·
[spend](https://explorer-test.qday.info/tx/0x61a63983290fea87134c012fc8aeece611b2b7d79453a8ed101c9c621d4aa5fe) ·
[receipt verifier](https://leash-kohl.vercel.app/receipts/0x61a63983290fea87134c012fc8aeece611b2b7d79453a8ed101c9c621d4aa5fe)
(renders the Spent event straight from the receipt).

Policy 0 is intentionally **active** (0.5 tUSD8 remaining budget) for the demo.
Policy 1 was created solely to prove the live kill switch.

Deploy command used:

```bash
forge script script/Deploy.s.sol --rpc-url https://rpc-test.qday.info \
  --broadcast --legacy --private-key <testnet deployer key>
```

Every transaction above can be reproduced read-only with `cast receipt <hash> --rpc-url https://rpc-test.qday.info`.

## Second live Aevum testnet run — 2026-11-22

A fresh agent/vendor pair and a new policy, created and spent through the real CLI. This run also
exercised the refusal path: an over-cap payment is rejected before anything is signed or sent.

| Check | Value |
| --- | --- |
| Buyer / deployer | `0xBdfA76A871Fba289914f9e40a545BBceb30150C7` |
| Agent key (new) | `0x70d155F47E5b37F6e3116C57643148166b025844` — funded 0.1 tQDAY, tx `0x367a37ced8fa43647ac60ce795489b0cfed035a2b1a054893f67da7149545117` (block 3863428) |
| Vendor (new) | `0xf3F0E1F7C52e20f216f699412244Fc29251F6bC8` |
| createPolicy(policyId 2) | tx `0xee207ad6f1125605fd443ae72cbfe02d5d15a06039ca4941a438af51301756e6` (block 3863431) — 0.3 tUSD8 budget, 0.1 per-tx cap, 0.2 daily cap, allowlist `[vendor]`, expiry +30d |
| Spend 1 — 0.05 tUSD8 | tx `0xd580293e393f292553778ed32e63a120a3787df5b9e9a2c521aab1207aeb9b30` (block 3876545) |
| Spend 2 — 0.05 tUSD8 | tx `0xb3eaeee40297b519349bb758b3b5231abb072976bc1939dd8d418b3988195139` (block 3876581) |
| Over-cap attempt — 0.15 tUSD8 | **refused by the CLI before signing**: `amount exceeds the per-transaction cap (0.1 tUSD8)`. No transaction, no event. |
| Policy 2 state after | spent 0.1 tUSD8, remaining 0.2 tUSD8, not revoked |
| Vendor balance after | 0.1 tUSD8 |
| Machine-readable proof | `/proof.json` → 3 Spent events, 0.6 tUSD8 settled, `source: explorer`, `complete: true` |

Explorer: [policy 2 creation](https://explorer-test.qday.info/tx/0xee207ad6f1125605fd443ae72cbfe02d5d15a06039ca4941a438af51301756e6) ·
[spend 1](https://explorer-test.qday.info/tx/0xd580293e393f292553778ed32e63a120a3787df5b9e9a2c521aab1207aeb9b30) ·
[spend 2](https://explorer-test.qday.info/tx/0xb3eaeee40297b519349bb758b3b5231abb072976bc1939dd8d418b3988195139)

Desk: [policy #2](https://leash-kohl.vercel.app/policy/2) · [spend 2 receipt](https://leash-kohl.vercel.app/receipts/0xb3eaeee40297b519349bb758b3b5231abb072976bc1939dd8d418b3988195139) · [proof.json](https://leash-kohl.vercel.app/proof.json)

The agent key and bundle for this run live at `/tmp/leash-live/` on the build machine and are intentionally
ephemeral; the onchain policy and spends remain verifiable without them.

## User-run spend on policy #2 — 2026-11-24

A third 0.05 tUSD8 spend was executed by the user through the CLI with the same demo agent key, bringing
policy #2 to 0.15 tUSD8 spent (half of its 0.3 tUSD8 budget) and the testnet total to four Spent events.

| Check | Value |
| --- | --- |
| Agent sender | `0x70d155F47E5b37F6e3116C57643148166b025844` |
| Spend 3 — 0.05 tUSD8 | tx `0x67c592712f512823145357dd576b171c1c5686474fe2fb42fd8e2ccbee626825` (block 3899948) |
| Policy 2 state after | spent 0.15 tUSD8, remaining 0.15 tUSD8, daily remaining 0.05 tUSD8, not revoked |
| Vendor balance after | 0.15 tUSD8 |
| Machine-readable proof | `/proof.json` → 4 Spent events, 0.65 tUSD8 settled, `source: explorer`, `complete: true` |

Explorer: [spend 3](https://explorer-test.qday.info/tx/0x67c592712f512823145357dd576b171c1c5686474fe2fb42fd8e2ccbee626825)

Desk: [policy #2](https://leash-kohl.vercel.app/policy/2) · [spend 3 receipt](https://leash-kohl.vercel.app/receipts/0x67c592712f512823145357dd576b171c1c5686474fe2fb42fd8e2ccbee626825) · [proof.json](https://leash-kohl.vercel.app/proof.json)
