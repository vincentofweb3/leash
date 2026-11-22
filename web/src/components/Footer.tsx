import Link from "next/link";
import { links } from "@aevum-kit/aevum";
import { LEASH_ADDRESS } from "@leash/kit";
import { repoUrl } from "@/lib/env";
import { short } from "@/lib/format";
import { LogoMark } from "./Logo";

const HACKATHON_URL = "https://dorahacks.io/hackathon/qday/detail";

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand" aria-label="Leash home">
              <LogoMark />
              <span className="brand-name">Leash</span>
            </Link>
            <p>
              The spend-allowance layer for AI agents. Per-transaction caps, budgets and vendor allowlists
              enforced onchain — revoke a session key in one transaction.
            </p>
            <span className="pill">
              <span className="dot pulse" aria-hidden="true" />
              Live on QDay Aevum testnet
            </span>
          </div>
          <div className="footer-col">
            <h3>Product</h3>
            <ul>
              <li><Link href="/new">Create an allowance</Link></li>
              <li><Link href="/activity">Activity</Link></li>
              <li><Link href="/receipts">Receipt verifier</Link></li>
              <li><Link href="/docs">Documentation</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h3>Resources</h3>
            <ul>
              <li><a href={repoUrl} target="_blank" rel="noreferrer">GitHub repository</a></li>
              <li><a href="/proof.json" target="_blank" rel="noreferrer">Machine-readable proof</a></li>
              <li><a href={`${links.explorer}/address/${LEASH_ADDRESS}`} target="_blank" rel="noreferrer">Contract on explorer</a></li>
              <li><a href={`${links.explorer}/address/0x456569838f1d43009A91ebA4263147Afd7233483`} target="_blank" rel="noreferrer">tUSD8 token</a></li>
              <li><a href={links.docs} target="_blank" rel="noreferrer">QDay docs</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h3>Network</h3>
            <ul>
              <li><a href={links.faucetWeb} target="_blank" rel="noreferrer">Faucet</a></li>
              <li><a href="https://discord.gg/bYPhjmrSfK" target="_blank" rel="noreferrer">QDay Discord</a></li>
              <li><a href={links.explorer} target="_blank" rel="noreferrer">Aevum explorer</a></li>
              <li><a href={HACKATHON_URL} target="_blank" rel="noreferrer">Aevum Builder Challenge #1</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Leash · MIT licensed · Built for Aevum Builder Challenge #1</span>
          <div className="row" style={{ gap: 16 }}>
            <span className="footer-status">
              <span className="dot" aria-hidden="true" />
              Chain 44005
            </span>
            <a className="mono" href={`${links.explorer}/address/${LEASH_ADDRESS}`} target="_blank" rel="noreferrer" title={LEASH_ADDRESS}>
              {short(LEASH_ADDRESS, 8, 6)}
            </a>
            <span title="This is testnet software and has not been audited.">Testnet · unaudited</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
