import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell">
      <div className="empty" style={{ paddingTop: 80 }}>
        <span className="badge">404</span>
        <h1 style={{ fontSize: "clamp(30px, 5vw, 46px)", marginTop: 10 }}>This page slipped its leash.</h1>
        <p className="lede" style={{ textWrap: "balance" }}>
          The URL does not exist on this deployment. The desk, the activity feed and the receipt verifier are still here.
        </p>
        <div className="row" style={{ gap: 10, marginTop: 18, justifyContent: "center" }}>
          <Link href="/" className="btn">Back to overview</Link>
          <Link href="/new" className="btn secondary">Create a policy</Link>
          <Link href="/receipts" className="btn ghost">Verify a receipt</Link>
        </div>
      </div>
    </main>
  );
}
