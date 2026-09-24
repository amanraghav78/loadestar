import "server-only";
import { env } from "@/lib/env";

/**
 * Bot protection for the forms anyone can reach: Cloudflare Turnstile.
 *
 * Optional, like Upstash and Blob storage. Without the keys the widget is not
 * rendered and verification is skipped, so development and the test suite run
 * without a Cloudflare account. Rate limiting (lib/ratelimit.ts) applies either
 * way — this is the layer above it, not a replacement for it.
 */
export const captchaEnabled = Boolean(env.TURNSTILE_SECRET_KEY && env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Turnstile is asked to answer within this long; past it we stop waiting. */
const TIMEOUT_MS = 5000;

/**
 * True when the token is good, or when Turnstile is switched off.
 *
 * A failure to *reach* Cloudflare fails closed: unlike a rate-limit check,
 * where a Redis blip should never block a real person, an unverifiable token on
 * a public write is exactly the case this exists to stop. The caller turns a
 * false into a message asking the person to try again.
 */
export async function verifyCaptcha(token: unknown, ip?: string): Promise<boolean> {
  if (!captchaEnabled) return true;
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) return false;

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY!, response: token });
  // Turnstile treats the IP as a hint; it is optional and omitted when unknown.
  if (ip && ip !== "anonymous") body.set("remoteip", ip);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("turnstile verify returned", response.status);
      return false;
    }
    const result = (await response.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!result.success) console.warn("turnstile rejected a token", result["error-codes"]);
    return result.success === true;
  } catch (err) {
    console.error("turnstile verify failed", err);
    return false;
  }
}

/** The message shown when a check fails, so every form words it the same way. */
export const CAPTCHA_FAILED = "We couldn't confirm you're human. Please try again.";
