import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    : null;

function limiter(prefix: string, requests: number) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    prefix: `lodestar:rl:${prefix}`,
    limiter: Ratelimit.slidingWindow(requests, "1 m"),
    analytics: false,
  });
}

const limiters = {
  apply: limiter("apply", 20),
  api: limiter("api", 60),
};

/**
 * Returns true when the request is allowed. Without Upstash configured
 * (local dev) everything is allowed; in production Redis outages fail open
 * so a cache blip never takes down the site.
 */
export async function rateLimit(kind: keyof typeof limiters, identifier: string) {
  const l = limiters[kind];
  if (!l) return true;
  try {
    const { success } = await l.limit(identifier);
    return success;
  } catch (err) {
    console.error("rate limit check failed", err);
    return true;
  }
}

export function clientIp(headers: Headers) {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anonymous"
  );
}
