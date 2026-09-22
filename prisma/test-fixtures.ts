/**
 * TEST FIXTURES ONLY: fictional companies and roles used by the Playwright
 * suite and CI. Never run this against production; real listings come from
 * `npm run db:sync`.
 *
 *   npm run db:seed:test            # refuses to run in production
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import type { Currency, Discipline, Level, RemotePolicy } from "../lib/generated/prisma/enums";
import { buildSearchText, slugify } from "../lib/format";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

const companies = [
  {
    slug: "arclight",
    name: "Arclight",
    hq: "Berlin, Germany",
    size: "201–500",
    website: "https://arclight.example.com",
    medianResponseDays: 4,
    featured: true,
    description:
      "Arclight builds real-time observability for energy grids, ingesting billions of sensor readings a day for utilities across Europe.",
  },
  {
    slug: "quillon",
    name: "Quillon",
    hq: "London, UK",
    size: "51–200",
    website: "https://quillon.example.com",
    medianResponseDays: 6,
    featured: true,
    description: "Quillon is payments infrastructure for B2B marketplaces: payouts, compliance and reconciliation in one API.",
  },
  {
    slug: "northbound",
    name: "Northbound",
    hq: "Minneapolis, MN",
    size: "51–200",
    website: "https://northbound.example.com",
    medianResponseDays: 5,
    featured: true,
    description: "Northbound makes offline-first field software for logistics crews who work where the signal doesn't.",
  },
  {
    slug: "vellum",
    name: "Vellum",
    hq: "Utrecht, Netherlands",
    size: "11–50",
    website: "https://vellum.example.com",
    medianResponseDays: 3,
    featured: true,
    description: "Vellum is a document platform for public-sector teams, built accessible first.",
  },
  {
    slug: "halcyon",
    name: "Halcyon",
    hq: "Lisbon, Portugal",
    size: "201–500",
    website: "https://halcyon.example.com",
    medianResponseDays: 8,
    featured: true,
    description: "Halcyon runs the data platform behind independent clinics' scheduling, billing and patient records.",
  },
  {
    slug: "ostrom",
    name: "Ostrom",
    hq: "Copenhagen, Denmark",
    size: "501–1000",
    website: "https://ostrom.example.com",
    medianResponseDays: 7,
    featured: true,
    description: "Ostrom builds security tooling for platform teams: secrets, policy and supply-chain integrity.",
  },
] as const;

type SeedJob = {
  company: (typeof companies)[number]["slug"];
  title: string;
  discipline: Discipline;
  level: Level;
  tags: string[];
  location: string;
  remote: RemotePolicy;
  remoteRegion?: string;
  salaryMin: number;
  salaryMax: number;
  currency: Currency;
  postedDaysAgo: number;
  featured?: boolean;
};

// The six roles from the mockup.
const mockupJobs: SeedJob[] = [
  { company: "arclight", title: "Senior Backend Engineer, Ingest", discipline: "ENGINEERING", level: "SENIOR", tags: ["Go", "Kafka", "Distributed systems"], location: "Berlin", remote: "ONSITE", salaryMin: 95_000, salaryMax: 125_000, currency: "EUR", postedDaysAgo: 2, featured: true },
  { company: "quillon", title: "Product Designer, Payouts", discipline: "DESIGN", level: "SENIOR", tags: ["Figma", "Fintech", "Research"], location: "London", remote: "REMOTE", remoteRegion: "EMEA", salaryMin: 72_000, salaryMax: 88_000, currency: "GBP", postedDaysAgo: 4, featured: true },
  { company: "arclight", title: "Staff Platform Engineer", discipline: "INFRASTRUCTURE", level: "STAFF", tags: ["Kubernetes", "Terraform", "Platform"], location: "Berlin", remote: "REMOTE", remoteRegion: "Europe", salaryMin: 130_000, salaryMax: 165_000, currency: "EUR", postedDaysAgo: 7, featured: true },
  { company: "northbound", title: "Frontend Engineer", discipline: "ENGINEERING", level: "MID", tags: ["React", "TypeScript", "Offline-first"], location: "Minneapolis, MN", remote: "ONSITE", salaryMin: 110_000, salaryMax: 140_000, currency: "USD", postedDaysAgo: 3, featured: true },
  { company: "vellum", title: "Accessibility Engineer", discipline: "ENGINEERING", level: "SENIOR", tags: ["WCAG", "ARIA", "Testing"], location: "Utrecht", remote: "HYBRID", salaryMin: 78_000, salaryMax: 96_000, currency: "EUR", postedDaysAgo: 5, featured: true },
  { company: "quillon", title: "Product Manager, Compliance", discipline: "PRODUCT", level: "SENIOR", tags: ["Regulation", "B2B", "Roadmapping"], location: "London", remote: "HYBRID", salaryMin: 95_000, salaryMax: 118_000, currency: "GBP", postedDaysAgo: 7, featured: true },
];

// Generated roles so filters, pagination and the salary table have data.
const templates: Array<Omit<SeedJob, "company" | "postedDaysAgo" | "location" | "remote" | "currency" | "salaryMin" | "salaryMax"> & { base: number }> = [
  { title: "Backend Engineer", discipline: "ENGINEERING", level: "MID", tags: ["Go", "PostgreSQL", "APIs"], base: 75_000 },
  { title: "Senior Backend Engineer", discipline: "ENGINEERING", level: "SENIOR", tags: ["Rust", "Distributed systems", "gRPC"], base: 95_000 },
  { title: "Staff Software Engineer", discipline: "ENGINEERING", level: "STAFF", tags: ["Architecture", "Go", "Mentoring"], base: 130_000 },
  { title: "Senior Frontend Engineer", discipline: "ENGINEERING", level: "SENIOR", tags: ["React", "TypeScript", "Design systems"], base: 90_000 },
  { title: "Mobile Engineer", discipline: "ENGINEERING", level: "MID", tags: ["Swift", "Kotlin", "Offline-first"], base: 80_000 },
  { title: "Product Designer", discipline: "DESIGN", level: "MID", tags: ["Figma", "Prototyping", "Research"], base: 65_000 },
  { title: "Senior Product Designer", discipline: "DESIGN", level: "SENIOR", tags: ["Design systems", "Figma", "B2B"], base: 82_000 },
  { title: "Product Manager", discipline: "PRODUCT", level: "MID", tags: ["Discovery", "B2B", "Analytics"], base: 80_000 },
  { title: "Senior Product Manager", discipline: "PRODUCT", level: "SENIOR", tags: ["Roadmapping", "Fintech", "Strategy"], base: 100_000 },
  { title: "Data Engineer", discipline: "DATA", level: "MID", tags: ["dbt", "Airflow", "SQL"], base: 78_000 },
  { title: "Senior Data Scientist", discipline: "DATA", level: "SENIOR", tags: ["Python", "Forecasting", "Experimentation"], base: 95_000 },
  { title: "Security Engineer", discipline: "SECURITY", level: "SENIOR", tags: ["AppSec", "Threat modeling", "Go"], base: 100_000 },
  { title: "Site Reliability Engineer", discipline: "INFRASTRUCTURE", level: "SENIOR", tags: ["Kubernetes", "Observability", "Terraform"], base: 98_000 },
  { title: "Platform Engineer", discipline: "INFRASTRUCTURE", level: "MID", tags: ["AWS", "Terraform", "Platform"], base: 82_000 },
];

const places: Record<(typeof companies)[number]["slug"], { location: string; currency: Currency; mult: number }> = {
  arclight: { location: "Berlin", currency: "EUR", mult: 1 },
  quillon: { location: "London", currency: "GBP", mult: 0.9 },
  northbound: { location: "Minneapolis, MN", currency: "USD", mult: 1.35 },
  vellum: { location: "Utrecht", currency: "EUR", mult: 0.92 },
  halcyon: { location: "Lisbon", currency: "EUR", mult: 0.75 },
  ostrom: { location: "Copenhagen", currency: "EUR", mult: 1.05 },
};

const remotes: Array<{ remote: RemotePolicy; region?: string }> = [
  { remote: "ONSITE" },
  { remote: "HYBRID" },
  { remote: "REMOTE", region: "Europe" },
  { remote: "REMOTE", region: "EMEA" },
];

function generatedJobs(): SeedJob[] {
  const out: SeedJob[] = [];
  let i = 0;
  for (const c of companies) {
    for (const t of templates) {
      i++;
      if (i % 3 === 0) continue; // not every company hires for every role
      const place = places[c.slug];
      const r = remotes[i % remotes.length]!;
      const min = Math.round((t.base * place.mult * (0.95 + (i % 5) * 0.03)) / 1000) * 1000;
      out.push({
        company: c.slug,
        title: t.title,
        discipline: t.discipline,
        level: t.level,
        tags: t.tags,
        location: place.location,
        remote: r.remote,
        remoteRegion: r.region,
        currency: place.currency,
        salaryMin: min,
        salaryMax: Math.round((min * 1.25) / 1000) * 1000,
        postedDaysAgo: 1 + ((i * 7) % 26),
      });
    }
  }
  return out;
}

function description(job: SeedJob, companyName: string) {
  return [
    `${companyName} is hiring a ${job.title} to join a small team with real ownership. You'll work closely with product, design and engineering from discovery through to production.`,
    "## What you'll do",
    [
      `- Own meaningful parts of our ${job.tags[0]} stack end to end`,
      "- Ship in small increments and measure what changes for customers",
      "- Review, pair and write things down so the team gets faster",
    ].join("\n"),
    "## What we're looking for",
    [
      `- Solid experience with ${job.tags.slice(0, 2).join(" and ")}`,
      "- Clear written communication; we're a writing-first team",
      "- Comfort with ambiguity and a bias to ship",
    ].join("\n"),
    "## Process",
    "A 30-minute intro call, a paid take-home or pairing session (your choice), and a final conversation with the team. We reply to every application.",
  ].join("\n\n");
}

async function main() {
  const force = process.argv.includes("--force");
  if (process.env.NODE_ENV === "production" && !force) {
    throw new Error("Refusing to seed in production. Pass --force if you really mean it.");
  }

  // Children before parents. Cascades would cover most of this, but spelling it
  // out keeps the order obvious when a table is added.
  await db.jobApplication.deleteMany();
  await db.savedJob.deleteMany();
  await db.candidateProfile.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verification.deleteMany();
  await db.user.deleteMany();
  await db.applyClick.deleteMany();
  await db.job.deleteMany();
  await db.company.deleteMany();

  const created = new Map<string, { id: string; name: string }>();
  for (const c of companies) {
    const row = await db.company.create({ data: c, select: { id: true, name: true } });
    created.set(c.slug, row);
  }

  const all = [...mockupJobs, ...generatedJobs()];
  await db.job.createMany({
    data: all.map((job, n) => {
      const company = created.get(job.company)!;
      return {
        slug: `${slugify(`${job.title} ${company.name}`)}-${n.toString(36).padStart(4, "0")}`,
        title: job.title,
        description: description(job, company.name),
        companyId: company.id,
        discipline: job.discipline,
        level: job.level,
        tags: job.tags,
        location: job.location,
        remote: job.remote,
        remoteRegion: job.remoteRegion ?? null,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        currency: job.currency,
        applyUrl: `https://forms.gle/example-${job.company}`,
        featured: job.featured ?? false,
        searchText: buildSearchText({ ...job, companyName: company.name }),
        postedAt: daysAgo(job.postedDaysAgo),
        salaryDisclosed: true,
        lastVerifiedAt: daysAgo(Math.min(job.postedDaysAgo, 6)),
      };
    }),
  });

  console.log(`Seeded ${companies.length} companies and ${all.length} jobs.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
