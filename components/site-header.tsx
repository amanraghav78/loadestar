import { Suspense } from "react";
import { AccountNav, AccountNavFallback } from "@/components/account-nav";
import { Logo } from "@/components/logo";
import { NavLinks, NavLinksStatic } from "@/components/nav-links";
import { SavedCount } from "@/components/saved-count";
import { SavedJobsSync } from "@/components/saved-jobs-sync";
import { ThemeToggle } from "@/components/theme-toggle";
import { LinkButton } from "@/components/ui/button";
import { postJobHref } from "@/lib/auth";

export function SiteHeader() {
  return (
    <>
      <header className="border-line bg-bg/75 supports-[backdrop-filter]:bg-bg/60 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="metal ml-6 hidden items-center gap-0.5 rounded-full p-1 md:flex">
            <Suspense fallback={<NavLinksStatic />}>
              <NavLinks />
            </Suspense>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
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
              <LinkButton href={postJobHref} variant="secondary" size="sm">
                Post a job
              </LinkButton>
            </span>
          </div>
        </div>
      </header>
      {/* Phones: the section links sit under the bar and scroll away with the page, so only one row stays pinned. */}
      <nav aria-label="Main mobile" className="border-line flex gap-1 border-b px-3 py-2 md:hidden">
        <Suspense fallback={<NavLinksStatic />}>
          <NavLinks />
        </Suspense>
      </nav>
    </>
  );
}
