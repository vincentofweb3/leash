/**
 * The canonical agent flow: read a policy bundle, sign a SpendAuth with the session key,
 * and submit it to Leash. The contract enforces the caps — the agent cannot overspend.
 *   LEASH_BUNDLE=./bundle.json LEASH_AGENT_KEY=0x… VENDOR=0x… AMOUNT=1.5 pnpm example pay
 */
import { readFileSync } from "node:fs";
import { parseUnits, getAddress, createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { aevumTestnet, txUrl } from "@aevum-kit/aevum";
import {
  leashAbi, purposeHashOf, randomNonce, spendAuthTypedData, parseBundle, type PolicyBundle,
} from "@leash/kit";
import { required, requiredAddress, requiredKey } from "./env";

const bundle: PolicyBundle = parseBundle(JSON.parse(readFileSync(required("LEASH_BUNDLE"), "utf8")));
const account = privateKeyToAccount(requiredKey("LEASH_AGENT_KEY"));
const vendor = requiredAddress("VENDOR");
const amount = parseUnits(required("AMOUNT"), 6);
const purpose = process.env.PURPOSE ?? "leash example spend";
const leash = getAddress(bundle.leash);

const publicClient = createPublicClient({ chain: aevumTestnet, transport: http(process.env.RPC_URL) });
const rpcUrl = process.env.RPC_URL?.trim() || aevumTestnet.rpcUrls.default.http[0]!;

const policy = await publicClient.readContract({
  address: leash,
  abi: leashAbi,
  functionName: "policyOf",
  args: [BigInt(bundle.policyId)],
});
if (policy.revoked) throw new Error("policy is revoked — nothing sent");

const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
const auth = {
  policyId: BigInt(bundle.policyId),
  agent: account.address,
  vendor,
  amount,
  purposeHash: purposeHashOf(purpose),
  nonce: randomNonce(),
  expiresAt,
} as const;
const signature = await account.signTypedData(spendAuthTypedData(aevumTestnet.id, leash, auth));
const sig = signature.slice(2);
const v = Number(`0x${sig.slice(128, 130)}`);
const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
const s = `0x${sig.slice(64, 128)}` as `0x${string}`;

const wallet = createWalletClient({ account, chain: aevumTestnet, transport: http(rpcUrl) });
const hash = await wallet.writeContract({
  address: leash,
  abi: leashAbi,
  functionName: "spend",
  args: [auth, v, r, s],
  type: "legacy",
});
console.log(`settled: ${txUrl(hash)}`);
