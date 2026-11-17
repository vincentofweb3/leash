# Third-party notices

This project is [Leash](README.md), built on the **Aevum Starter Kit** (MIT, © 2026 PQA Labs —
[github.com/qday-io/aevum-starter-kit](https://github.com/qday-io/aevum-starter-kit), [LICENSE](LICENSE) retained).
The starter kit is the workspace scaffold: Foundry config (`contracts/foundry.toml`, `tools/check-shanghai.mjs`,
`Makefile`), the `@aevum-kit/aevum` package (chain config, tUSD8 ABIs, `getLogsChunked`), the Next.js desk shell
and theming, and the pnpm workspace layout. The Leash contract (`contracts/src/Leash.sol`), the `@leash/kit`
SDK, the `leash` CLI, the policy desk pages and this project's docs are new work.

It builds on the open-source projects below.
The Solidity libraries are git submodules that keep their own LICENSE files, and the JavaScript packages are installed from npm.

## Solidity libraries (`contracts/lib`, git submodules)

| Project | Version | License | Source |
|---|---|---|---|
| forge-std | v1.9.6 | MIT or Apache-2.0 | https://github.com/foundry-rs/forge-std |
| OpenZeppelin Contracts | v5.1.0 | MIT | https://github.com/OpenZeppelin/openzeppelin-contracts |

## JavaScript packages (direct dependencies)

| Package | Version | License | Used in |
|---|---|---|---|
| next | 16.4.3 | MIT | web |
| react, react-dom | 19.2.0 | MIT | web |
| @rainbow-me/rainbowkit | 2.2.11 | MIT | web |
| wagmi | 2.19.5 | MIT | web |
| @tanstack/react-query | 5.90.2 | MIT | web |
| viem | 2.57.12 | MIT | web, examples, packages/aevum |
| tsx | 4.23.15 | MIT | examples (dev) |
| typescript | 5.9.3 | Apache-2.0 | all (dev) |

Their own dependencies carry their own licenses. To list them all, run `pnpm licenses list` in the repo root.
