import Link from "next/link";
import { cacheLife } from "next/cache";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { postJobHref } from "@/lib/auth";
import { site } from "@/lib/site";

const groups = [
  {
    title: "Find work",
    links: [
      { href: "/jobs", label: "Jobs" },
      { href: "/companies", label: "Companies" },
      { href: "/salaries", label: "Salaries" },
      { href: "/saved", label: "Saved jobs" },
    ],
  },
  {
    title: "Employers",
    links: [
      { href: postJobHref, label: "Post a job" },
      { href: "/employers/pricing", label: "Pricing" },
      { href: "/employers/verification", label: "Verification" },
    ],
  },
  {
    title: "Lodestar",
    links: [
      { href: "/about", label: "About" },
      { href: "/editorial-standards", label: "Editorial standards" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export async function SiteFooter() {
  "use cache";
  cacheLife("days");

  return (
    <footer className="border-line mt-24 border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-x-6 gap-y-10 px-4 py-12 sm:px-6 md:grid-cols-[1.6fr_4fr]">
        <div>
          <Logo />
          <p className="text-muted mt-3 max-w-xs text-sm">{site.tagline}</p>
        </div>
        {/* One landmark for the whole footer; the columns are headed lists inside it. */}
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="text-subtle text-[11px] font-medium tracking-[0.14em] uppercase">{group.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-muted hover:text-fg text-sm transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-line border-t">
        <p className="text-subtle mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-5 text-xs sm:px-6">
          <ShieldCheck className="size-3.5" aria-hidden />
          {site.promise}
          <span className="ml-auto">© {new Date().getFullYear()} Lodestar</span>
        </p>
      </div>
    </footer>
  );
}
