"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const NAV = [
  { href: "/jobs", label: "Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/salaries", label: "Salaries" },
];

const linkClass = "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors";

/** Static links, used as the Suspense fallback before the pathname is known. */
export function NavLinksStatic() {
  return (
    <>
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} className={cn(linkClass, "text-muted hover:text-fg")}>
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(linkClass, active ? "bg-white/[0.08] text-fg" : "text-muted hover:text-fg")}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
