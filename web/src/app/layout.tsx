import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { siteUrl } from "@/lib/env";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-inter-tight", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

const description =
  "Leash is the spend-allowance layer for AI agents. Set per-transaction caps, a budget and a vendor allowlist onchain, hand your agent a session key, and revoke it in one transaction. Live on QDay Aevum testnet with tUSD8.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Leash — scoped spend allowances for AI agents", template: "%s · Leash" },
  description,
  applicationName: "Leash",
  keywords: [
    "AI agents",
    "agentic payments",
    "spend policy",
    "session keys",
    "QDay",
    "Aevum",
    "tUSD8",
    "stablecoin",
    "smart contract",
  ],
  openGraph: {
    type: "website",
    siteName: "Leash",
    title: "Leash — your agent pays. Only what you allow.",
    description,
    url: siteUrl,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Leash — your agent pays. Only what you allow.",
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05070b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${jetbrains.variable}`}>
      <body>
        <Providers>
          <Header />
          <div id="main-content">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
