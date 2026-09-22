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
  { href: "/contact", label: "Contact" },
];

export async function SiteFooter() {
  "use cache";
  cacheLife("days");

  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted">{site.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-3">
            {links.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-sm text-muted transition-colors hover:text-fg">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-5 text-xs text-subtle sm:px-6">
          <ShieldCheck className="size-3.5" aria-hidden />
          {site.promise}
          <span className="ml-auto">© {new Date().getFullYear()} Lodestar</span>
        </p>
      </div>
    </footer>
  );
}
