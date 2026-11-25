import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leash - scoped spend allowances for AI agents",
    short_name: "Leash",
    description:
      "Onchain spend policies for AI agents: per-transaction caps, budgets, vendor allowlists and one-transaction revoke.",
    start_url: "/",
    display: "standalone",
    background_color: "#05070b",
    theme_color: "#05070b",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
