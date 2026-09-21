import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const nav = [
  { href: "/admin", label: "Jobs" },
  { href: "/admin/jobs/new", label: "New job" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/import", label: "CSV import" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Container wide className="py-8">
      <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line pb-4">
        <span className="rounded-md border border-line-strong px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">
          Admin
        </span>
        <nav aria-label="Admin" className="flex flex-wrap gap-5">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-muted hover:text-fg">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </Container>
  );
}
