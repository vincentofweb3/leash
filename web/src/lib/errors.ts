import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/** Turns wallet / RPC / revert errors into one sentence a user can act on. */
export function explain(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong. Try again.";
  // MetaMask won't add a network whose RPC URL another saved network already uses.
  const dup = /same RPC endpoint as existing network for chain \w+ \('([^']*)'\)/.exec(fullMessage(error));
  if (dup) return `Your wallet already has a network ("${dup[1]}") using the same RPC address. Edit or remove that network in your wallet, then try again.`;
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) return "You cancelled the request in your wallet. Nothing was sent.";
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      switch (name) {
        case "Revoked":
          return "This policy was revoked. Ask the buyer for a new policy before the agent can pay again.";
        case "PolicyExpired":
          return "This policy expired. The buyer can extend it in the desk.";
        case "SpendExpired":
          return "The signed authorization expired before it was submitted. Sign again.";
        case "ExceedsPerTxCap":
          return "That spend is above the per-transaction cap. Raise the cap in the desk or split the payment.";
        case "ExceedsBudget":
          return "That spend exceeds the remaining budget. Raise the budget in the desk.";
        case "ExceedsDailyCap":
          return "That spend would exceed the daily cap. Wait for the next day or raise the cap.";
        case "VendorNotAllowed":
          return "The vendor is not on this policy's allowlist. Add it in the desk first.";
        case "NonceUsed":
          return "This authorization was already used. Go back and sign again.";
        case "BadSignature":
          return "The signature doesn't recover to this policy's agent key. Sign with the right key.";
        case "AllowanceTooSmall":
          return "Your tUSD8 allowance to Leash is lower than the spend. Approve more first.";
        case "ZeroAmount":
          return "The amount must be more than zero.";
        case "UnknownPolicy":
          return "That policy does not exist on this network.";
        case "NotBuyer":
          return "Only the buyer who created the policy can do that.";
        default:
          break;
      }
      const reason = revert.reason ?? "";
      if (reason) return reason;
      if (name) return `The transaction reverted: ${name}`;
    }
    if (/insufficient funds/i.test(error.message)) return "Not enough tQDAY for gas. Get some from the faucet.";
    return error.shortMessage;
  }
  return error.message;
}

/** Wallet errors often hide the real reason in `cause` or `data.cause`. */
function fullMessage(error: unknown, depth = 0): string {
  if (!error || typeof error !== "object" || depth > 5) return "";
  const e = error as { message?: unknown; details?: unknown; cause?: unknown; data?: { cause?: unknown; message?: unknown } };
  return [e.message, e.details, e.data?.message, fullMessage(e.cause, depth + 1), fullMessage(e.data?.cause, depth + 1)]
    .filter((m) => typeof m === "string" && m)
    .join(" | ");
}
