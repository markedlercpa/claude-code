/**
 * Message classification & routing (§5).
 *
 * Rules-based, deterministic, and auditable — no model call required, so the
 * routing decision is reproducible and cheap. A message is tagged into exactly
 * one category, which maps to an action: auto-send, HITL (draft + route for
 * approval), or escalate (hand to a human, send nothing automatically).
 *
 * Precedence is SAFETY-FIRST: escalation signals win over everything, then
 * pricing, then persuasion / first-touch, before the low-risk transactional
 * categories. When in doubt the classifier escalates rather than guessing.
 */

export type Category =
  | "scheduling"
  | "reminder"
  | "post_call_followup"
  | "first_touch"
  | "persuasive"
  | "pricing_adjacent"
  | "escalation";

export type Action = "auto_send" | "hitl" | "escalate";

export interface ClassifyInput {
  /** Free text to classify — subject + body (or preview) concatenated. */
  text: string;
  /**
   * True if this is the first outbound touch on the thread (no prior reply
   * from Edler Zain). The caller usually knows this from thread history; when
   * unknown, leave undefined and the text heuristics still apply.
   */
  isFirstTouch?: boolean;
  /**
   * Optional caller-provided hint for categories that are hard to detect from
   * text alone (e.g. a reminder generated on a T-24h timer, or a follow-up
   * built from a Fireflies transcript). Honored unless an escalation or
   * pricing signal overrides it.
   */
  hint?: Category;
}

export interface ClassifyResult {
  category: Category;
  action: Action;
  /** True when content must be drafted with fee/figure redaction (§5). */
  requiresPricingRedaction: boolean;
  /** Human-readable trace of which signals fired, for the audit log. */
  rationale: string;
}

const ESCALATION_SIGNALS = [
  "angry",
  "upset",
  "frustrat", // frustrated / frustrating
  "disappointed",
  "unacceptable",
  "ridiculous",
  "complaint",
  "escalate",
  "lawyer",
  "lawsuit",
  "refund",
  "cancel my",
  "cancel our",
  "cancel the",
  "asap",
  "urgent",
  "immediately",
  "right away",
  "not happy",
  "no longer interested",
];

// Out-of-scope technical questions Raven must defer rather than answer (§4).
const OUT_OF_SCOPE_TECHNICAL = [
  "gaap",
  "asc ",
  "deferred revenue",
  "ebitda adjustment",
  "quality of earnings method",
  "tax treatment",
  "depreciation schedule",
  "k-1",
  "capital gains",
  "section 179",
];

const PRICING_SIGNALS = [
  "price",
  "pricing",
  "cost",
  "how much",
  "fee",
  "fees",
  "quote",
  "discount",
  "rate",
  "retainer",
  "proposal",
  "contract",
  "engagement letter",
  "scope of work",
  "budget",
  "invoice",
];

const PERSUASIVE_SIGNALS = [
  "move forward",
  "ready to sign",
  "let's close",
  "why you should",
  "don't miss",
  "limited time",
  "act now",
  "last chance",
  "convince",
  "make the case",
];

const SCHEDULING_SIGNALS = [
  "reschedule",
  "move to",
  "move our",
  "push to",
  "availability",
  "available",
  "calendar",
  "book a",
  "schedule",
  "set up a call",
  "set up a meeting",
  "what time",
  "does that time",
  "works for me",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "confirm our",
  "confirm the meeting",
];

const REMINDER_SIGNALS = ["reminder", "t-24", "tomorrow's call", "quick reminder"];

const POST_CALL_SIGNALS = [
  "action items",
  "recap",
  "follow up from our call",
  "following up from our",
  "great talking",
  "transcript",
  "next steps from",
];

function contains(haystack: string, needles: readonly string[]): string[] {
  return needles.filter((n) => haystack.includes(n));
}

export function classifyMessage(input: ClassifyInput): ClassifyResult {
  const text = (input.text ?? "").toLowerCase();

  const escalationHits = [
    ...contains(text, ESCALATION_SIGNALS),
    ...contains(text, OUT_OF_SCOPE_TECHNICAL),
  ];
  const pricingHits = contains(text, PRICING_SIGNALS);

  // 1. Escalation wins outright — frustration, urgency, ambiguity, or an
  //    out-of-scope technical question. No auto draft is sent (§5).
  if (escalationHits.length > 0) {
    return {
      category: "escalation",
      action: "escalate",
      requiresPricingRedaction: pricingHits.length > 0,
      rationale: `Escalation signals: ${escalationHits.join(", ")}`,
    };
  }

  // 2. Pricing-adjacent — HITL, and any drafted content must strip figures.
  if (pricingHits.length > 0) {
    return {
      category: "pricing_adjacent",
      action: "hitl",
      requiresPricingRedaction: true,
      rationale: `Pricing signals: ${pricingHits.join(", ")}`,
    };
  }

  // 3. First-touch / persuasive — always HITL.
  const persuasiveHits = contains(text, PERSUASIVE_SIGNALS);
  if (input.isFirstTouch === true || input.hint === "first_touch") {
    return {
      category: "first_touch",
      action: "hitl",
      requiresPricingRedaction: false,
      rationale: "First outbound touch on thread — HITL required (§5).",
    };
  }
  if (persuasiveHits.length > 0 || input.hint === "persuasive") {
    return {
      category: "persuasive",
      action: "hitl",
      requiresPricingRedaction: false,
      rationale: persuasiveHits.length
        ? `Persuasive signals: ${persuasiveHits.join(", ")}`
        : "Caller flagged as persuasive.",
    };
  }

  // 4. Low-risk transactional categories. Caller hint is honored here since
  //    timer-driven reminders and transcript-driven follow-ups aren't always
  //    detectable from text.
  if (input.hint === "post_call_followup" || contains(text, POST_CALL_SIGNALS).length) {
    return {
      category: "post_call_followup",
      action: "auto_send",
      requiresPricingRedaction: false,
      rationale:
        "Post-call follow-up — defer to the post-call-routing skill for " +
        "content; Raven handles the send step only.",
    };
  }
  if (input.hint === "reminder" || contains(text, REMINDER_SIGNALS).length) {
    return {
      category: "reminder",
      action: "auto_send",
      requiresPricingRedaction: false,
      rationale: "Pre-call reminder.",
    };
  }
  if (input.hint === "scheduling" || contains(text, SCHEDULING_SIGNALS).length) {
    return {
      category: "scheduling",
      action: "auto_send",
      requiresPricingRedaction: false,
      rationale: "Scheduling / confirmation request.",
    };
  }

  // 5. Ambiguous — nothing matched. Per §4, escalate rather than guess.
  return {
    category: "escalation",
    action: "escalate",
    requiresPricingRedaction: false,
    rationale: "No category matched with confidence — escalating per §4 (do not guess).",
  };
}
