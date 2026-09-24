import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Container } from "@/components/ui/container";
import { accountsEnabled } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/** Only ever an internal path, so a crafted ?next= can't bounce anyone off-site. */
function safeNext(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;
  return next && /^\/(?!\/)[\w\-./?=&%]*$/.test(next) ? next : "/account";
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  if (!accountsEnabled) notFound();

  return (
    <Container className="py-16 sm:py-24">
      <div className="metal mx-auto max-w-md rounded-3xl p-8">
        <h1 className="steel-text text-2xl font-semibold tracking-[-0.03em]">Sign in</h1>
        <p className="text-muted mt-2 text-sm">Keep your saved roles, your profile and your resume in one place.</p>

        <div className="mt-7">
          <Suspense fallback={<div className="bg-tint h-12 rounded-full" />}>
            {searchParams.then((params) => (
              <GoogleSignIn next={safeNext(params.next)} />
            ))}
          </Suspense>
        </div>

        <p className="text-subtle mt-6 flex items-start gap-2 text-xs leading-relaxed">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            We never post anything, and we never share your details with employers. You can delete your account and
            everything in it at any time. See our{" "}
            <a href="/privacy" className="underline underline-offset-2">
              privacy notice
            </a>
            .
          </span>
        </p>
      </div>
    </Container>
  );
}
