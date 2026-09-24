"use client";

import Script from "next/script";
import { env } from "@/lib/env";

/**
 * The Turnstile checkbox, as a form field.
 *
 * Renders nothing when no site key is configured, which is how development and
 * the end-to-end suite run: the server skips the check in exactly the same case
 * (see lib/captcha.ts), so a form works with or without it.
 *
 * Turnstile finds this element by class and writes its token into a hidden
 * input named `cf-turnstile-response`, which is what the action reads. The
 * script is loaded once per page by next/script, after the form is interactive.
 */
export function CaptchaField({ className }: { className?: string }) {
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <div className={className}>
      <div className="cf-turnstile" data-sitekey={siteKey} data-theme="dark" data-size="flexible" />
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        // One copy is enough however many widgets a page has.
        id="cf-turnstile-script"
      />
      <noscript>
        <p className="text-subtle mt-2 text-xs">Turn on JavaScript to submit this form.</p>
      </noscript>
    </div>
  );
}
