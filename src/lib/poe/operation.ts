import { createHash } from "node:crypto";
import { join } from "node:path";
import { getDataDir } from "@/lib/data-dir";
import { PoeLedger, type PoeEvent } from "./ledger";

interface PoeConfig {
  path: string;
  estimatedWatts: number | null;
}

export function readPoeConfig(env: Readonly<Record<string, string | undefined>> = process.env): PoeConfig | null {
  if (!env.POE_ENABLED || env.POE_ENABLED === "false") return null;
  if (env.POE_ENABLED !== "true") throw new Error("POE_ENABLED must be true or false");
  const raw = env.POE_ESTIMATED_WATTS?.trim();
  const estimatedWatts = raw ? Number(raw) : null;
  if (estimatedWatts !== null && (!Number.isFinite(estimatedWatts) || estimatedWatts < 0)) {
    throw new Error("POE_ESTIMATED_WATTS must be a finite nonnegative number");
  }
  return { path: env.POE_SQLITE_PATH || join(getDataDir(), "pulse-poe.sqlite"), estimatedWatts };
}

interface Operation {
  runId: string;
  correlationId: string;
  operationId: string;
  actor: string;
  decision: "allow" | "deny" | "require-approval";
  reason: string;
}

/** Synchronous by design: the policy/concurrency admission window must not yield.
 * Only the validated registry id and closed policy codes may enter this seam. */
export function beginPoeOperation(operation: Operation, config = readPoeConfig()) {
  if (!config) return;
  const ledger = new PoeLedger(config.path);
  const event: PoeEvent = {
    version: 1,
    timestamp: new Date().toISOString(),
    correlationId: operation.correlationId,
    runHash: createHash("sha256").update(operation.runId).digest("hex"),
    operationId: operation.operationId,
    actor: operation.actor as PoeEvent["actor"],
    phase: "decision",
    status: operation.decision,
    reason: operation.reason,
    durationMs: null,
    energy: { source: "unavailable", kWh: null },
    modelId: null,
    tokenCount: null,
    sbl: {
      objective: "execute-policy-controlled-database-operation",
      stage:
        operation.decision === "allow" ? "authorized" : operation.decision === "deny" ? "denied" : "awaiting-approval",
      purpose: "accountable-database-investigation",
    },
  };
  ledger.append(event);
  if (operation.decision !== "allow") return;
  return (status: "success" | "failure", durationMs: number) => {
    ledger.append({
      ...event,
      timestamp: new Date().toISOString(),
      phase: "outcome",
      status,
      reason: status === "success" ? "EXECUTED" : "EXECUTION_FAILED",
      durationMs,
      energy:
        config.estimatedWatts === null
          ? { source: "unavailable", kWh: null }
          : {
              source: "estimated",
              kWh: (config.estimatedWatts * durationMs) / 3_600_000_000,
              watts: config.estimatedWatts,
              method: "configured-watts-times-operation-duration",
            },
      sbl: { ...event.sbl, stage: status === "success" ? "completed" : "failed" },
    });
  };
}
