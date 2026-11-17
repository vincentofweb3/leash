import { parseAbi, type Address } from "viem";
import { aevumTestnet, TUSD8_ADDRESS } from "@aevum-kit/aevum";

export { aevumTestnet, aevumFork, localAnvil, TUSD8_ADDRESS, TUSD8_DECIMALS } from "@aevum-kit/aevum";

/** Deployed Leash on Aevum testnet (chain 44005). Also the address the web app and CLI default to. */
export const LEASH_ADDRESS: Address = "0xdec9195d6f321b9e078b0d70a8fe15dea2e99a7f";

/** Block the testnet Leash was deployed at. Kept in one place so the app, CLI and docs agree. */
export const LEASH_DEPLOY_BLOCK = 3440063n;

export const leashAbi = parseAbi([
  "function token() view returns (address)",
  "function nextPolicyId() view returns (uint256)",
  "function createPolicy(address agent, uint256 perTxCap, uint256 budget, uint64 dailyCap, uint64 expiry, bytes32 labelHash, address[] allowlist) returns (uint256)",
  "function revoke(uint256 policyId)",
  "function setLimits(uint256 policyId, uint256 perTxCap, uint256 budget, uint64 dailyCap)",
  "function extend(uint256 policyId, uint64 expiry)",
  "function setAllowlist(uint256 policyId, address[] allowlist)",
  "function spend((uint256 policyId, address agent, address vendor, uint256 amount, bytes32 purposeHash, bytes32 nonce, uint64 expiresAt) auth, uint8 v, bytes32 r, bytes32 s)",
  "function policyOf(uint256 policyId) view returns ((address buyer, address agent, uint256 perTxCap, uint256 budget, uint256 spent, uint64 expiry, uint64 dailyCap, uint256 daySpent, uint64 dayBucket, bool revoked, bytes32 labelHash))",
  "function remainingBudget(uint256 policyId) view returns (uint256)",
  "function todaySpent(uint256 policyId) view returns (uint256)",
  "function allowlistOf(uint256 policyId) view returns (address[])",
  "function hashSpendAuth((uint256 policyId, address agent, address vendor, uint256 amount, bytes32 purposeHash, bytes32 nonce, uint64 expiresAt) auth) view returns (bytes32)",
  "event PolicyCreated(uint256 indexed policyId, address indexed buyer, address indexed agent, uint256 perTxCap, uint256 budget, uint64 dailyCap, uint64 expiry, bytes32 labelHash, uint256 allowlistSize)",
  "event PolicyRevoked(uint256 indexed policyId, address indexed buyer)",
  "event PolicyLimitsUpdated(uint256 indexed policyId, uint256 perTxCap, uint256 budget, uint64 dailyCap)",
  "event PolicyExpiryExtended(uint256 indexed policyId, uint64 expiry)",
  "event AllowlistUpdated(uint256 indexed policyId, uint256 size)",
  "event Spent(uint256 indexed policyId, address indexed vendor, uint256 amount, bytes32 purposeHash, bytes32 nonce, uint256 spentAfter)",
  "error ZeroAmount()",
  "error ZeroAddress()",
  "error BadPerTxCap()",
  "error BadBudget()",
  "error PolicyExpired()",
  "error SpendExpired()",
  "error Revoked()",
  "error NotBuyer()",
  "error BadSignature()",
  "error ExceedsPerTxCap()",
  "error ExceedsBudget()",
  "error ExceedsDailyCap()",
  "error VendorNotAllowed()",
  "error NonceUsed()",
  "error AllowanceTooSmall(uint256 remaining)",
  "error AllowlistTooLarge()",
  "error UnknownPolicy()",
  "error SpendAuthAgentMismatch()",
  "error ZeroVendor()",
  "error ExpiryNotExtended()",
]);

export const LEASH_CHAIN_ID = aevumTestnet.id;
export const LEASH_TUSD8 = TUSD8_ADDRESS;
