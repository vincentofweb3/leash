#!/usr/bin/env node
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  getAbiItem,
  isAddress,
  isHex,
  parseUnits,
  type Address,
  type Hex,
  type Chain,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { aevumTestnet, aevumFork, localAnvil, getLogsChunked, txUrl } from "@aevum-kit/aevum";
import {
  LEASH_ADDRESS,
  leashAbi,
  purposeHashOf,
  randomNonce,
  spendAuthTypedData,
  parseBundle,
  type PolicyBundle,
} from "@leash/kit";

const HELP = `Leash agent CLI — scoped, onchain spend allowances for AI agents

Usage:
  leash keygen [--out ./agent.key]     Create a session keypair; writes the private key to a file (chmod 600) and prints only the address
  leash show <bundle.json>             Decode a policy bundle a buyer gave you
  leash pay --bundle b.json --key agent.key \\
      --vendor 0x... --amount 5.25 --purpose "invoice #1042" [--expires-minutes 60]
  leash activity --bundle b.json [--from-block N] [--rpc-url URL]

Rules:
  - The session key is read from a file or LEASH_AGENT_KEY. It is never a command-line value and never printed.
  - Amounts are decimal tUSD8 (6 decimals).
  - pay fails closed: checks revocation, expiry, per-tx cap and remaining budget onchain BEFORE submitting.
  - Over-cap or revoked: the CLI prints the reason and exits non-zero. Nothing moves.

Bundle:
  The buyer creates it in the Leash desk (New Policy -> hand to agent). It holds no secrets.
`;

function fail(msg: string): never {
  console.error(`leash: ${msg}`);
  process.exit(1);
}

function readBundle(path: string): PolicyBundle {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(`cannot read bundle ${path}: ${(e as Error).message}`);
  }
  try {
    return parseBundle(json);
  } catch (e) {
    fail(`invalid bundle: ${(e as Error).message}`);
  }
}

function readKey(keyFile?: string): Hex {
  const fromEnv = process.env.LEASH_AGENT_KEY?.trim();
  const raw = keyFile
    ? readFileSync(keyFile, "utf8").trim()
    : fromEnv ?? fail("pass --key <file> or set LEASH_AGENT_KEY");
  const key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  if (!isHex(key) || key.length !== 66) fail("key file must contain a 32-byte hex private key");
  return key;
}

function expandHome(p: string): string {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

const CHAINS: Record<number, Chain> = {
  [aevumTestnet.id]: aevumTestnet,
  [aevumFork.id]: aevumFork,
  [localAnvil.id]: localAnvil,
};

/** Pick the chain definition from a chain id; unknown ids get the testnet shape with the id swapped in. */
function chainFor(chainId: number): Chain {
  return CHAINS[chainId] ?? { ...aevumTestnet, id: chainId };
}

async function cmdKeygen(args: string[]) {
  const { values } = parseArgs({ args, options: { out: { type: "string" } } });
  const out = expandHome(values.out ?? join(homedir(), ".leash", "agent.key"));
  const key = generatePrivateKey();
  writeFileSync(out, `${key}\n`, { mode: 0o600 });
  chmodSync(out, 0o600);
  const account = privateKeyToAccount(key);
  console.log(`session key written to ${out} (chmod 600, never printed)`);
  console.log(`session address: ${account.address}`);
  console.log(`give this address to your buyer — they paste it into the Leash desk when creating the policy`);
}

async function cmdShow(args: string[]) {
  const { positionals } = parseArgs({ args, allowPositionals: true, options: {} });
  const bundlePath = positionals[0] ?? fail("usage: leash show <bundle.json>");
  const b = readBundle(bundlePath);
  console.log(`bundle version : ${b.version}`);
  console.log(`chain          : ${b.chainId} (${b.chainId === 44005 ? "QDay Aevum Testnet" : "other"})`);
  console.log(`leash contract : ${b.leash}${b.leash === LEASH_ADDRESS ? "" : " (custom)"}`);
  console.log(`policy id      : ${b.policyId}`);
  console.log(`label          : ${b.label || "(none)"}`);
  console.log(`buyer          : ${b.buyer}`);
  console.log(`agent          : ${b.agent}`);
  console.log(`per-tx cap     : ${formatUnits(BigInt(b.perTxCap), 6)} tUSD8`);
  console.log(`budget         : ${formatUnits(BigInt(b.budget), 6)} tUSD8`);
  console.log(`daily cap      : ${b.dailyCap === "0" ? "disabled" : `${formatUnits(BigInt(b.dailyCap), 6)} tUSD8/day`}`);
  console.log(`expiry         : ${new Date(Number(b.expiry) * 1000).toISOString()}`);
}

async function cmdPay(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      bundle: { type: "string" },
      key: { type: "string" },
      vendor: { type: "string" },
      amount: { type: "string" },
      purpose: { type: "string" },
      "expires-minutes": { type: "string" },
      "rpc-url": { type: "string" },
    },
  });
  if (!values.bundle || !values.vendor || !values.amount || !values.purpose) {
    fail("usage: leash pay --bundle b.json [--key agent.key] --vendor 0x... --amount 5.25 --purpose \"...\" [--expires-minutes 60]");
  }
  const bundle = readBundle(values.bundle);
  if (!isAddress(values.vendor)) fail(`--vendor is not an address: ${values.vendor}`);

  const account = privateKeyToAccount(readKey(values.key));
  if (account.address.toLowerCase() !== bundle.agent.toLowerCase()) {
    fail(`key does not match the bundle's agent address (bundle expects ${bundle.agent}, key is ${account.address})`);
  }

  const rpcUrl = values["rpc-url"] ?? aevumTestnet.rpcUrls.default.http[0]!;
  const probe = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await probe.getChainId();
  if (chainId !== bundle.chainId) fail(`RPC reports chain ${chainId}, bundle expects ${bundle.chainId}`);
  const chain = chainFor(chainId);
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const amount = parseUnits(values.amount, 6);
  const policy = await client.readContract({
    address: bundle.leash as Address,
    abi: leashAbi,
    functionName: "policyOf",
    args: [BigInt(bundle.policyId)],
  });

  // fail closed, onchain state first
  if (policy.revoked) fail("policy is revoked — the buyer killed this session key. Nothing was sent.");
  if (BigInt(Math.floor(Date.now() / 1000)) >= BigInt(policy.expiry)) {
    fail("policy expired — ask the buyer to extend it in the Leash desk.");
  }
  if (amount === 0n) fail("amount must be greater than zero");
  if (amount > policy.perTxCap) fail(`amount exceeds the per-transaction cap (${formatUnits(policy.perTxCap, 6)} tUSD8).`);
  const remaining = policy.budget - policy.spent;
  if (amount > remaining) fail(`amount exceeds the remaining budget (${formatUnits(remaining, 6)} tUSD8).`);
  if (policy.dailyCap !== 0n) {
    const today = await client.readContract({
      address: bundle.leash as Address,
      abi: leashAbi,
      functionName: "todaySpent",
      args: [BigInt(bundle.policyId)],
    });
    if (today + amount > policy.dailyCap) {
      fail(`amount would exceed the daily cap (${formatUnits(policy.dailyCap, 6)} tUSD8, already used today: ${formatUnits(today, 6)}).`);
    }
  }

  const expiresMinutes = Number(values["expires-minutes"] ?? "60");
  if (!Number.isFinite(expiresMinutes) || expiresMinutes <= 0) fail("--expires-minutes must be a positive number");
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + Math.floor(expiresMinutes * 60));

  const auth = {
    policyId: BigInt(bundle.policyId),
    agent: account.address,
    vendor: values.vendor as Address,
    amount,
    purposeHash: purposeHashOf(values.purpose),
    nonce: randomNonce(),
    expiresAt,
  } as const;

  const signature = await account.signTypedData(spendAuthTypedData(chainId, bundle.leash as Address, auth));

  // split signature
  const sig = signature.slice(2);
  const r = `0x${sig.slice(0, 64)}` as Hex;
  const s = `0x${sig.slice(64, 128)}` as Hex;
  const v = Number(`0x${sig.slice(128, 130)}`);

  await client.simulateContract({
    address: bundle.leash as Address,
    abi: leashAbi,
    functionName: "spend",
    args: [auth, v, r, s],
    account,
  });

  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const hash = await wallet.writeContract({
    address: bundle.leash as Address,
    abi: leashAbi,
    functionName: "spend",
    args: [auth, v, r, s],
    type: "legacy",
  });
  console.log(`spend submitted: ${hash}`);
  console.log(`explorer       : ${txUrl(hash)}`);

  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") fail(`transaction reverted (status ${receipt.status}). See ${txUrl(hash)}`);
  console.log(`settled        : ${amountToTusd8(amount)} tUSD8 to ${values.vendor}`);
  console.log(`remaining      : ${amountToTusd8(remaining - amount)} tUSD8`);
}

function amountToTusd8(amount: bigint): string {
  return formatUnits(amount, 6);
}

async function cmdActivity(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      bundle: { type: "string" },
      "from-block": { type: "string" },
      "rpc-url": { type: "string" },
    },
  });
  if (!values.bundle) fail("usage: leash activity --bundle b.json [--from-block N] [--rpc-url URL]");
  const bundle = readBundle(values.bundle);
  const rpcUrl = values["rpc-url"] ?? aevumTestnet.rpcUrls.default.http[0]!;
  const probe = createPublicClient({ transport: http(rpcUrl) });
  const chainId = await probe.getChainId();
  const client = createPublicClient({ chain: chainFor(chainId), transport: http(rpcUrl) });

  const head = await client.getBlockNumber();
  const fromBlock = values["from-block"] ? BigInt(values["from-block"]) : head > 50_000n ? head - 50_000n : 0n;

  const logs = await getLogsChunked(client, {
    address: bundle.leash as Address,
    event: getAbiItem({ abi: leashAbi, name: "Spent" }),
    args: { policyId: BigInt(bundle.policyId) },
    fromBlock,
    toBlock: head,
  });

  if (logs.length === 0) {
    console.log(`no spends found for policy ${bundle.policyId} between blocks ${fromBlock} and ${head}`);
    return;
  }
  for (const log of logs) {
    const a = log.args as { vendor?: Address; amount?: bigint; purposeHash?: Hex; nonce?: Hex; spentAfter?: bigint };
    console.log(
      `block ${log.blockNumber}  ${amountToTusd8(a.amount ?? 0n)} tUSD8 -> ${a.vendor}  purpose ${a.purposeHash}  total ${amountToTusd8(a.spentAfter ?? 0n)}`,
    );
  }
  console.log(`${logs.length} spend(s) for policy ${bundle.policyId}`);
}

const [command, ...rest] = process.argv.slice(2);
switch (command) {
  case "keygen":
    await cmdKeygen(rest);
    break;
  case "show":
    await cmdShow(rest);
    break;
  case "pay":
    await cmdPay(rest);
    break;
  case "activity":
    await cmdActivity(rest);
    break;
  case undefined:
  case "help":
  case "--help":
    console.log(HELP);
    break;
  default:
    fail(`unknown command "${command}". Run "leash help".`);
}
