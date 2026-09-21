import Link from "next/link";
import { cacheLife } from "next/cache";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Candidates",
    links: [
      { href: "/jobs", label: "Browse jobs" },
      { href: "/salaries", label: "Salary data" },
      { href: "/companies", label: "Company profiles" },
      { href: "/saved", label: "Saved roles" },
    ],
  },
  {
    title: "Employers",
    links: [
      { href: "/employers/post", label: "Post a role" },
      { href: "/employers/pricing", label: "Pricing" },
      { href: "/employers/verification", label: "Verification policy" },
      { href: "/contact", label: "Contact sales" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/editorial-standards", label: "Editorial standards" },
      { href: "/privacy", label: "Privacy" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export async function SiteFooter() {
  "use cache";
  cacheLife("days");

  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{site.tagline}</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-[11px] font-medium tracking-[0.12em] text-subtle uppercase">{col.title}</h2>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted transition-colors hover:text-fg">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-subtle sm:px-6">
          © {new Date().getFullYear()} Lodestar Labs. Every listing posted in the last 30 days.
        </p>
      </div>
    </footer>
  );
}
