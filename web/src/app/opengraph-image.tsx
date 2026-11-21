import { ImageResponse } from "next/og";

export const alt = "Leash — scoped spend allowances for AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#05070b",
          backgroundImage: "linear-gradient(135deg, rgba(46,107,255,0.22) 0%, rgba(95,240,255,0.05) 45%, rgba(255,179,125,0.08) 100%)",
          padding: "64px 72px",
          color: "#f5f7fb",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundImage: "linear-gradient(135deg, #5FF0FF 0%, #2E6BFF 52%, #FFB37D 100%)",
                color: "#ffffff",
                fontSize: 30,
                fontWeight: 700,
                paddingBottom: 4,
              }}
            >
              L
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>Leash</div>
              <div style={{ fontSize: 15, color: "#8d95a6", letterSpacing: 2 }}>AGENT SPEND POLICY</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid rgba(66,221,161,0.35)",
              background: "rgba(66,221,161,0.1)",
              color: "#42dda1",
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 18,
            }}
          >
            <div style={{ width: 9, height: 9, borderRadius: 999, background: "#42dda1" }} />
            Live on QDay Aevum testnet
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 660 }}>
            <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5 }}>Your agent pays.</div>
            <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5, color: "#8fb4ff" }}>
              Only what you allow.
            </div>
            <div style={{ marginTop: 24, fontSize: 25, lineHeight: 1.4, color: "#8d95a6" }}>
              Onchain per-transaction caps, budgets and vendor allowlists for AI agents. Revoke the session key in one
              transaction.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 360,
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(12,15,22,0.92)",
              padding: 24,
              gap: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 17, color: "#c4cad7" }}>Policy #0 · active</div>
              <div style={{ display: "flex", width: 10, height: 10, borderRadius: 999, background: "#42dda1" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 15, color: "#8d95a6" }}>Budget remaining</div>
              <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1.5 }}>0.50 tUSD8</div>
            </div>
            <div style={{ display: "flex", width: "100%", height: 10, borderRadius: 999, background: "#171c29" }}>
              <div style={{ display: "flex", width: "50%", height: 10, borderRadius: 999, backgroundImage: "linear-gradient(90deg, #2E6BFF, #5FF0FF)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "#5d6577" }}>
              <div>per-tx cap 1.00</div>
              <div>total 1.00</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {["Non-custodial", "No admin keys", "1-tx revoke", "tUSD8 · 6 decimals"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 999,
                  padding: "8px 16px",
                  fontSize: 17,
                  color: "#c4cad7",
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 18, color: "#5d6577" }}>leash-kohl.vercel.app</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
