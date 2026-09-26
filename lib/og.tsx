import { ImageResponse } from "next/og";
import type { CompanyOgContent, JobOgContent } from "@/lib/og-data";
import { site } from "@/lib/site";

/**
 * Share images, drawn for Satori (next/og): flexbox and a subset of CSS only.
 * They follow the dark theme in app/globals.css: the near-black canvas, steel
 * text and the violet accent, in Geist (the Regular cut next/og ships with,
 * so nothing is fetched at build or request time).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const SITE_OG_ALT = `${site.name}: ${site.tagline} ${site.promise}`;

const C = {
  bg: "#060608",
  fg: "#f5f5f7",
  muted: "#a1a1aa",
  subtle: "#8a8a94",
  steel: "#16161b",
  line: "rgba(255, 255, 255, 0.12)",
  accent: "#c4bcff",
};

/** Mirrors --steel-text-fill; background-clip: text is one of the few effects Satori supports. */
const steelText = {
  backgroundImage: "linear-gradient(180deg, #ffffff 10%, #b8b8c1 100%)",
  backgroundClip: "text",
  color: "transparent",
} as const;

/** Job and company images change when a listing does; the site image is fixed per deploy. */
const DATA_CACHE = { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" };

const host = new URL(site.url).host;

/** components/logo.tsx's LogoMark, at any size. */
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#d4d4d8" />
          <stop offset="1" stopColor="#8e8e98" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="23" height="23" rx="7" fill="#15151a" stroke="rgba(255,255,255,0.16)" />
      <path
        d="M12 3.5c.5 4.3 2.2 6 6.5 6.5-4.3.5-6 2.2-6.5 6.5-.5-4.3-2.2-6-6.5-6.5 4.3-.5 6-2.2 6.5-6.5Z"
        transform="translate(0 2)"
        fill="url(#chrome)"
      />
      <circle cx="18" cy="6" r="1.1" fill={C.accent} />
    </svg>
  );
}

const layer = { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex" } as const;

/**
 * The canvas: near-black, lit softly from above like the home page hero, then the
 * wordmark and the site's host, the content, and a footer row under a hairline.
 */
function Frame({
  children,
  footer,
  aside,
}: {
  children: React.ReactNode;
  /** Pills at the bottom left. */
  footer: React.ReactNode;
  /** A quiet line at the bottom right. */
  aside?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: C.bg,
        color: C.fg,
        fontFamily: "geist",
      }}
    >
      {/* Light falling from the top edge, as on the home page hero. */}
      <div style={{ ...layer, backgroundImage: "linear-gradient(180deg, #15151b 0%, #0b0b0f 38%, #060608 72%)" }} />
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", padding: "56px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Mark size={56} />
            <span style={{ fontSize: 36, letterSpacing: -0.8 }}>{site.name}</span>
          </div>
          <span style={{ fontSize: 24, color: C.subtle }}>{host}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>{children}</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${C.line}`,
            paddingTop: 28,
          }}
        >
          <div style={{ display: "flex", gap: 14 }}>{footer}</div>
          {aside && <span style={{ fontSize: 24, color: C.subtle }}>{aside}</span>}
        </div>
      </div>
    </div>
  );
}

function Pill({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        fontSize: 28,
        padding: "10px 22px",
        borderRadius: 999,
        border: `1px solid ${accent ? "rgba(196,188,255,0.4)" : C.line}`,
        backgroundColor: accent ? "rgba(139,124,246,0.16)" : C.steel,
        color: accent ? "#e6e2ff" : C.fg,
      }}
    >
      {children}
    </span>
  );
}

/** A company's initial on a steel tile (Satori cannot read the WebP logo tiles). */
function Initial({ letter, size }: { letter: string; size: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: C.steel,
        border: `1px solid ${C.line}`,
        fontSize: size * 0.48,
      }}
    >
      <span style={steelText}>{letter}</span>
    </div>
  );
}

/** Steel headline text that wraps; the size is picked in lib/og-data.ts from its length. */
function Headline({ text, size, maxWidth = 1056 }: { text: string; size: number; maxWidth?: number }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: size,
        letterSpacing: -size * 0.03,
        lineHeight: 1.08,
        paddingBottom: 8,
        maxWidth,
      }}
    >
      <span style={steelText}>{text}</span>
    </div>
  );
}

export function siteImage() {
  return new ImageResponse(
    <Frame
      footer={["Engineering", "Data", "Product", "Design"].map((d) => (
        <Pill key={d}>{d}</Pill>
      ))}
      aside="Tech jobs across India"
    >
      <Headline text={site.tagline} size={112} />
      <div style={{ display: "flex", marginTop: 16, fontSize: 40, color: C.muted, letterSpacing: -0.6 }}>
        {site.promise}
      </div>
    </Frame>,
    { ...OG_SIZE },
  );
}

export function jobImage(job: JobOgContent) {
  return new ImageResponse(
    <Frame
      footer={[
        job.salary && (
          <Pill key="pay" accent>
            {job.salary}
          </Pill>
        ),
        <Pill key="where">{job.location}</Pill>,
      ]}
      // The promise only when the pills leave room for it (Satori can't measure, so count characters).
      aside={(job.salary ?? "").length + job.location.length <= 34 ? site.promise : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Initial letter={job.company.charAt(0).toUpperCase()} size={60} />
        <span style={{ fontSize: 34, color: C.muted }}>{job.company}</span>
        {!job.open && (
          <span
            style={{
              fontSize: 22,
              color: C.muted,
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${C.line}`,
            }}
          >
            No longer open
          </span>
        )}
      </div>
      <div style={{ display: "flex", marginTop: 28 }}>
        <Headline text={job.title} size={job.titleSize} />
      </div>
    </Frame>,
    { ...OG_SIZE, headers: DATA_CACHE },
  );
}

export function companyImage(company: CompanyOgContent) {
  return new ImageResponse(
    <Frame footer={<Pill accent>{company.roles}</Pill>} aside={site.promise}>
      <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
        <Initial letter={company.initial} size={128} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <span style={{ fontSize: 30, color: C.muted }}>Jobs at</span>
          <Headline text={company.name} size={company.nameSize} maxWidth={892} />
        </div>
      </div>
    </Frame>,
    { ...OG_SIZE, headers: DATA_CACHE },
  );
}
