/**
 * Human-in-the-loop gate (§5, §9).
 *
 * The handoff specifies reusing the existing LAPS Teams PreToolUse hook to
 * approve Raven's send, rather than building a parallel mechanism. That hook
 * lives in the parent Dockerized Agent SDK service, NOT in this MCP server —
 * so here we expose a clean, pluggable seam:
 *
 *   - `resolveGate()` decides, from the classifier's action + the soft-launch
 *     flag, whether a candidate send is auto / HITL / escalate.
 *   - `requestApproval()` delegates to a registered approver. The parent
 *     service registers one that posts to Teams and blocks on the human's
 *     decision (wiring the PreToolUse hook to the `raven_send_email` tool).
 *
 * Default behavior when no approver is registered (i.e. running standalone):
 * NEVER auto-approve. The send is withheld and the caller creates a draft for
 * a human to review — fail-closed, matching §9's "route 100% through HITL"
 * soft-launch posture.
 */
import { config } from "../config.js";
import type { Action, Category } from "./classifier.js";

export type GateMode = "auto_send" | "hitl" | "escalate";

/**
 * Collapse the classifier's action with the soft-launch override. During soft
 * launch (default ON), everything that would otherwise auto-send is forced
 * through HITL instead (§9). Escalations always escalate.
 */
export function resolveGate(action: Action): GateMode {
  if (action === "escalate") return "escalate";
  if (action === "hitl") return "hitl";
  // action === "auto_send"
  return config.raven.softLaunchGateAll ? "hitl" : "auto_send";
}

export interface ApprovalRequest {
  category: Category;
  owner: string | null;
  prospect: string | null;
  subject: string;
  bodyHtml: string;
  hubspotDealId: string | null;
  rationale: string;
}

export interface ApprovalResult {
  approved: boolean;
  /** True when the request is queued and awaiting an async human decision. */
  pending: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  channel: string;
  note?: string;
}

export type Approver = (req: ApprovalRequest) => Promise<ApprovalResult>;

let approver: Approver | null = null;

/**
 * Register the approval backend. The parent LAPS service calls this at startup
 * with its Teams-hook-backed implementation. Left unregistered, the gate
 * fails closed (see requestApproval).
 */
export function registerApprover(fn: Approver): void {
  approver = fn;
}

export async function requestApproval(req: ApprovalRequest): Promise<ApprovalResult> {
  if (approver) return approver(req);
  // No approver wired → fail closed. The send is not approved; the caller is
  // expected to persist a draft for manual review.
  return {
    approved: false,
    pending: true,
    approvedBy: null,
    approvedAt: null,
    channel: "unwired",
    note:
      "No HITL approver registered. Draft withheld for manual review. Wire the " +
      "LAPS Teams PreToolUse hook via registerApprover() to enable approvals.",
  };
}
