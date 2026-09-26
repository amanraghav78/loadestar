"use client";

import { useEffect } from "react";
import { captureError } from "@/lib/sentry-client";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureError(error);
  }, [error]);

  return (
    <Container className="py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted mt-2 text-sm">
        We&rsquo;ve been notified. Try again, and if it keeps happening, come back in a few minutes.
      </p>
      {error.digest && <p className="text-subtle mt-2 font-mono text-xs">Ref: {error.digest}</p>}
      <Button onClick={reset} className="mt-6">
        Try again
      </Button>
    </Container>
  );
}
