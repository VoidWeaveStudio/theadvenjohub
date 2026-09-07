// app/f/[slug]/opengraph-image.tsx
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { accentHue, getPublicFaction } from "@/core/lib/factionPublic";

export const runtime = "nodejs";
export const revalidate = 300;
export const alt = "TANJO World faction";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_TIMEOUT_MS = 2500;

function compactUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

async function inlineLogo(url: string | null): Promise<string | null> {
  if (!url || !/^https:\/\//.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGO_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    if (!type.startsWith("image/") || type.includes("svg")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 2_000_000) return null;
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const faction = await getPublicFaction(slug);

  if (!faction) notFound();

  const hue = accentHue(faction.slug);
  const accent = `hsl(${hue}, 88%, 62%)`;
  const logo = await inlineLogo(faction.image);
  const ticker = faction.symbol ? `$${faction.symbol}` : faction.name;
  const seatsLine = faction.promo.code
    ? `FREE ACCESS FOR ${ticker} HOLDERS · ${faction.promo.seatsLeft} SEATS LEFT`
    : `FACTION #${faction.number} · TANJO WORLD`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#161618",
          color: "#f0f0f5",
          padding: 64,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -140,
            width: 620,
            height: 620,
            borderRadius: 620,
            background: accent,
            opacity: 0.22,
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {logo ? (
            <img
              src={logo}
              width={168}
              height={168}
              style={{ borderRadius: 168, border: `5px solid ${accent}`, objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 168,
                height: 168,
                borderRadius: 168,
                border: `5px solid ${accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 60,
                fontWeight: 800,
                color: accent,
                background: "#1e1e21",
              }}
            >
              {(faction.symbol || faction.name).slice(0, 2).toUpperCase()}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 800 }}>
            <div style={{ fontSize: 26, letterSpacing: 6, color: accent, fontWeight: 700 }}>
              FACTION #{faction.number}
            </div>
            <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, marginTop: 6 }}>
              {faction.name.slice(0, 28)}
            </div>
            <div style={{ fontSize: 38, color: "#a0a0ab", marginTop: 4 }}>{ticker}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {[
            { label: "MARKET CAP", value: compactUsd(faction.market.marketCapUsd) },
            { label: "MEMBERS", value: String(faction.memberCount) },
            { label: "LEVEL", value: String(faction.level) },
            { label: "RANK", value: faction.rank !== null ? `#${faction.rank}` : "—" },
          ].map((cell) => (
            <div
              key={cell.label}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid #323236",
                borderRadius: 18,
                padding: "18px 28px",
                minWidth: 210,
              }}
            >
              <div style={{ fontSize: 20, letterSpacing: 3, color: "#6e6e78" }}>{cell.label}</div>
              <div style={{ fontSize: 42, fontWeight: 800, marginTop: 4 }}>{cell.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              background: accent,
              color: "#111",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 2,
              padding: "16px 30px",
              borderRadius: 14,
            }}
          >
            {seatsLine}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#8b8f98", letterSpacing: 4 }}>TANJO WORLD</div>
        </div>
      </div>
    ),
    size
  );
}
