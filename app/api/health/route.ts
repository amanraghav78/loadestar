import { connection, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Uptime check: confirms the function can reach Postgres. */
export async function GET() {
  await connection();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
