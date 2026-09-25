import { Check } from "lucide-react";
import { companyLogo } from "@/lib/logos";

type SourceCompany = { name: string; slug: string; logoUrl: string | null };

/**
 * Three things Lodestar does differently, each with a small moving picture of
 * it. The pictures are decoration (hidden from assistive tech); the words say it.
 */
export function WhyLodestar({ companies }: { companies: SourceCompany[] }) {
  return (
    <ul className="grid gap-3 md:grid-cols-3">
      <Tile
        title="Straight from the source"
        text="Every job comes from the company's own careers site. No reposts from other job boards."
      >
        <SourceArt companies={companies.slice(0, 3)} />
      </Tile>
      <Tile
        title="No spam jobs"
        text="Every listing is a real, open role at the company hiring. Recruiter posts are checked by a person before they go live."
      >
        <SpamArt />
      </Tile>
      <Tile title="Always fresh" text="Listings refresh eight times a day, and nothing stays past 30 days.">
        <FreshArt />
      </Tile>
    </ul>
  );
}

function Tile({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <li className="flex">
      <div className="metal-card flex flex-1 flex-col rounded-3xl p-6">
        <div className="why-art" aria-hidden>
          {children}
        </div>
        <h3 className="text-fg mt-5 text-[15px] font-semibold">{title}</h3>
        <p className="text-muted mt-1.5 text-sm leading-relaxed">{text}</p>
      </div>
    </li>
  );
}

/** Three company tiles, each feeding a line of light into Lodestar. */
function SourceArt({ companies }: { companies: SourceCompany[] }) {
  const rows = [22, 60, 98];
  return (
    <svg viewBox="0 0 260 120" className="h-full w-full">
      <defs>
        {rows.map((y, i) => (
          <clipPath key={i} id={`why-tile-${i}`}>
            <rect x="12" y={y - 15} width="30" height="30" rx="8" />
          </clipPath>
        ))}
      </defs>
      {rows.map((y, i) => (
        <path key={i} d={`M46 ${y} C 118 ${y}, 146 60, 208 60`} className="why-wire" />
      ))}
      {rows.map((y, i) => (
        <path
          key={i}
          d={`M46 ${y} C 118 ${y}, 146 60, 208 60`}
          pathLength={100}
          className="why-flow"
          style={{ animationDelay: `${i * -0.7}s` }}
        />
      ))}
      {rows.map((y, i) => {
        const company = companies[i];
        const logo = company ? companyLogo(company) : null;
        return (
          <g key={i}>
            <rect x="12" y={y - 15} width="30" height="30" rx="8" className="why-tile" />
            {logo ? (
              <image href={logo} x="12" y={y - 15} width="30" height="30" clipPath={`url(#why-tile-${i})`} />
            ) : (
              <text x="27" y={y + 5} textAnchor="middle" className="why-initial">
                {company?.name.charAt(0) ?? "•"}
              </text>
            )}
          </g>
        );
      })}
      <circle cx="218" cy="60" r="20" className="why-node-glow" />
      <circle cx="218" cy="60" r="10" className="why-node-ring" />
      <circle cx="218" cy="60" r="5" className="why-node" />
    </svg>
  );
}

/**
 * A light scans down three listings: the real ones get a check, the spam one is
 * flagged, struck through and dropped. One 4.8s loop drives every part of it.
 */
function SpamArt() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="spam-list">
        {["ok", "spam", "ok"].map((kind, i) => (
          <div key={i} className="spam-row" data-kind={kind}>
            <span className="spam-logo" />
            <span className="spam-lines">
              <span />
              <span />
            </span>
            {kind === "spam" ? (
              <>
                <span className="spam-flag">Spam</span>
                <span className="spam-strike" />
              </>
            ) : (
              <Check className="spam-ok" style={{ animationDelay: i === 0 ? "0s" : "1.3s" }} strokeWidth={3} />
            )}
          </div>
        ))}
        <span className="spam-scan" />
      </div>
    </div>
  );
}

/** A 30-day dial that keeps winding: the window every listing lives in. */
function FreshArt() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative size-28">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r="42" className="why-dial-track" />
          <circle cx="50" cy="50" r="42" pathLength="100" className="why-dial" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="steel-text text-2xl leading-none font-semibold tabular-nums">30</span>
          <span className="text-subtle mt-1 text-[10px] tracking-[0.18em] uppercase">days</span>
        </div>
      </div>
    </div>
  );
}
