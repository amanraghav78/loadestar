import Link from "next/link";
import { Logo } from "@/components/logo";
import { SavedCount } from "@/components/saved-count";
import { LinkButton } from "@/components/ui/button";

const nav = [
  { href: "/jobs", label: "Find jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/salaries", label: "Salaries" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-auto hidden items-center gap-5 sm:flex">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="text-[13px] text-muted transition-colors hover:text-fg">
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
      <nav aria-label="Main mobile" className="flex gap-5 overflow-x-auto border-t border-line px-4 py-2 sm:hidden">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="shrink-0 text-[13px] text-muted hover:text-fg">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
