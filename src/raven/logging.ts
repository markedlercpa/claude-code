/**
 * Audit trail (§7).
 *
 * Every message Raven sends — auto or human-approved — is logged as one JSONL
 * record with the full fields the handoff requires. Written to a configurable
 * path (RAVEN_AUDIT_LOG_PATH) so it can point at wherever LAPS operational logs
 * live; the default is a local ./logs/raven-audit.jsonl for dev.
 *
 * A copy of every record is also emitted to stderr so it's captured by the
 * Dockerized service's existing stdout/stderr log pipeline without extra infra.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "../config.js";
import type { Category } from "./classifier.js";

export type Disposition = "auto_sent" | "hitl_approved" | "held_draft" | "escalated";

export interface AuditRecord {
  timestamp: string;
  prospect: string | null;
  threadId: string | null;
  hubspotDealId: string | null;
  owner: string | null;
  category: Category;
  disposition: Disposition;
  /** For HITL approvals: who approved and when. */
  approvedBy?: string | null;
  approvedAt?: string | null;
  /** Exact disclosure/sign-off text used on the message (§7). */
  disclosureText: string;
  /** Full message body, for later QA/review (§7). */
  body: string;
  subject?: string;
  rationale?: string;
}

/**
 * Append one audit record. `nowIso` is passed in by the caller (the runtime
 * blocks argless Date in some contexts) so logging stays deterministic/testable.
 */
export async function writeAudit(record: AuditRecord): Promise<void> {
  const line = JSON.stringify(record);
  // Mirror to stderr for the container log pipeline.
  console.error(`[raven-audit] ${line}`);
  try {
    await mkdir(dirname(config.raven.auditLogPath), { recursive: true });
    await appendFile(config.raven.auditLogPath, line + "\n", "utf8");
  } catch (err) {
    // Logging must never crash a send that already happened; surface loudly.
    console.error(
      `[raven-audit] FAILED to write audit log to ${config.raven.auditLogPath}: ${(err as Error).message}`,
    );
  }
}
