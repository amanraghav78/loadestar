# Lodestar

Tech job board for India (“Your Next Job Awaits.”): thousands of engineering, design, product and data roles at MNCs and startups, pulled from companies' own careers pages, with published salaries shown first (in ₹ LPA). There are no candidate accounts: people browse, save roles in their browser, and **Apply** sends them to the employer's own careers page.

## Where the listings come from

`lib/ingest` reads each company's **public careers-site API**: the same listings you see on their careers page. No scraping of other job sites (LinkedIn, Naukri, …), and no aggregator reposts.

| Source | Used by (examples) | Token (`Company.atsToken`) |
|---|---|---|
| Workday | NVIDIA, Walmart, Citi, Cisco, Adobe, Mastercard, Genpact (~130 companies) | `host\|tenant\|site` |
| Amazon Jobs | Amazon | `IND` |
| Eightfold | Microsoft, Qualcomm, Vodafone, BMS | `host\|domain` |
| Oracle Recruiting | Oracle, JPMorgan Chase | `host\|siteNumber\|indiaLocationId` |
| SmartRecruiters | Bosch, Swiggy, LinkedIn, ServiceNow, Freshworks | company identifier |
| Greenhouse / Lever / Ashby | Stripe, Razorpay, CRED, Meesho, Snowflake, Sarvam | board slug |

A company with several career sites lists all its tokens separated by spaces. The starting list (~230 companies) is `lib/ingest/companies.ts`; add more from `/admin/companies/new`. `npm run ingest:preview -- <slug>` dry-runs a feed without touching the database.

1. **Fetch** recent postings (`sources.ts`). Search-style APIs are filtered to India server-side and paged newest first.
2. **Filter** to roles posted in the **last 30 days**, located in India or explicitly "Remote – India", in scope disciplines only (no sales/HR/finance or non-software engineering) (`normalize.ts`, `classify.ts`).
3. **Salary**: kept only when stated in INR per year (structured pay field, or parsed from text like "CTC ₹25–35 LPA"). A US/EU band on a multi-country posting is never shown on the Indian role. Otherwise the listing says "Salary not disclosed".
4. **Sync** (`sync.ts`): upsert by source ID, fetch descriptions only for new roles, take down roles that vanished from the careers site, and **delete every role 30+ days old**. A failing feed never wipes existing listings.

Each sync run handles the least recently synced companies that fit in ~200 s (a serverless function has 300 s). Vercel Cron calls `/api/cron/sync` eight times a day so every company is refreshed daily; **/admin/companies → Sync all feeds now** runs one batch on demand.

### Company logos

`npm run logos` saves a 112×112 WebP tile for each company in `lib/ingest/companies.ts` to `public/logos/` (about 1 KB each, 250 KB for all of them) and lists them in `lib/company-logos.json`. It reads the icons the company's own site declares, with Google's favicon service and the company's GitHub organisation as fallbacks. Logos are committed and served as static files: nothing is stored in the database or fetched at request time. A logo URL set in `/admin` takes precedence; companies with neither show their initial. A unit test fails if any tile passes 8 KB or the folder passes 600 KB.

## Stack

| Concern | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript strict |
| Styling | Tailwind CSS v4, dark slate + violet theme tokens (from the design) in `app/globals.css` |
| Database | Postgres on Neon, Prisma 7 with the `pg` driver adapter |
| Search | `pg_trgm` GIN index on a denormalised `searchText` column |
| Rate limiting | Upstash Redis (optional locally; fails open if Redis is down) |
| Caching | `'use cache'` + `cacheTag` on every read; admin writes and the cron call `revalidateTag` |
| Jobs | Vercel Cron → `/api/cron/sync` (8× a day) and `/api/cron/expire` (daily) |
| Observability | Sentry (enabled when a DSN is set), Vercel Analytics + Speed Insights |
| Tests | Vitest (unit), Playwright (e2e), GitHub Actions CI |

## How it fits together

```
Browser ──► Vercel edge cache ──► Next.js (static shells + streamed dynamic parts)
                                     │  'use cache' (tagged: jobs, companies, job:<slug>)
                                     ▼
                              Prisma ─► Neon Postgres (pooled)
/apply/:id ─► rate limit (Upstash) ─► log ApplyClick (after response) ─► 302 to employer
/admin/*   ─► proxy.ts Basic Auth ─► server actions (re-check auth) ─► revalidateTag
Vercel Cron ─► /api/cron/sync + /api/cron/expire (Bearer CRON_SECRET) ─► upsert / delete 30+ day roles ─► revalidateTag
```

- **Home, companies, salaries** are prerendered and refreshed hourly, or immediately after an admin edit.
- **Job and company pages** serve a static shell instantly. Content is cached per slug after the first visit.
- **Search** (`/jobs?…`) renders per query. Results are indexed and cached briefly.
- **Saved roles** live in `localStorage` (`lib/saved-jobs.ts`); `/api/jobs?ids=` hydrates them.
- **Expiry:** a role that disappears from the careers site (or isn't confirmed for 7 days) is marked `EXPIRED`: its page stays up with a notice and no Apply button. Every role is **deleted** once it is 30 days old (`lib/listing-age.ts`).

Sized for 10k+ users: nearly all traffic hits cached output, the few uncached queries are indexed, and each serverless instance holds a small pool (5) against Neon's pooler.

## Local development

Requires **Node 22+**. No Docker needed: `db:local` runs Postgres (PGlite) in-process.

```bash
npm install
cp .env.example .env     # then set DATABASE_URL to the local one below
npm run db:local         # terminal 1: postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable
npm run db:migrate && npm run db:sync   # pulls real listings into your local DB
npm run dev              # http://localhost:3000, admin at /admin
```

You can point `DATABASE_URL` at a Neon branch instead of running `db:local`.

| Script | Does |
|---|---|
| `npm run lint` / `typecheck` / `test` | ESLint, `tsc`, Vitest |
| `npm run test:e2e` | Playwright against `next start` on :3100 (needs `npm run build` + seeded DB) |
| `npm run db:migrate:dev` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:sync [-- slug]` | Sync job-board feeds into `DATABASE_URL` (all companies, or one) |
| `npm run ingest:preview` | Dry run: fetch + parse every feed, print what would be listed. No DB |
| `npm run db:seed:test` | Fictional **test fixtures** for e2e/CI only; never run against production |

## Candidate accounts

Optional, and off until configured: with no `BETTER_AUTH_SECRET` / `GOOGLE_CLIENT_*`, sign-in is hidden and the site behaves exactly as it did before. Signed in, a candidate gets a profile, one resume, saved roles that follow them across devices, and a list of roles they opened.

Lodestar never submits an application: listings come from employers' own careers sites, so "applied" means *you opened the employer's page*. The resume is the candidate's own copy, never sent anywhere.

**Setup**

1. Google Cloud Console → **Credentials** → **OAuth client ID** → *Web application*. Authorised redirect URIs: `http://localhost:3000/api/auth/callback/google` and `https://<site>/api/auth/callback/google`. Copy the id and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
2. `BETTER_AUTH_SECRET` — `openssl rand -base64 32`.
3. Cloudflare R2 → create a **private** bucket → an API token with object read/write. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. Without them, upload is off in production; locally and in tests an in-process store stands in.

**How it holds together**

- `lib/queries.ts` (the shared, cached job data) knows nothing about users, and `tests/unit/cache-isolation.test.ts` fails if that ever changes. Session reads live in `lib/session.ts` behind `use cache: private`, which never reaches a server cache; per-user reads in `lib/account-queries.ts` are uncached and resolve the user themselves.
- Resumes: PDF only, 4 MB, checked by magic bytes rather than the file's name or declared type. Stored under an unguessable key, downloaded only through `/api/resume`, which takes no id and serves the caller their own file.
- Deleting an account removes the file first, then the row; everything else cascades. What survives is the anonymous apply-click count.
- Google's consent screen can't be automated, so the e2e suite signs in through `app/api/test/sign-in/route.ts`, which 404s unless `E2E_TEST_AUTH=1` **and** `VERCEL_ENV` isn't `production`. Never set that variable on the live site.

Running the e2e suite locally needs `BETTER_AUTH_SECRET`, dummy `GOOGLE_CLIENT_*`, `E2E_TEST_AUTH=1` and `DB_POOL_MAX=1` (PGlite prefers a single connection), then `npm run db:seed:test && npm run build && npm run test:e2e`.

## Deploying to Vercel

1. Create a Neon project. Copy the **pooled** URL to `DATABASE_URL` and the **direct** URL to `DIRECT_URL`.
2. Create an Upstash Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Set `ADMIN_USER`, `ADMIN_PASS` (long and random), `CRON_SECRET` (`openssl rand -hex 32`), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_POST_ROLE_FORM_URL` and `NEXT_PUBLIC_CONTACT_EMAIL`. Optionally set the Sentry variables, and the account variables above to switch sign-in on.
4. Import the repo in Vercel. The `vercel-build` script runs `prisma migrate deploy` before `next build`, and `vercel.json` registers the daily cron.
5. After the first deploy, trigger the first sync: `curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/sync` (then it runs daily).

## Adding listings

The `/admin` area is protected by HTTP Basic Auth (`proxy.ts`), and each server action re-checks the credentials. It lets you:

- create, edit, take down or delete roles and companies;
- mark a role **Still open**, which resets its 30-day expiry clock;
- see apply-click counts per role;
- import up to 500 roles from a CSV. The import is all-or-nothing, and each invalid row is reported.

## Known trade-offs

- **Soft 404s.** With Cache Components, dynamic routes stream a static shell first, so a missing job returns HTTP 200 with the not-found UI and `noindex`. A hard 404 would need a database lookup in `proxy.ts` on every job view.
- **CSP.** The policy allows `'unsafe-inline'` scripts because Next's bootstrap scripts are inline. Nonces would force every page to render dynamically.
- **Legal copy.** Pricing, privacy and editorial copy are starting drafts. Have them reviewed before launch.
