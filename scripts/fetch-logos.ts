/**
 * Fetches a small square logo for each company in the bootstrap list into
 * public/logos/<slug>.webp (112×112, a few KB each) and records which
 * companies have one in lib/company-logos.json. Nothing is stored in the
 * database, and nothing is fetched at request time.
 *
 * Sources, best first: an override below, the app icons the company's own
 * homepage declares (apple-touch-icon, web manifest), SVG and sized icons,
 * /apple-touch-icon.png, Google's favicon service, and last the company's
 * GitHub organisation avatar. Icons smaller than MIN_SOURCE_PX are ignored,
 * so a company without a sharp icon keeps its initial instead of a blurry logo.
 *
 *   npm run logos                 # companies without a logo yet
 *   npm run logos -- --force      # refetch every logo
 *   npm run logos -- adobe okta   # just these (always refetched)
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import zlib from "node:zlib";
import sharp, { type Sharp } from "sharp";
import { BOOTSTRAP_COMPANIES } from "@/lib/ingest/companies";

/** 2× the largest avatar (56px), and the smallest logo Google accepts in JobPosting data. */
const SIZE = 112;
const MIN_SOURCE_PX = 48;
const MAX_BYTES = 2_000_000;
const OUT_DIR = path.join(process.cwd(), "public", "logos");
const MANIFEST = path.join(process.cwd(), "lib", "company-logos.json");
const UA = "Mozilla/5.0 (compatible; LodestarBot/1.0; +https://loadestar.vercel.app/about)";

/** Icon URLs to use instead of what the site declares, where that is wrong or missing. */
const OVERRIDES: Record<string, string> = {
  // The site's own icon is the wordmark cropped edge to edge; github.com/HewlettPackard links to hpe.com.
  hpe: "https://avatars.githubusercontent.com/u/6004705?v=4&s=256",
};

type Kind = "override" | "app" | "icon" | "fallback";
type Candidate = { url: string; kind: Kind };
type Icon = Candidate & { input: Buffer; px: number; svg: boolean };
type Response = { url: string; status: number; body: Buffer };

function get(url: string, headers: Record<string, string> = {}, redirects = 0): Promise<Response> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/json,image/*,*/*;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en",
          ...headers,
        },
        timeout: 15_000,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location && redirects < 5) {
          res.resume();
          get(new URL(res.headers.location, url).toString(), headers, redirects + 1).then(resolve, reject);
          return;
        }
        const encoding = res.headers["content-encoding"];
        const stream =
          encoding === "gzip"
            ? res.pipe(zlib.createGunzip())
            : encoding === "deflate"
              ? res.pipe(zlib.createInflate())
              : encoding === "br"
                ? res.pipe(zlib.createBrotliDecompress())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) req.destroy(new Error("Response too large"));
          else chunks.push(c);
        });
        stream.on("end", () => resolve({ url, status, body: Buffer.concat(chunks) }));
        stream.on("error", reject);
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("Timed out")));
    req.on("error", reject);
  });
}

function attr(tag: string, name: string) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : null;
}

const absolute = (href: string, base: string) => new URL(href.replace(/&amp;/g, "&"), base).toString();

/** Every icon the homepage points at, plus the conventional locations and a fallback. */
async function candidates(slug: string, website: string): Promise<Candidate[]> {
  const list: Candidate[] = OVERRIDES[slug] ? [{ url: OVERRIDES[slug], kind: "override" }] : [];
  let base = website;
  try {
    const page = await get(website);
    if (page.status < 400) {
      base = page.url;
      const html = page.body.toString("utf8");
      for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
        const rel = attr(tag, "rel")?.toLowerCase() ?? "";
        const href = attr(tag, "href");
        if (!href || href.startsWith("data:")) continue;
        if (/(^|\s)manifest(\s|$)/.test(rel)) list.push(...(await manifestIcons(absolute(href, base))));
        else if (/(^|\s)apple-touch-icon(-precomposed)?(\s|$)/.test(rel)) list.push({ url: absolute(href, base), kind: "app" });
        else if (/(^|\s)icon(\s|$)/.test(rel)) list.push({ url: absolute(href, base), kind: "icon" });
      }
    }
  } catch {
    // Unreachable or blocked homepage: the conventional locations below still apply.
  }
  const origin = new URL(base).origin;
  list.push({ url: `${origin}/apple-touch-icon.png`, kind: "app" });
  list.push({ url: `${origin}/favicon.ico`, kind: "icon" });
  list.push({
    url: `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(origin)}&size=256`,
    kind: "fallback",
  });
  return list.filter((c, i) => list.findIndex((o) => o.url === c.url) === i);
}

async function manifestIcons(url: string): Promise<Candidate[]> {
  try {
    const res = await get(url);
    if (res.status !== 200) return [];
    const icons = (JSON.parse(res.body.toString("utf8")) as { icons?: { src?: string; purpose?: string }[] }).icons ?? [];
    return icons
      .filter((i) => i.src && !/monochrome/.test(i.purpose ?? ""))
      .map((i) => ({ url: absolute(i.src!, url), kind: "app" as const }));
  } catch {
    return [];
  }
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isIco = (buf: Buffer) => buf.length > 6 && buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1;

/** The largest PNG image inside a .ico file (older bitmap entries are too small to use anyway). */
function pngFromIco(buf: Buffer) {
  let best: Buffer | null = null;
  let bestWidth = 0;
  for (let i = 0; i < buf.readUInt16LE(4); i++) {
    const entry = 6 + i * 16;
    if (entry + 16 > buf.length) break;
    const width = buf[entry] || 256;
    const data = buf.subarray(buf.readUInt32LE(entry + 12), buf.readUInt32LE(entry + 12) + buf.readUInt32LE(entry + 8));
    if (width > bestWidth && data.subarray(0, 8).equals(PNG_SIGNATURE)) [best, bestWidth] = [data, width];
  }
  return best;
}

async function load(candidate: Candidate): Promise<Icon | null> {
  try {
    const res = await get(candidate.url);
    if (res.status !== 200 || res.body.length < 64) return null;
    const input = isIco(res.body) ? pngFromIco(res.body) : res.body;
    if (!input) return null;
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height || !["png", "jpeg", "webp", "gif", "svg", "avif"].includes(meta.format ?? "")) return null;
    const svg = meta.format === "svg";
    const px = Math.min(meta.width, meta.height);
    // Wide wordmarks turn into a sliver in a square tile.
    if (Math.max(meta.width, meta.height) / px > 1.6) return null;
    if (!svg && px < MIN_SOURCE_PX) return null;
    return { ...candidate, input, px, svg };
  } catch {
    return null;
  }
}

/** Overrides, then app icons (drawn for tiles), then vector, then the largest bitmap. */
function rank(icon: Icon) {
  const tier = icon.kind === "override" ? 4 : icon.kind === "app" && icon.px >= 120 ? 3 : icon.svg ? 2 : 1;
  return tier * 100_000 + (icon.svg ? 0 : icon.px);
}

/**
 * Renders the icon as an opaque SIZE×SIZE tile. App-style icons fill the
 * tile; bare glyphs are trimmed and centred on white, or on graphite when the
 * glyph itself is light (a white mark would vanish on white).
 */
async function tile(icon: Icon) {
  const density = icon.svg ? Math.min(2400, Math.ceil((72 * SIZE * 2) / icon.px)) : undefined;
  const source = () => sharp(icon.input, { density, animated: false }).ensureAlpha();

  const { data, info } = await source()
    .resize(SIZE * 2, SIZE * 2, { fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let opaque = 0;
  let luminance = 0;
  let visible = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! > 240) opaque++;
    if (data[i + 3]! > 128) {
      luminance += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
      visible++;
    }
  }
  if (visible === 0) throw new Error("Blank image");

  let out: Sharp;
  if (opaque / (info.width * info.height) > 0.85) {
    // Fill with the icon's own edge colour (covers rounded, transparent corners).
    const top = Math.floor(info.width / 2) * 4;
    const background = data[top + 3]! > 128 ? { r: data[top]!, g: data[top + 1]!, b: data[top + 2]! } : "#ffffff";
    out = source().flatten({ background }).resize(SIZE, SIZE, { fit: "contain", background });
  } else {
    const background = luminance / visible > 190 ? "#1d1d22" : "#ffffff";
    const inner = Math.round(SIZE * 0.68);
    const glyph = await sharp(await source().trim().png().toBuffer())
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    out = sharp({ create: { width: SIZE, height: SIZE, channels: 4, background } })
      .composite([{ input: glyph, gravity: "center" }])
      .flatten({ background });
  }
  const png = await out.png().toBuffer();
  const [lossy, lossless] = await Promise.all([
    sharp(png).webp({ quality: 82, effort: 6 }).toBuffer(),
    sharp(png).webp({ lossless: true, effort: 6 }).toBuffer(),
  ]);
  return lossy.length <= lossless.length ? lossy : lossless;
}

const SUFFIXES = new Set(["com", "co", "in", "org", "net", "io", "ai", "jobs", "tech", "uk", "jp", "club", "app", "dev", "us"]);

/** "opensource.salesforce.com" → "salesforce", "www.boeing.co.in" → "boeing". */
function brand(host: string) {
  const labels = host.toLowerCase().replace(/^www\./, "").split(".");
  while (labels.length > 1 && SUFFIXES.has(labels.at(-1)!)) labels.pop();
  return labels.at(-1)!;
}

function hostOf(url: string) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
}

// Unauthenticated, the GitHub API allows 60 requests an hour; set GITHUB_TOKEN for more.
let githubLimited = false;

/**
 * Last resort for sites that only publish a 16–32px favicon: the company's
 * GitHub organisation avatar, used only when that organisation's own website
 * link is on the company's domain (so a look-alike account never matches).
 */
async function githubAvatar(slug: string, website: string): Promise<Candidate[]> {
  const label = brand(new URL(website).hostname);
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  for (const org of new Set([label, slug.replace(/-/g, "")])) {
    if (githubLimited) return [];
    try {
      const res = await get(`https://api.github.com/orgs/${encodeURIComponent(org)}`, headers);
      if (res.status === 403 || res.status === 429) {
        githubLimited = true;
        console.warn("  GitHub rate limit reached; set GITHUB_TOKEN and rerun for the rest.");
        return [];
      }
      if (res.status !== 200) continue;
      const found = JSON.parse(res.body.toString("utf8")) as { blog?: string; avatar_url?: string };
      const blog = found.blog ? hostOf(found.blog) : null;
      if (blog && brand(blog) === label && found.avatar_url) {
        return [{ url: `${found.avatar_url}${found.avatar_url.includes("?") ? "&" : "?"}s=256`, kind: "fallback" }];
      }
    } catch {
      // Try the next name.
    }
  }
  return [];
}

async function best(candidates: Candidate[]) {
  const loaded = await Promise.all(candidates.map(load));
  const icons = loaded.filter((i): i is Icon => i !== null).sort((a, b) => rank(b) - rank(a));
  for (const icon of icons) {
    try {
      return { icon, webp: await tile(icon) };
    } catch {
      // Undecodable or blank: try the next best.
    }
  }
  return null;
}

async function logoFor(slug: string, website: string) {
  return (await best(await candidates(slug, website))) ?? (await best(await githubAvatar(slug, website)));
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}

async function writeManifest() {
  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith(".webp")).sort();
  const slugs = files.map((f) => f.slice(0, -".webp".length));
  await writeFile(MANIFEST, `${JSON.stringify({ slugs }, null, 2)}\n`);
  let bytes = 0;
  for (const f of files) bytes += (await stat(path.join(OUT_DIR, f))).size;
  return { count: files.length, bytes };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.filter((a) => !a.startsWith("--"));
  await mkdir(OUT_DIR, { recursive: true });
  const existing = new Set(await readdir(OUT_DIR));

  const todo = BOOTSTRAP_COMPANIES.filter((c) =>
    only.length ? only.includes(c.slug) : force || !existing.has(`${c.slug}.webp`),
  );
  const missed: string[] = [];
  await mapLimit(todo, 8, async (c) => {
    const logo = await logoFor(c.slug, c.website);
    if (!logo) {
      missed.push(c.slug);
      console.log(`  ✗ ${c.slug}`);
      return;
    }
    const file = path.join(OUT_DIR, `${c.slug}.webp`);
    const previous = existing.has(`${c.slug}.webp`) ? await readFile(file) : null;
    if (!previous?.equals(logo.webp)) await writeFile(file, logo.webp);
    console.log(`  ✓ ${c.slug.padEnd(28)} ${String(logo.webp.length).padStart(5)} B  ${logo.icon.kind} ${logo.icon.svg ? "svg" : `${logo.icon.px}px`}  ${logo.icon.url}`);
  });

  const { count, bytes } = await writeManifest();
  console.log(`\n${count} logos, ${(bytes / 1024).toFixed(0)} KB in public/logos`);
  if (missed.length) console.log(`No usable icon: ${missed.sort().join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
