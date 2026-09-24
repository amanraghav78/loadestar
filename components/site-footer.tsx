import Link from "next/link";
import { cacheLife } from "next/cache";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { site } from "@/lib/site";

const links = [
  { href: "/jobs", label: "Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/salaries", label: "Salaries" },
  { href: "/saved", label: "Saved" },
  { href: "/employers/post", label: "Post a job" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export async function SiteFooter() {
  "use cache";
  cacheLife("days");

  return (
    <footer className="border-line mt-24 border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo />
          <p className="text-muted mt-3 text-sm">{site.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {links.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-muted hover:text-fg text-sm transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-line border-t">
        <p className="text-subtle mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-5 text-xs sm:px-6">
          <ShieldCheck className="size-3.5" aria-hidden />
          {site.promise}
          <span className="ml-auto">© {new Date().getFullYear()} Lodestar</span>
        </p>
      </div>
    </footer>
  );
}
