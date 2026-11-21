export default function Loading() {
  return (
    <main className="shell" aria-busy="true" aria-live="polite">
      <div className="stack" style={{ gap: 12 }}>
        <div className="skeleton" style={{ width: 120, height: 14 }} />
        <div className="skeleton" style={{ width: "46%", height: 46 }} />
        <div className="skeleton" style={{ width: "62%", height: 18 }} />
      </div>
      <div className="grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card" style={{ height: 96 }}>
            <div className="skeleton" style={{ width: "55%", height: 12 }} />
            <div className="skeleton" style={{ width: "75%", height: 26, marginTop: 12 }} />
          </div>
        ))}
      </div>
      <div className="card" style={{ height: 260 }}>
        <div className="skeleton" style={{ width: "100%", height: "100%" }} />
      </div>
      <span className="fine">Loading…</span>
    </main>
  );
}
