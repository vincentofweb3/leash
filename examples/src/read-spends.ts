/**
 * Lists every Spent event for one policy, 1,000 blocks at a time (Aevum's eth_getLogs limit).
 *   LEASH_BUNDLE=./bundle.json FROM_BLOCK=2970000 pnpm example read-spends
 */
import { readFileSync } from "node:fs";
import { formatUnits, getAbiItem, type Address } from "viem";
import { leashAbi, parseBundle } from "@leash/kit";
import { getLogsChunked } from "@aevum-kit/aevum";
import { connect, required } from "./env";

const bundle = parseBundle(JSON.parse(readFileSync(required("LEASH_BUNDLE"), "utf8")));
const { client } = await connect();
const head = await client.getBlockNumber();
const fromBlock = process.env.FROM_BLOCK ? BigInt(process.env.FROM_BLOCK) : head > 50_000n ? head - 50_000n : 0n;

const logs = await getLogsChunked(client, {
  address: bundle.leash as Address,
  event: getAbiItem({ abi: leashAbi, name: "Spent" }),
  args: { policyId: BigInt(bundle.policyId) },
  fromBlock,
  toBlock: head,
  onProgress: (done, total) => process.stderr.write(`\rscanned ${done}/${total} blocks`),
});
process.stderr.write("\n");
for (const log of logs) {
  const a = log.args as { vendor?: Address; amount?: bigint; purposeHash?: string; spentAfter?: bigint };
  console.log(`block ${log.blockNumber}  ${formatUnits(a.amount ?? 0n, 6)} tUSD8 -> ${a.vendor}  total ${formatUnits(a.spentAfter ?? 0n, 6)}`);
}
console.log(`${logs.length} spend(s) for policy ${bundle.policyId}`);
