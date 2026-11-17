"use client";

import type { PolicyBundle } from "@leash/kit";

const KEY = (chainId: number, policyId: string) => `leash:policy:${chainId}:${policyId}`;
const INDEX = (chainId: number) => `leash:policy-index:${chainId}`;

export function saveBundle(chainId: number, bundle: PolicyBundle) {
  try {
    localStorage.setItem(KEY(chainId, bundle.policyId), JSON.stringify(bundle));
    const idx = listPolicyIds(chainId);
    if (!idx.includes(bundle.policyId)) {
      localStorage.setItem(INDEX(chainId), JSON.stringify([...idx, bundle.policyId]));
    }
  } catch {
    // Storage unavailable (private mode). The bundle is also handed to the user as a download.
  }
}

export function loadBundle(chainId: number, policyId: string): PolicyBundle | null {
  try {
    const raw = localStorage.getItem(KEY(chainId, policyId));
    return raw ? (JSON.parse(raw) as PolicyBundle) : null;
  } catch {
    return null;
  }
}

export function listPolicyIds(chainId: number): string[] {
  try {
    const raw = localStorage.getItem(INDEX(chainId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
