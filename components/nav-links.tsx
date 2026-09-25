"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; /** Said instead on phones, where the row is tight. */ short?: string };

export const NAV: NavItem[] = [
  { href: "/jobs", label: "Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/salaries", label: "Salaries" },
];

/** Only offered when accounts are on: the builder lives in the account. Signed-out visitors are sent to sign in first. */
const RESUME: NavItem = { href: "/account/resume", label: "Resume builder", short: "Resume" };

const items = (resume: boolean) => (resume ? [...NAV, RESUME] : NAV);

const linkClass = "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors";

function Label({ item }: { item: NavItem }) {
  if (!item.short) return item.label;
  return (
    <>
      <span className="sm:hidden">{item.short}</span>
      <span className="max-sm:hidden">{item.label}</span>
    </>
  );
}

/** Static links, used as the Suspense fallback before the pathname is known. */
export function NavLinksStatic({ resume = false }: { resume?: boolean }) {
  return (
    <>
      {items(resume).map((item) => (
        <Link key={item.href} href={item.href} className={cn(linkClass, "text-muted hover:text-fg")}>
          <Label item={item} />
        </Link>
      ))}
    </>
  );
}

export function NavLinks({ resume = false }: { resume?: boolean }) {
  const pathname = usePathname();
  return (
    <>
      {items(resume).map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(linkClass, active ? "text-fg bg-tint-strong" : "text-muted hover:text-fg")}
          >
            <Label item={item} />
          </Link>
        );
      })}
    </>
  );
}
