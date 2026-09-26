import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { beginPoeOperation } from "@/lib/poe/operation";
let session: { username: string; role: string } | null = null;
const denial = mock(() => {});
mock.module("@/lib/auth", () => ({ getSession: async () => session }));
mock.module("@/lib/api/require-session", () => ({ auditRoleDenial: denial }));
const { GET } = await import("@/app/api/admin/poe/route");
const original = { ...process.env };
const dirs: string[] = [];
afterEach(() => {
  session = null;
  denial.mockClear();
  for (const key of ["POE_ENABLED", "POE_SQLITE_PATH", "POE_ESTIMATED_WATTS"]) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function setup() {
  session = { username: "admin", role: "admin" };
  const dir = mkdtempSync(join(tmpdir(), "pulse-api-"));
  dirs.push(dir);
  process.env.POE_ENABLED = "true";
  process.env.POE_SQLITE_PATH = join(dir, "ledger.sqlite");
  delete process.env.POE_ESTIMATED_WATTS;
  return process.env.POE_SQLITE_PATH;
}
const request = (query = "") => new Request(`http://localhost/api/admin/poe${query}`);
describe("admin PoE export", () => {
  test("rejects anonymous and non-admin access", async () => {
    expect((await GET(request())).status).toBe(403);
    session = { username: "user", role: "user" };
    expect((await GET(request())).status).toBe(403);
    expect(denial).toHaveBeenCalledTimes(1);
  });
  test("reports disabled state", async () => {
    setup();
    process.env.POE_ENABLED = "false";
    expect(await (await GET(request())).json()).toEqual({ enabled: false, records: [] });
  });
  test("validates pagination", async () => {
    setup();
    const responses = await Promise.all(
      ["?after=-1", "?after=NaN", "?limit=0", "?limit=101", "?limit=1.5"].map((query) => GET(request(query))),
    );
    for (const response of responses) expect(response.status).toBe(400);
  });
  test("exports a verified page without caching", async () => {
    const file = setup();
    beginPoeOperation(
      {
        runId: "run",
        correlationId: "id",
        actor: "agent:admin",
        operationId: "sql.query.read",
        decision: "allow",
        reason: "ALLOWED",
      },
      { path: file, estimatedWatts: null },
    )?.("success", 20);
    const response = await GET(request("?after=1&limit=1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const report = await response.json();
    expect(report.records).toHaveLength(1);
    expect(report.nextAfter).toBe(2);
    expect(report.integrity.valid).toBe(true);
  });
  test("returns conflict and hides altered records", async () => {
    const file = setup();
    beginPoeOperation(
      {
        runId: "run",
        correlationId: "id",
        actor: "agent:admin",
        operationId: "sql.query.read",
        decision: "deny",
        reason: "ROLE_FORBIDDEN",
      },
      { path: file, estimatedWatts: null },
    );
    const db = new Database(file);
    db.exec("UPDATE poe_events SET hash = 'changed'");
    db.close();
    const response = await GET(request());
    expect(response.status).toBe(409);
    expect((await response.json()).records).toEqual([]);
  });
  test("storage failures do not disclose paths", async () => {
    const file = setup();
    writeFileSync(file, "not sqlite");
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "PoE ledger unavailable" });
  });
});
