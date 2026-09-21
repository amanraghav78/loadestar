"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/** Last-resort boundary when the root layout itself fails; must render <html>. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#12141d", color: "#e8e9f0", fontFamily: "system-ui", padding: "6rem 1rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Lodestar is having trouble</h1>
        <p style={{ color: "#a1a1a1" }}>Please refresh in a minute.</p>
      </body>
    </html>
  );
}
