# Pulse PoE/SBL

## What is implemented

An opt-in, persistent ledger for `executeAuditedOperation`, the agent's policy-controlled database operation pipeline. Every admitted, denied or approval-required decision is recorded synchronously before provider invocation. Admitted operations receive a second event on success or failure. Existing database read-only policies remain enforced.

Each event contains a timestamp, correlation ID, SHA-256 of the run ID, resolved operation ID, validated actor label, policy reason, duration, energy provenance and SBL execution state. SBL here describes observable state: authorized, denied, awaiting approval, completed or failed. It does not represent consciousness or expose private model reasoning.

SQL, result values, connection details, credentials, raw user objectives and driver exception messages are excluded. Model identity and token count are explicitly `null`: this boundary measures database operations, not model inference. It does not cover manual editor operations or all work in an agent run.

## Enable

Use the existing application configuration and installation described in the original README. In the server environment or `.env.local`:

```dotenv
POE_ENABLED=true
POE_SQLITE_PATH=./data/pulse-poe.sqlite
# Optional estimate, in watts; omit when unknown:
# POE_ESTIMATED_WATTS=100
```

Restart the application after changing configuration. The default is disabled. Without an explicit path, the ledger lives beside `STORAGE_SQLITE_PATH`, or under `./data`. The existing `better-sqlite3` dependency is reused; no new runtime dependencies are added.

Protect the data directory with the deployment user's filesystem permissions. Docker deployments need a persistent writable volume there. WAL SQLite supports multiple processes on one local host; this is not a shared multi-host/network-filesystem ledger. Keep the database, WAL and SHM together during operation; use a SQLite-aware backup or stop all writers before copying.

## Energy semantics

- Without configured watts: `source: unavailable`, `kWh: null`. Unknown consumption is never zero.
- With configured watts: `source: estimated`, with the configured watts and calculation method saved in the hashed event.
- Formula: `kWh = watts × durationMs / 3,600,000,000`. For example, 100 W over one hour gives 0.1 kWh.
- Decision events have no duration and no energy estimate. Only the outcome represents execution duration; do not count both as two operations.
- This release has no sensor adapter, measured-energy claim, four-model orchestrator, IoTeX transaction, blockchain anchoring or autonomous write sandbox. Estimates describe the database-operation interval, not model/GPU energy or a whole-machine allocation. Overlapping operations can overlap estimates; do not treat their sum as metered facility consumption.

## Inspect and export

Sign in as an administrator and open `GET /api/admin/poe?after=0&limit=50` on the application's origin (include its base path if configured). The endpoint returns verified records as JSON, suitable for saving/exporting. There is no unauthenticated endpoint and no client-facing write endpoint.

`after` is the last sequence already read; use `nextAfter` for the next page. Limits are 1–100. Each request verifies the complete chain in the same SQLite read transaction as the returned page; memory used for returned records is bounded, but verification time grows with history. Poll deliberately for large ledgers rather than at dashboard refresh frequency.

Responses: 200 for a verified page or disabled state; 400 for invalid pagination; 403 for non-admin access; 409 for a damaged chain (no payloads returned); 503 for storage/configuration failure without disclosing local paths. The `integrity.count` on an invalid chain is how far verification reached, not a claimed total. Save the latest trusted `headHash` and count externally if you need a checkpoint.

## Integrity and failure behavior

The API only appends. SQLite IMMEDIATE transactions serialize writers, FULL synchronous mode requests durable commits, and `(correlation_id, phase)` uniqueness prevents duplicate outcomes. SHA-256 covers sequence, previous hash and the entire serialized event. Each append verifies the existing tail; the export verifies all links, sequences, payload schemas and indexed identity fields. It detects edits and interior deletion, including after a process restart.

Hashes are not signatures. A privileged writer can rewrite the entire history and hashes. Tail truncation or complete removal cannot be proven from the remaining database alone; external trusted checkpoints are needed. No physical-energy attestation is claimed.

If the initial PoE decision cannot be stored, the provider is not called and no concurrency slot is consumed. After provider invocation, budget accounting is released before writing the outcome. If outcome storage fails, the operation may already have run; the caller receives an error and the decision can remain without an outcome. Such an entry means incomplete/unknown outcome, not success or failure. Do not automatically retry it. If both provider and outcome storage fail, an AggregateError retains both errors. Process termination can likewise leave a decision pending. No recovery process fabricates missing outcomes.

The existing audit sink can independently fail. A durable PoE allow decision is authorization evidence, not proof the provider was invoked. The normal audit channel and PoE ledger are not a distributed atomic transaction.

## Validation

Run the repository's isolated-file runner:

```sh
bun tests/run-tests.ts tests/unit/lib/poe/ledger.test.ts tests/unit/db/operations/execution.test.ts tests/api/admin/poe.test.ts
```

These tests exercise persistence, hash linkage and tampering, energy conversion including zero, duplicate outcomes, policy denial, storage failures before/after invocation, budget release, redaction and endpoint authorization/pagination.
