import type { Metadata } from "next";
import { TUSD8_ADDRESS, links } from "@aevum-kit/aevum";
import { CodeBlock } from "@/components/CodeBlock";
import { GitHubIcon } from "@/components/Icons";
import { LEASH_ADDRESS } from "@leash/kit";
import { isAddress } from "viem";
import { repoUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "How Leash works end to end: the contract API, the EIP-712 SpendAuth schema, the CLI, security model, Aevum specifics and limitations.",
};

const HACKATHON_URL = "https://dorahacks.io/hackathon/qday/detail";
const DISCORD_URL = "https://discord.gg/bYPhjmrSfK";
const leashConfigured = isAddress(LEASH_ADDRESS) && LEASH_ADDRESS !== "0x0000000000000000000000000000000000000000";

const sections = [
  { id: "what", label: "What Leash is" },
  { id: "flow", label: "End-to-end flow" },
  { id: "contract", label: "Contract API" },
  { id: "spendauth", label: "SpendAuth schema" },
  { id: "quickstart", label: "Quickstart" },
  { id: "integration", label: "Agent integration" },
  { id: "security", label: "Security model" },
  { id: "refusals", label: "Refusals & proofs" },
  { id: "aevum", label: "Aevum specifics" },
  { id: "limitations", label: "Limitations" },
  { id: "roadmap", label: "Roadmap" },
  { id: "faq", label: "FAQ" },
];

function Code({ children }: { children: string }) {
  return <CodeBlock code={children} />;
}

export default function DocsPage() {
  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Docs</p>
          <h1>Leash, completely</h1>
          <p className="lede">
            Everything on one page: what the contract does, how an agent pays, how to run it yourself,
            and the places where Aevum behaves differently from Ethereum.
          </p>
        </div>
        <a className="btn secondary" href={repoUrl} target="_blank" rel="noreferrer">
          <GitHubIcon />
          View the code on GitHub
        </a>
      </div>

      <div className="docs-quick">
        <a href="#quickstart"><strong>Quickstart</strong><span>Run the desk and CLI locally in five minutes.</span></a>
        <a href="#spendauth"><strong>SpendAuth schema</strong><span>Exactly what the agent signs, field by field.</span></a>
        <a href="#security"><strong>Security model</strong><span>No custody, no admin, named failure modes.</span></a>
      </div>

      <div className="docs">
        <nav className="docs-toc" aria-label="On this page">
          <p className="docs-toc-title">On this page</p>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>{s.label}</a>
          ))}
        </nav>

        <article className="docs-body">
          <section id="what">
            <h2>What Leash is</h2>
            <p>
              Giving an agent a funded wallet means unbounded, unauditable spend. Asking a human to approve every
              payment kills the autonomy the agent exists for. Leash is the bounded middle: an onchain policy that
              caps what an agent may spend, who it may pay, and for how long — enforced by the contract, not by the agent&apos;s good behavior.
            </p>
            <p>
              The buyer approves Leash for exactly the budget. The agent holds a <em>session key</em> — an EOA that
              can only sign <code>SpendAuth</code> messages. Leash verifies the signature and every limit onchain, then
              executes <code>transferFrom(buyer → vendor)</code> against that allowance. The contract never takes custody,
              has no owner, no upgrade path and no pause switch.
            </p>
            <p className="fine">
              Built for the{" "}
              <a href={HACKATHON_URL} target="_blank" rel="noreferrer">Aevum Builder Challenge #1</a> on QDay Aevum testnet.
              Settlement token: <code>{TUSD8_ADDRESS}</code> (tUSD8, 6 decimals).{" "}
              {leashConfigured ? <>Leash is deployed at <code>{LEASH_ADDRESS}</code>.</> : <>This instance has no Leash deployment configured yet.</>}
            </p>
          </section>

          <section id="flow">
            <h2>End-to-end flow</h2>
            <Code>{`leash keygen                      # agent session keypair (file chmod 600)
leash show bundle.json            # what the buyer approved
leash pay --bundle bundle.json \\
    --key agent.key \\
    --vendor 0xVendor --amount 12.50 \\
    --purpose "invoice #1042"     # signs SpendAuth, submits spend()`}</Code>
            <ol>
              <li><strong>Buyer</strong> connects the desk, pastes the agent&apos;s session address, sets per-tx cap, budget, daily cap, allowlist, expiry — approves the exact budget, then <code>createPolicy</code>.</li>
              <li><strong>Buyer</strong> downloads the bundle JSON (no secrets inside) and hands it to the agent operator.</li>
              <li><strong>Agent</strong> signs one EIP-712 <code>SpendAuth</code> per purchase and submits it. Anyone may relay it — only the agent&apos;s signature authorizes movement.</li>
              <li><strong>Contract</strong> checks: policy active, not expired, nonce unused, per-tx cap, remaining budget, daily cap, allowlist — then pulls tUSD8 buyer → vendor and emits <code>Spent</code>.</li>
              <li><strong>Anyone</strong> can audit: <code>/activity</code> lists the events; <code>/receipts/&lt;tx&gt;</code> re-derives them from the receipt; the explorer links every row.</li>
            </ol>
          </section>

          <section id="contract">
            <h2>Contract API</h2>
            <table className="data docs-table wide">
              <thead><tr><th>Function</th><th>Caller</th><th>What it does</th></tr></thead>
              <tbody>
                <tr><td className="mono">createPolicy(agent, perTxCap, budget, dailyCap, expiry, labelHash, allowlist)</td><td>buyer</td><td>Registers a policy; allowlist ≤ 16; emits PolicyCreated</td></tr>
                <tr><td className="mono">spend(auth, v, r, s)</td><td>anyone</td><td>Verifies SpendAuth + all caps; pulls tUSD8 buyer→vendor; emits Spent</td></tr>
                <tr><td className="mono">revoke(policyId)</td><td>buyer</td><td>Kills the session key forever; unspent budget stays the buyer&apos;s</td></tr>
                <tr><td className="mono">setLimits(policyId, perTxCap, budget, dailyCap)</td><td>buyer</td><td>Adjust caps; budget may not drop below spent</td></tr>
                <tr><td className="mono">extend(policyId, expiry)</td><td>buyer</td><td>Push the expiry forward; never shorten it</td></tr>
                <tr><td className="mono">setAllowlist(policyId, allowlist)</td><td>buyer</td><td>Replace the vendor list; empty = any vendor</td></tr>
                <tr><td className="mono">policyOf / remainingBudget / todaySpent / allowlistOf</td><td>view</td><td>State reads for UIs and agents</td></tr>
                <tr><td className="mono">hashSpendAuth(auth)</td><td>view</td><td>The EIP-712 digest — what the agent actually signs</td></tr>
              </tbody>
            </table>
          </section>

          <section id="spendauth">
            <h2>SpendAuth schema</h2>
            <Code>{`SpendAuth(
  uint256 policyId,
  address agent,        // must equal policy.agent
  address vendor,       // the payee
  uint256 amount,       // base units, tUSD8 = 6 decimals
  bytes32 purposeHash,  // keccak256(utf8(purpose)) — text stays offchain
  bytes32 nonce,        // random, single-use per policy
  uint64 expiresAt      // short-lived: minutes, not days
)
// EIP-712 domain: name "Leash", version "1", chainId, verifyingContract`}</Code>
            <p className="fine">The nonce is scoped per policy — the same nonce may be reused across policies, never twice within one.</p>
          </section>

          <section id="quickstart">
            <h2>Quickstart</h2>
            <Code>{`git clone https://github.com/vincentofweb3/leash.git
cd leash && make install        # submodules + pnpm
make check                      # Shanghai check, unit tests, fork tests, typecheck
make anvil                      # local chain, Aevum EVM rules
make deploy-local               # deploy MockUSD8 + Leash
make deal TO=0xYourAddress      # fork only: test balances
pnpm dev                        # http://localhost:3000`}</Code>
            <p>To deploy to the testnet instead, fund a wallet from the faucet first (react ✅ in <code>#verify</code>, then run <code>/faucet &lt;address&gt;</code> in the{" "}
              <a href={DISCORD_URL} target="_blank" rel="noreferrer">QDay Discord</a>, or <a href={links.faucetWeb} target="_blank" rel="noreferrer">faucet.qday.info</a>), then:
            </p>
            <Code>{`cast wallet import aevum-deployer --interactive
make deploy-aevum ACCOUNT=aevum-deployer
# put the address in web/.env.local as NEXT_PUBLIC_LEASH_AEVUM
# and the deploy block as NEXT_PUBLIC_DEPLOY_BLOCK_AEVUM`}</Code>
          </section>

          <section id="integration">
            <h2>Agent integration</h2>
            <Code>{`import { parseUnits } from "viem";
import { leashAbi, spendAuthTypedData, purposeHashOf, randomNonce } from "@leash/kit";

const auth = {
  policyId: 7n,
  agent: account.address,
  vendor: "0xVendor…",
  amount: parseUnits("12.5", 6),
  purposeHash: purposeHashOf("invoice #1042"),
  nonce: randomNonce(),
  expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3600),
} as const;
const signature = await account.signTypedData(spendAuthTypedData(44005, LEASH, auth));
// submit spend(auth, v, r, s) — by the agent, a relayer, anyone`}</Code>
            <p>The CLI does all of this for you, and it fails closed: it reads the policy onchain and refuses to sign when the spend would revert (revoked, expired, over cap, over budget, over daily cap). See <code>leash --help</code>.</p>
          </section>

          <section id="security">
            <h2>Security model</h2>
            <ul>
              <li><strong>No custody.</strong> Leash pulls tUSD8 via your ERC-20 allowance at spend time. Unspent money never enters the contract, and there is no rescue path.</li>
              <li><strong>Kill switch.</strong> <code>revoke()</code> is final per policy; mint a fresh policy for a new session key. Your tUSD8 approve(0) stops even the contract itself.</li>
              <li><strong>Least privilege.</strong> Session keys only sign <code>SpendAuth</code>. They cannot approve, transfer to themselves, or create policies.</li>
              <li><strong>Replay protection.</strong> Per-policy <code>usedNonce</code>. The EIP-712 domain binds chainId and the verifying contract — no cross-chain or cross-contract replay.</li>
              <li><strong>Blast radius.</strong> A stolen session key drains at most <em>per-tx cap per spend and the remaining budget, within the allowlist, until expiry</em>.</li>
              <li><strong>No admin.</strong> No owner, pause, upgrade or fee. The buyer is the only privileged actor, and only over their own policy.</li>
              <li><strong>Prompt injection.</strong> Worst case: a capped, allowlisted, expiring, fully logged payment — still bounded by the policy you signed.</li>
            </ul>
          </section>

          <section id="refusals">
            <h2>Refusals &amp; proofs</h2>
            <p>
              Enforcement is only credible if refusal is legible. The contract never silently no-ops: every rejected
              spend reverts with a named error that the CLI and desk surface, and every accepted spend emits a typed
              <code>Spent</code> event.
            </p>
            <div className="compare-wrap">
              <table className="data">
                <thead>
                  <tr><th>Revert</th><th>What it means</th></tr>
                </thead>
                <tbody>
                  <tr><td className="mono">Revoked</td><td>The buyer killed this policy. Final.</td></tr>
                  <tr><td className="mono">PolicyExpired</td><td>The policy&apos;s expiry passed; no further spends.</td></tr>
                  <tr><td className="mono">SpendExpired</td><td>The signed authorization itself expired (short deadline).</td></tr>
                  <tr><td className="mono">ExceedsPerTxCap</td><td>This single payment is above the per-transaction cap.</td></tr>
                  <tr><td className="mono">ExceedsBudget</td><td>This payment would take total spend past the budget.</td></tr>
                  <tr><td className="mono">ExceedsDailyCap</td><td>This payment would cross today&apos;s rolling cap.</td></tr>
                  <tr><td className="mono">VendorNotAllowed</td><td>The recipient is not on the buyer&apos;s allowlist.</td></tr>
                  <tr><td className="mono">NonceUsed</td><td>Replay: this signed authorization was already spent.</td></tr>
                  <tr><td className="mono">BadSignature</td><td>The signer is not the policy&apos;s agent key.</td></tr>
                  <tr><td className="mono">AllowanceTooSmall</td><td>The buyer&apos;s tUSD8 approval is below the amount.</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              <strong>Machine-readable proof.</strong> <a href="/proof.json" target="_blank" rel="noreferrer">/proof.json</a> is a
              live, CORS-open JSON document: contract, head, policies, exact settled total, every <code>Spent</code> event and
              the steps to re-derive them. Each receipt page also offers a signed-by-chain <strong>Proof JSON</strong> download
              at <code>/api/proof?tx=&lt;hash&gt;</code>.
            </p>
            <p className="fine">
              Reverted transactions cannot be replayed as receipts — they leave no <code>Spent</code> event, which is exactly
              the point. The depth of a refusal is <code>eth_call</code> away: simulate the same spend and read the revert.
            </p>
          </section>

          <section id="aevum">
            <h2>Aevum specifics</h2>
            <ul>
              <li><strong>Shanghai EVM.</strong> Compile with <code>evm_version = &quot;shanghai&quot;</code>. Cancun bytecode deploys then dies on <code>MCOPY</code>; <code>make build</code> runs a Shanghai-opcode check that fails CI.</li>
              <li><strong>1,000-block log limit.</strong> <code>eth_getLogs</code> rejects larger ranges. The desk reads full history from the public explorer API and falls back to <code>getLogsChunked</code> from <code>@aevum-kit/aevum</code> on RPC.</li>
              <li><strong>No WebSocket.</strong> Poll over HTTPS; viem does this by default.</li>
              <li><strong>Legacy (type 0) transactions</strong> are what QDay&apos;s own tooling sends; the app and CLI use them too.</li>
              <li><strong>Explorer verification isn&apos;t available yet</strong> — this repo, the commit hash and the deploy block are the evidence. Link them in submissions.</li>
              <li><strong>Gas is ~1 gwei</strong> in tQDAY (18 decimals). 1 tQDAY covers hundreds of contract calls.</li>
            </ul>
          </section>

          <section id="limitations">
            <h2>Limitations</h2>
            <ul>
              <li>Not audited. Do not point this at real money.</li>
              <li>The allowance grant is to the contract, and the contract is the enforcement point — approving it for a budget you cannot stomach losing is the buyer&apos;s call.</li>
              <li>Purpose text stays offchain; <code>purposeHash</code> is public.</li>
              <li>tUSD8 is centrally issued; a blocklist entry can stall a payment or the whole batch.</li>
              <li>Expiry is checked at spend time; a policy with a distant expiry spends until it hits its budget or expiry, whichever first.</li>
              <li>Frontend reads events from a public RPC; a reorged or lagging RPC can briefly show stale state.</li>
            </ul>
          </section>

          <section id="roadmap">
            <h2>Roadmap</h2>
            <ol>
              <li><strong>ERC-4337 smart accounts (Kernel v3.1)</strong> — Aevum already runs a Kernel v3.1 fork and ERC-4337 bundlers (rundler, alto); session keys as Kernel validators remove the standalone session EOA entirely, and give gasless agent spends via a paymaster (<a href="https://github.com/qday-io/kernel" target="_blank" rel="noreferrer">qday-io/kernel</a>, <a href="https://github.com/qday-io/qday-bundler" target="_blank" rel="noreferrer">qday-io/qday-bundler</a>).</li>
              <li><strong>Human-escalation queue</strong> — over-cap requests pause for buyer approval instead of reverting, reusing the desk.</li>
              <li><strong>EIP-3009 gasless merchant payouts</strong> — the vendor receives tUSD8 without the buyer holding tQDAY.</li>
              <li><strong>Purpose allowlists</strong> — restrict not only <em>where</em> the agent pays, but <em>what for</em>.</li>
            </ol>
          </section>

          <section id="faq">
            <h2>FAQ</h2>
            <p><strong>Does the buyer need tQDAY?</strong> Yes, for approve/create/revoke transactions. The agent pays gas for <code>spend</code> calls (~1 gwei each).</p>
            <p><strong>Can the agent pay itself?</strong> Only if the agent address is on the allowlist, for up to the remaining budget, before expiry — which the buyer chose.</p>
            <p><strong>What if the RPC is down?</strong> The CLI refuses to sign blind; the desk shows stale-state errors instead of failing silently.</p>
            <p><strong>How do I verify a payment?</strong> <code>/receipts/&lt;txHash&gt;</code> re-reads the receipt and lists the Spent events — or check the explorer directly.</p>
            <p><strong>Where do I get tUSD8?</strong> Discord <code>/faucet</code> (react ✅ in <code>#verify</code> first) or <a href={links.faucetWeb} target="_blank" rel="noreferrer">faucet.qday.info</a>.</p>
          </section>
        </article>
      </div>
    </main>
  );
}
