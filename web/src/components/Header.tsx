"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { networks, repoUrl } from "@/lib/env";
import { GitHubIcon } from "./Icons";
import { LogoMark } from "./Logo";
import { useNetwork } from "@/lib/network";

const links = [
  { href: "/", label: "Overview" },
  { href: "/new", label: "New policy" },
  { href: "/activity", label: "Activity" },
  { href: "/receipts", label: "Receipts" },
  { href: "/docs", label: "Docs" },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected, chainId } = useAccount();
  const { net, select, switchingTo, switchError } = useNetwork();
  const wrongNetwork = isConnected && chainId !== net.chain.id && !switchingTo;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="topbar">
        <div className="shell">
          <Link href="/" className="brand" aria-label="Leash home">
            <LogoMark />
            <span className="brand-name">Leash</span>
            <span className="brand-beta">testnet</span>
          </Link>
          <nav className="nav" aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="topbar-end">
            <a className="icon-link" href={repoUrl} target="_blank" rel="noreferrer" title="Source code on GitHub">
              <GitHubIcon size={17} />
              <span className="gh-text">GitHub</span>
            </a>
            {networks.length > 1 && (
              <div className="net-switch" role="radiogroup" aria-label="Network">
                {networks.map((n) => (
                  <button
                    key={n.key}
                    type="button"
                    role="radio"
                    aria-checked={n.key === net.key}
                    disabled={Boolean(switchingTo)}
                    title={`${n.chain.name} · chain ${n.chain.id}`}
                    onClick={() => select(n.key)}
                  >
                    <span className={`net-dot ${n.key}`} aria-hidden="true" />
                    {n.label}
                  </button>
                ))}
              </div>
            )}
            <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
            <button
              type="button"
              className="mobile-toggle"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
      </header>
      <div id="mobile-nav" className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        <nav className="shell" aria-label="Mobile">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
          <a href={repoUrl} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
      {switchingTo && (
        <div className="banner info" role="status">
          <div className="shell">
            <span>
              Confirm the switch to <strong>{switchingTo.chain.name}</strong> in your wallet. If no window opened, click the wallet icon in your
              browser toolbar.
            </span>
          </div>
        </div>
      )}
      {switchError && !switchingTo && (
        <div className="banner" role="alert">
          <div className="shell">
            <span>{switchError}</span>
          </div>
        </div>
      )}
      {wrongNetwork && (
        <div className="banner" role="alert">
          <div className="shell">
            <span>
              Your wallet is on another network. This app is set to <strong>{net.chain.name} ({net.chain.id})</strong>.
            </span>
            <button type="button" className="btn warn small" onClick={() => select(net.key)}>
              Switch network
            </button>
          </div>
        </div>
      )}
    </>
  );
}
