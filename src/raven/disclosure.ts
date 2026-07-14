/**
 * On-behalf-of disclosure, never-impersonate enforcement, retired-language
 * guard, and pricing redaction (§4).
 *
 * These rules are load-bearing: every outbound message is signed as the human
 * deal owner with an explicit AI-assistance footer, never as "Raven" the
 * persona and never impersonating the human. Content is checked for retired
 * phrases before send, and pricing-adjacent drafts have figures redacted.
 */
import { RETIRED_LANGUAGE } from "./persona.js";

const FOOTER_MARKER = "Correspondence handled on";

/** Sign-off block appended to every outbound message (§4). */
export function buildSignature(ownerName: string): string {
  const owner = ownerName.trim();
  return (
    `<p style="margin-top:16px;">${escapeHtml(owner)} | Edler Zain</p>` +
    `<p style="margin-top:8px;color:#666;font-size:12px;">` +
    `Correspondence handled on ${escapeHtml(owner)}'s behalf by Raven, ` +
    `Edler Zain's LAPS Sales Coordinator.</p>`
  );
}

/**
 * Append the owner sign-off + disclosure footer to a draft body, unless the
 * footer is already present (idempotent — safe to call more than once).
 */
export function applyDisclosure(bodyHtml: string, ownerName: string): string {
  if (bodyHtml.includes(FOOTER_MARKER)) return bodyHtml;
  return `${bodyHtml}\n${buildSignature(ownerName)}`;
}

export interface ContentCheck {
  ok: boolean;
  violations: string[];
}

/**
 * Reject copy that (a) uses retired language, (b) claims to *be* the human
 * owner, or (c) fronts "Raven" as an independent sender identity. Returns all
 * violations found so the caller can block the send and surface them.
 */
export function checkContent(bodyHtml: string, ownerName: string): ContentCheck {
  const violations: string[] = [];
  const lower = bodyHtml.toLowerCase();

  for (const phrase of RETIRED_LANGUAGE) {
    if (lower.includes(phrase.toLowerCase())) {
      violations.push(`Retired language: "${phrase}"`);
    }
  }

  // Never claim to *be* the human owner (§4). First-person identity claims in
  // the owner's name read as impersonation.
  const owner = ownerName.trim();
  if (owner) {
    const first = owner.split(/\s+/)[0].toLowerCase();
    const impersonationPatterns = [
      `i am ${owner.toLowerCase()}`,
      `this is ${owner.toLowerCase()}`,
      `my name is ${owner.toLowerCase()}`,
      `i'm ${first},`,
      `i am ${first},`,
    ];
    for (const p of impersonationPatterns) {
      if (lower.includes(p)) {
        violations.push(`Impersonation of ${owner}: "${p}"`);
      }
    }
  }

  // Don't front Raven as a freestanding sender identity (§4). A disclosure
  // footer mentioning Raven is fine (checkContent runs before disclosure is
  // appended), but a first-person "I'm Raven"/signature as Raven is not.
  const ravenAsSender = [
    "i am raven",
    "i'm raven",
    "this is raven",
    "regards,\nraven",
    "best,\nraven",
    "— raven",
    "raven | edler zain",
  ];
  for (const p of ravenAsSender) {
    if (lower.includes(p)) {
      violations.push(`Raven fronted as sender identity: "${p.replace(/\n/g, " ")}"`);
    }
  }

  return { ok: violations.length === 0, violations };
}

export interface RedactionResult {
  text: string;
  redactedCount: number;
}

/**
 * Redact concrete monetary figures from pricing-adjacent drafts (§5): Raven
 * may acknowledge a pricing question but must never state an actual figure —
 * that's the deal owner's call. Replaces "$1,200", "1200 dollars", "12k", etc.
 * with a placeholder so a human fills in (or removes) the number on review.
 */
export function redactPricing(text: string): RedactionResult {
  let count = 0;
  const placeholder = "[figure withheld — owner to confirm]";
  let out = text.replace(/\$\s?\d[\d,]*(\.\d+)?(\s?(k|m))?\b/gi, () => {
    count += 1;
    return placeholder;
  });
  out = out.replace(/\b\d[\d,]*(\.\d+)?\s?(dollars|usd)\b/gi, () => {
    count += 1;
    return placeholder;
  });
  out = out.replace(/\b\d{2,3}\s?k\b(?=[^a-z]|$)/gi, () => {
    count += 1;
    return placeholder;
  });
  return { text: out, redactedCount: count };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
