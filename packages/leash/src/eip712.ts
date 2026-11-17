import { keccak256, stringToBytes, bytesToHex, type Address, type Hex } from "viem";
import { randomBytes } from "node:crypto";

/** EIP-712 type hashes and typed-data builders for SpendAuth. Domain must be {name:"Leash",version:"1",chainId,verifyingContract}. */

export const SPEND_AUTH_TYPES = {
  SpendAuth: [
    { name: "policyId", type: "uint256" },
    { name: "agent", type: "address" },
    { name: "vendor", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "purposeHash", type: "bytes32" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export interface SpendAuthMessage {
  policyId: bigint;
  agent: Address;
  vendor: Address;
  amount: bigint;
  purposeHash: Hex;
  nonce: Hex;
  expiresAt: bigint;
}

export function spendAuthDomain(chainId: number, verifyingContract: Address) {
  return { name: "Leash", version: "1", chainId, verifyingContract } as const;
}

/** Ready-to-sign typed data for viem's signTypedData. */
export function spendAuthTypedData(chainId: number, verifyingContract: Address, message: SpendAuthMessage) {
  return {
    domain: spendAuthDomain(chainId, verifyingContract),
    types: SPEND_AUTH_TYPES,
    primaryType: "SpendAuth" as const,
    message,
  };
}

/** purposeHash = keccak256(utf8 bytes of the purpose text). The text stays offchain. */
export function purposeHashOf(purpose: string): Hex {
  return keccak256(stringToBytes(purpose));
}

/** 32 random bytes as a replay-safe nonce. */
export function randomNonce(): Hex {
  return bytesToHex(randomBytes(32));
}
