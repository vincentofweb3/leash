"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function VerifyForm({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const tx = value.trim().toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(tx)) {
      setError("That is not a 32-byte transaction hash (0x + 64 hex characters).");
      return;
    }
    setError(null);
    router.push(`/receipts/${tx}`);
  }

  return (
    <form className="verify-form" onSubmit={submit} noValidate>
      <input
        className="input mono"
        name="tx"
        placeholder="0x transaction hash"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        aria-label="Transaction hash"
        aria-invalid={Boolean(error)}
      />
      <button className="btn" type="submit">Verify receipt</button>
      {error ? <span className="fine" style={{ color: "var(--bad)", width: "100%" }}>{error}</span> : null}
    </form>
  );
}
