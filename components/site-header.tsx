import { Suspense } from "react";
import { AccountNav, AccountNavFallback } from "@/components/account-nav";
import { Logo } from "@/components/logo";
import { NavLinks, NavLinksStatic } from "@/components/nav-links";
import { SavedCount } from "@/components/saved-count";
import { SavedJobsSync } from "@/components/saved-jobs-sync";
import { LinkButton } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/75 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav
          aria-label="Main"
          className="metal ml-6 hidden items-center gap-0.5 rounded-full p-1 md:flex"
        >
          <Suspense fallback={<NavLinksStatic />}>
            <NavLinks />
          </Suspense>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SavedCount />
          {/* Streams in on its own so the rest of the header still prerenders. */}
          <Suspense fallback={<AccountNavFallback />}>
            <AccountNav />
          </Suspense>
          {/* Renders nothing; brings saved roles and the account into step. */}
          <Suspense fallback={null}>
            <SavedJobsSync />
          </Suspense>
          <span className="hidden sm:block">
            <LinkButton href="/employers/post" variant="secondary" size="sm">
              Post a job
            </LinkButton>
          </span>
        </div>
      </div>
      <nav aria-label="Main mobile" className="flex gap-1 border-t border-line px-3 py-2 md:hidden">
        <Suspense fallback={<NavLinksStatic />}>
          <NavLinks />
        </Suspense>
      </nav>
    </header>
  );
}
