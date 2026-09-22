import Link from "next/link";
import { UserRound } from "lucide-react";
import { accountsEnabled } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";

const pill = "btn-steel inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium";

/** Shown while the session streams in, and whenever accounts are switched off. */
export function AccountNavFallback() {
  if (!accountsEnabled) return null;
  return (
    <Link href="/sign-in" className={pill}>
      <UserRound className="size-3.5" aria-hidden />
      Sign in
    </Link>
  );
}

/**
 * Reads the session, so it only ever renders behind a <Suspense> boundary;
 * everything else in the header stays in the prerendered shell.
 */
export async function AccountNav() {
  if (!accountsEnabled) return null;
  const user = await getSessionUser();
  if (!user) return <AccountNavFallback />;

  const label = user.name.split(" ")[0] || "Account";
  return (
    <Link href="/account" className={pill}>
      <span
        className="metal flex size-5 items-center justify-center rounded-full text-[10px] font-semibold"
        aria-hidden
      >
        {label.charAt(0).toUpperCase()}
      </span>
      <span className="max-w-24 truncate">{label}</span>
    </Link>
  );
}
