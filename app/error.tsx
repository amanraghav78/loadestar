"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <Container className="py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        We&rsquo;ve been notified. Try again, and if it keeps happening, come back in a few minutes.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-subtle">Ref: {error.digest}</p>}
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </Container>
  );
}
