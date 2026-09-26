"use client";

import { useEffect } from "react";
import { captureError } from "@/lib/sentry-client";

/** Last-resort boundary when the root layout itself fails; must render <html>. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    captureError(error);
  }, [error]);

  return (
    // globals.css may be what failed, so the colours are inline; `light-dark()`
    // follows the machine rather than the saved preference, which is enough here.
    <html lang="en" style={{ colorScheme: "light dark" }}>
      <body
        style={{
          background: "light-dark(#f4f4f6, #12141d)",
          color: "light-dark(#101014, #e8e9f0)",
          fontFamily: "system-ui",
          padding: "6rem 1rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem" }}>Lodestar is having trouble</h1>
        <p style={{ color: "light-dark(#52525b, #a1a1a1)" }}>Please refresh in a minute.</p>
      </body>
    </html>
  );
}
