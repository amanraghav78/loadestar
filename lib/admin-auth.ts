import { env } from "@/lib/env";

/**
 * Operator-only lock for /admin (HTTP Basic Auth over HTTPS). This is not
 * user authentication. Candidates never sign in, and only the team adding
 * listings needs these credentials.
 */
export function isAdminAuthorization(header: string | null | undefined) {
  if (!header?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);
  // Evaluate both comparisons so timing doesn't reveal which one failed.
  const userOk = constantTimeEqual(user, env.ADMIN_USER);
  const passOk = constantTimeEqual(pass, env.ADMIN_PASS);
  return userOk && passOk;
}

function constantTimeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
