import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { auditRoleDenial } from "@/lib/api/require-session";
import { PoeLedger } from "@/lib/poe/ledger";
import { readPoeConfig } from "@/lib/poe/operation";

export const runtime = "nodejs";

/** Admin-only verified JSON export. No client-facing write/measurement endpoint. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    if (session) auditRoleDenial({ route: "GET /api/admin/poe", user: session.username, request });
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const after = Number(params.get("after") ?? 0);
  const limit = Number(params.get("limit") ?? 50);
  if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ error: "after must be a nonnegative integer; limit must be 1–100" }, { status: 400 });
  }
  try {
    const config = readPoeConfig();
    if (!config) return NextResponse.json({ enabled: false, records: [] });
    const report = new PoeLedger(config.path).read(after, limit);
    return NextResponse.json(
      { enabled: true, ...report },
      {
        status: report.integrity.valid ? 200 : 409,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    // Do not expose filesystem paths, SQLite internals or stored payloads.
    return NextResponse.json({ error: "PoE ledger unavailable" }, { status: 503 });
  }
}
