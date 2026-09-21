import Link from "next/link";
import { Logo } from "@/components/logo";
import { SavedCount } from "@/components/saved-count";
import { LinkButton } from "@/components/ui/button";

const nav = [
  { href: "/jobs", label: "Find jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/salaries", label: "Salaries" },
];

const navLinkClass =
  "relative text-[13px] text-muted transition-colors hover:text-fg after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-accent-fg after:transition-transform after:duration-300 hover:after:scale-x-100";

export function SiteHeader() {
  return (
    <header className="border-line bg-bg/70 supports-[backdrop-filter]:bg-bg/55 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-auto hidden items-center gap-6 sm:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={navLinkClass}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:ml-2">
          <SavedCount />
          <LinkButton href="/employers/post" size="sm">
            Post a role
          </LinkButton>
        </div>
      </div>
      <nav aria-label="Main mobile" className="border-line flex gap-5 overflow-x-auto border-t px-4 py-2 sm:hidden">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="text-muted hover:text-fg shrink-0 text-[13px]">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
