import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { PoeLedger } from "@/lib/poe/ledger";
import { beginPoeOperation, readPoeConfig } from "@/lib/poe/operation";

const dirs: string[] = [];
function path() {
  const dir = mkdtempSync(join(tmpdir(), "pulse-poe-"));
  dirs.push(dir);
  return join(dir, "ledger.sqlite");
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const operation = {
  runId: "private-run",
  correlationId: "correlation-1",
  operationId: "sql.query.read",
  actor: "agent:user",
  decision: "allow" as const,
  reason: "ALLOWED",
};

describe("PoE/SBL durable ledger", () => {
  test("persists decision and outcome, links hashes, keeps unavailable energy null", () => {
    const file = path();
    const finish = beginPoeOperation(operation, { path: file, estimatedWatts: null });
    finish?.("success", 42);
    const ledger = new PoeLedger(file);
    const report = ledger.read(0, 100);
    expect(report.integrity.valid).toBe(true);
    expect(report.integrity.count).toBe(2);
    expect(report.records[1].previousHash).toBe(report.records[0].hash);
    expect(report.records[1].event.energy).toEqual({ source: "unavailable", kWh: null });
    expect(report.records[1].event.durationMs).toBe(42);
    expect(report.records[1].event.sbl.stage).toBe("completed");
    expect(JSON.stringify(report)).not.toContain("private-run");
    expect(report.records[1].event.modelId).toBeNull();
    expect(report.records[1].event.tokenCount).toBeNull();
    expect(ledger.read(1, 1).records).toHaveLength(1);
    expect(ledger.read(2, 1).records).toHaveLength(0);
  });
  test("estimates watts times elapsed time with correct kWh conversion, including zero", () => {
    const file = path();
    const finish = beginPoeOperation(operation, { path: file, estimatedWatts: 100 });
    finish?.("success", 3_600_000);
    const records = new PoeLedger(file).read(0, 10).records;
    expect(records[0].event.energy.source).toBe("unavailable");
    expect(records[1].event.energy).toEqual({
      source: "estimated",
      kWh: 0.1,
      watts: 100,
      method: "configured-watts-times-operation-duration",
    });
    beginPoeOperation({ ...operation, correlationId: "zero" }, { path: file, estimatedWatts: 0 })?.("failure", 0);
    expect(new PoeLedger(file).read(3, 1).records[0].event.energy.kWh).toBe(0);
  });
  test("denials persist without an execution and malformed durations fail", () => {
    const file = path();
    expect(
      beginPoeOperation(
        { ...operation, decision: "deny", reason: "ROLE_FORBIDDEN" },
        { path: file, estimatedWatts: null },
      ),
    ).toBeUndefined();
    const finish = beginPoeOperation(
      { ...operation, correlationId: "allowed-after-denial" },
      { path: file, estimatedWatts: null },
    );
    expect(() => finish?.("success", -1)).toThrow();
    expect(() => finish?.("success", NaN)).toThrow();
    expect(new PoeLedger(file).read(0, 10).records[0].event.sbl.stage).toBe("denied");
  });
  test("duplicate completion cannot fabricate a second outcome", () => {
    const file = path();
    const finish = beginPoeOperation(operation, { path: file, estimatedWatts: null });
    finish?.("success", 1);
    expect(() => finish?.("success", 1)).toThrow();
  });
  test("detects payload tampering and interior deletion after reopening", () => {
    const file = path();
    beginPoeOperation(operation, { path: file, estimatedWatts: null })?.("success", 1);
    const db = new Database(file);
    db.prepare("UPDATE poe_events SET payload = ? WHERE sequence = 1").run("{}");
    db.close();
    expect(new PoeLedger(file).read(0, 10).integrity.valid).toBe(false);
    const db2 = new Database(file);
    db2.exec("DELETE FROM poe_events WHERE sequence = 1");
    db2.close();
    expect(new PoeLedger(file).read(0, 10).integrity.valid).toBe(false);
  });
  test("validates config and pagination, disabled mode leaves no ledger", () => {
    expect(readPoeConfig({})).toBeNull();
    expect(readPoeConfig({ POE_ENABLED: "false" })).toBeNull();
    expect(() => readPoeConfig({ POE_ENABLED: "yes" })).toThrow();
    expect(() => readPoeConfig({ POE_ENABLED: "true", POE_ESTIMATED_WATTS: "-1" })).toThrow();
    expect(() => readPoeConfig({ POE_ENABLED: "true", POE_ESTIMATED_WATTS: "Infinity" })).toThrow();
    expect(
      readPoeConfig({ POE_ENABLED: "true", POE_SQLITE_PATH: path(), POE_ESTIMATED_WATTS: "0" })?.estimatedWatts,
    ).toBe(0);
    expect(beginPoeOperation(operation, null)).toBeUndefined();
    const ledger = new PoeLedger(path());
    expect(() => ledger.read(-1, 10)).toThrow();
    expect(() => ledger.read(0, 101)).toThrow();
    expect(ledger.read(0, 10).integrity.count).toBe(0);
  });
  test("separate ledger writers share one sequence and a damaged tail refuses append", () => {
    const file = path();
    const finish = beginPoeOperation(operation, { path: file, estimatedWatts: null });
    beginPoeOperation(
      { ...operation, correlationId: "approval", decision: "require-approval", reason: "APPROVAL_REQUIRED" },
      { path: file, estimatedWatts: null },
    );
    finish?.("success", 1);
    expect(new PoeLedger(file).read(0, 10).integrity.count).toBe(3);
    const db = new Database(file);
    db.exec("UPDATE poe_events SET hash = 'broken' WHERE sequence = 3");
    db.close();
    expect(() =>
      beginPoeOperation({ ...operation, correlationId: "next" }, { path: file, estimatedWatts: null }),
    ).toThrow("tail integrity");
  });
  test("rejects malformed payloads and mismatched index fields even with recalculated hashes", () => {
    for (const payload of ["not-json", "{}", null]) {
      const file = path();
      beginPoeOperation({ ...operation, decision: "deny" }, { path: file, estimatedWatts: null });
      const db = new Database(file);
      const row = db.prepare("SELECT * FROM poe_events").get() as { payload: string; previous_hash: string };
      const text = payload ?? row.payload;
      const hash = createHash("sha256").update(`1\n${row.previous_hash}\n${text}`).digest("hex");
      db.prepare("UPDATE poe_events SET payload = ?, hash = ?, correlation_id = ?").run(text, hash, "wrong-index");
      db.close();
      expect(new PoeLedger(file).read(0, 10).integrity.valid).toBe(false);
    }
  });
});
