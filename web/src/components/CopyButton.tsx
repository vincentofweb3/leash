"use client";

import { useState } from "react";
import { CheckIcon } from "./Icons";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button type="button" className={`copy-btn ${copied ? "copied" : ""}`} onClick={() => void copy()} aria-live="polite">
      {copied ? <CheckIcon /> : null}
      {copied ? "Copied" : label}
    </button>
  );
}
