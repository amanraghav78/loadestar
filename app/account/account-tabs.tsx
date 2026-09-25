import Link from "next/link";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/account", label: "Profile" },
  { href: "/account/matches", label: "Matches" },
  { href: "/account/applications", label: "Applied" },
  { href: "/account/resume", label: "Resume builder" },
] as const;

export type AccountTab = (typeof TABS)[number]["href"];

/**
 * The account's sections, as tabs along the top of each of its pages. Each
 * page passes its own path, so this needs no client code.
 */
export function AccountTabs({ current }: { current: AccountTab }) {
  return (
    <nav
      aria-label="Account"
      className="border-line -mx-4 mb-10 flex scrollbar-none gap-6 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
    >
      {TABS.map((tab) => {
        const active = tab.href === current;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 py-3 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "border-fg text-fg" : "text-muted hover:text-fg border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
