import type { NextConfig } from "next";

const config: NextConfig = {
  // The shared config package ships TypeScript source.
  transpilePackages: ["@aevum-kit/aevum"],
  async rewrites() {
    // Stable machine-readable proof URL for judges and agents.
    return [{ source: "/proof.json", destination: "/api/proof" }];
  },
};

export default config;
