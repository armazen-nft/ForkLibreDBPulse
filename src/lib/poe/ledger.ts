import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { z } from "zod";

const nonnegative = z.number().finite().nonnegative();
const energySchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("unavailable"), kWh: z.null() }).strict(),
  z
    .object({
      source: z.literal("estimated"),
      kWh: nonnegative,
      watts: nonnegative,
      method: z.literal("configured-watts-times-operation-duration"),
    })
    .strict(),
]);

// Deliberately no raw objective, SQL, result values, credentials or model reasoning.
// SBL describes observable execution state, not subjective model experience.
const eventSchema = z
  .object({
    version: z.literal(1),
    timestamp: z.iso.datetime(),
    correlationId: z.string().min(1).max(128),
    runHash: z.string().regex(/^[a-f0-9]{64}$/),
    operationId: z.string().min(1).max(128),
    actor: z.enum(["agent:admin", "agent:user", "agent:unknown"]),
    phase: z.enum(["decision", "outcome"]),
    status: z.enum(["allow", "deny", "require-approval", "success", "failure"]),
    reason: z.string().min(1).max(128),
    durationMs: nonnegative.nullable(),
    energy: energySchema,
    modelId: z.null(),
    tokenCount: z.null(),
    sbl: z
      .object({
        objective: z.literal("execute-policy-controlled-database-operation"),
        stage: z.enum(["authorized", "denied", "awaiting-approval", "completed", "failed"]),
        purpose: z.literal("accountable-database-investigation"),
      })
      .strict(),
  })
  .strict();

export type PoeEvent = z.infer<typeof eventSchema>;
interface Row {
  sequence: number;
  previous_hash: string;
  hash: string;
  payload: string;
}
const GENESIS = "0".repeat(64);
function digest(sequence: number, previousHash: string, payload: string): string {
  return createHash("sha256").update(`${sequence}\n${previousHash}\n${payload}`).digest("hex");
}

/** Local append-only API. SQLite serializes writers across processes; hashes are
 * consistency checks, not signatures, hardware attestations or external anchors. */
export class PoeLedger {
  constructor(private readonly path: string) {}

  private open(): Database.Database {
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    const db = new Database(this.path, { timeout: 5000 });
    try {
      db.pragma("journal_mode = WAL");
      db.pragma("synchronous = FULL");
      db.exec(`CREATE TABLE IF NOT EXISTS poe_events (
        sequence INTEGER PRIMARY KEY, previous_hash TEXT NOT NULL,
        hash TEXT NOT NULL, payload TEXT NOT NULL,
        correlation_id TEXT NOT NULL, phase TEXT NOT NULL,
        UNIQUE(correlation_id, phase)
      )`);
      return db;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  append(input: PoeEvent): void {
    const event = eventSchema.parse(input);
    const payload = JSON.stringify(event);
    const db = this.open();
    try {
      db.transaction(() => {
        const tail = db.prepare("SELECT * FROM poe_events ORDER BY sequence DESC LIMIT 1").get() as Row | undefined;
        if (tail && digest(tail.sequence, tail.previous_hash, tail.payload) !== tail.hash) {
          throw new Error("PoE ledger tail integrity failure");
        }
        const sequence = (tail?.sequence ?? 0) + 1;
        const previousHash = tail?.hash ?? GENESIS;
        db.prepare("INSERT INTO poe_events VALUES (?, ?, ?, ?, ?, ?)").run(
          sequence,
          previousHash,
          digest(sequence, previousHash, payload),
          payload,
          event.correlationId,
          event.phase,
        );
      }).immediate();
    } finally {
      db.close();
    }
  }

  /** Verifies the complete chain within the same read snapshot as the page.
   * Invalid ledgers return no records, so corrupted content is never displayed. */
  read(after: number, limit: number) {
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Invalid PoE pagination");
    }
    const db = this.open();
    try {
      return db.transaction(() => {
        let previousHash = GENESIS;
        let count = 0;
        let valid = true;
        for (const value of db.prepare("SELECT * FROM poe_events ORDER BY sequence").iterate()) {
          const row = value as Row;
          count++;
          if (
            row.sequence !== count ||
            row.previous_hash !== previousHash ||
            digest(row.sequence, row.previous_hash, row.payload) !== row.hash
          ) {
            valid = false;
            break;
          }
          try {
            const event = eventSchema.parse(JSON.parse(row.payload));
            const indexed = value as Row & { correlation_id: string; phase: string };
            if (event.correlationId !== indexed.correlation_id || event.phase !== indexed.phase) valid = false;
          } catch {
            valid = false;
          }
          if (!valid) break;
          previousHash = row.hash;
        }
        const rows = valid
          ? (db
              .prepare("SELECT * FROM poe_events WHERE sequence > ? ORDER BY sequence LIMIT ?")
              .all(after, limit) as Row[])
          : [];
        const records = rows.map((row) => ({
          sequence: row.sequence,
          previousHash: row.previous_hash,
          hash: row.hash,
          event: eventSchema.parse(JSON.parse(row.payload)),
        }));
        return {
          integrity: { valid, count, headHash: previousHash },
          records,
          nextAfter: records.at(-1)?.sequence ?? after,
        };
      })();
    } finally {
      db.close();
    }
  }
}
