# Lodestar

Tech job board for India: engineering, design, product and data roles pulled daily from companies' own careers pages, with published salaries shown first (in ₹ LPA). There are no candidate accounts: people browse, save roles in their browser, and **Apply** sends them to the employer's own careers page.

## Where the listings come from

`lib/ingest` reads each company's **public job-board feed** (Greenhouse, Lever or Ashby: the same data behind their careers page). No scraping of other job sites.

1. **Fetch** every posting (`lib/ingest/sources.ts`).
2. **Filter** to roles located in India or explicitly "Remote – India" (`classify.ts`), in scope disciplines only (no sales/HR/finance).
3. **Salary**: kept only when stated in INR per year (structured pay field, or parsed from text like "CTC ₹25–35 LPA"). A US/EU band on a multi-country posting is never shown on the Indian role. Otherwise the listing says "Salary not disclosed".
4. **Sync** (`sync.ts`): upsert by feed ID, rewrite only changed rows, and take down roles that vanished from the feed. A failing feed never wipes existing listings.

Runs daily at 08:00 IST via Vercel Cron (`/api/cron/sync`), or on demand from **/admin/companies → Sync all feeds now**. Add companies from `/admin/companies/new` (choose the feed type and board token). Starting list: `lib/ingest/companies.ts`.

## Stack

| Concern | Choice |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript strict |
| Styling | Tailwind CSS v4, dark slate + violet theme tokens (from the design) in `app/globals.css` |
| Database | Postgres on Neon, Prisma 7 with the `pg` driver adapter |
| Search | `pg_trgm` GIN index on a denormalised `searchText` column |
| Rate limiting | Upstash Redis (optional locally; fails open if Redis is down) |
| Caching | `'use cache'` + `cacheTag` on every read; admin writes and the cron call `revalidateTag` |
| Jobs | Vercel Cron → `/api/cron/expire` daily |
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
Vercel Cron ─► /api/cron/expire (Bearer CRON_SECRET) ─► mark stale roles EXPIRED ─► revalidateTag
```

- **Home, companies, salaries** are prerendered and refreshed hourly, or immediately after an admin edit.
- **Job and company pages** serve a static shell instantly. Content is cached per slug after the first visit.
- **Search** (`/jobs?…`) renders per query. Results are indexed and cached briefly.
- **Saved roles** live in `localStorage` (`lib/saved-jobs.ts`); `/api/jobs?ids=` hydrates them.
- **Expiry:** a role not re-confirmed within 30 days is marked `EXPIRED`. Its page stays up with a notice and no Apply button.

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

## Deploying to Vercel

1. Create a Neon project. Copy the **pooled** URL to `DATABASE_URL` and the **direct** URL to `DIRECT_URL`.
2. Create an Upstash Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Set `ADMIN_USER`, `ADMIN_PASS` (long and random), `CRON_SECRET` (`openssl rand -hex 32`), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_POST_ROLE_FORM_URL` and `NEXT_PUBLIC_CONTACT_EMAIL`. Optionally set the Sentry variables.
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
