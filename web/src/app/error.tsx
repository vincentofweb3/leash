"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[leash] page error", error);
  }, [error]);

  return (
    <main className="shell">
      <div className="empty" style={{ paddingTop: 80 }}>
        <span className="badge bad">Something broke</span>
        <h1 style={{ fontSize: "clamp(28px, 4.5vw, 42px)", marginTop: 10 }}>The page hit an error.</h1>
        <p className="lede" style={{ textWrap: "balance" }}>
          This is a client-side failure, not a chain failure. Nothing was signed and no policy changed. Try again, or go
          back to the overview.
        </p>
        {error.digest ? <p className="fine mono">digest {error.digest}</p> : null}
        <div className="row" style={{ gap: 10, marginTop: 18, justifyContent: "center" }}>
          <button type="button" className="btn" onClick={() => reset()}>Try again</button>
          <Link href="/" className="btn secondary">Back to overview</Link>
        </div>
      </div>
    </main>
  );
}
