import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RAVEN_SYSTEM_PROMPT, ESCALATION_CONTACTS } from "./persona.js";
import { classifyMessage, type Category } from "./classifier.js";
import { resolveOwner } from "./attribution.js";
import { applyDisclosure, checkContent, redactPricing } from "./disclosure.js";
import { resolveGate, requestApproval } from "./hitl.js";
import { writeAudit, type Disposition } from "./logging.js";
import * as graph from "./graph.js";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (o: unknown) => text(JSON.stringify(o, null, 2));

const CATEGORY_HINTS = [
  "scheduling",
  "reminder",
  "post_call_followup",
  "first_touch",
  "persuasive",
  "pricing_adjacent",
  "escalation",
] as const;

export function registerRavenTools(server: McpServer) {
  // ── Persona ──────────────────────────────────────────────
  server.tool(
    "raven_get_persona",
    "Return Raven's verbatim system prompt (§4) for wiring into the agent's model context.",
    {},
    async () => text(RAVEN_SYSTEM_PROMPT),
  );

  // ── Read the shared mailbox ──────────────────────────────
  server.tool(
    "raven_list_inbox",
    "List recent messages in the Raven shared mailbox (raven@edlerzain.com) via Graph application auth.",
    {
      top: z.number().optional().describe("Max messages (default 25)"),
      unreadOnly: z.boolean().optional().describe("Only unread messages"),
      search: z.string().optional().describe("Free-text search over subject/body/participants"),
    },
    async ({ top, unreadOnly, search }) => {
      const res = await graph.listMessages(Date.now(), {
        top,
        search,
        filter: unreadOnly ? "isRead eq false" : undefined,
      });
      if (!res.ok) return text(`Error ${res.status}: ${JSON.stringify(res.data)}`);
      const messages = (res.data as { value?: graph.RavenMessage[] }).value ?? [];
      return json(
        messages.map((m) => ({
          id: m.id,
          subject: m.subject,
          from: m.from?.emailAddress?.address,
          date: m.receivedDateTime,
          preview: m.bodyPreview?.slice(0, 160),
          isRead: m.isRead,
          conversationId: m.conversationId,
        })),
      );
    },
  );

  server.tool(
    "raven_get_message",
    "Get the full content of one message in the Raven mailbox by id.",
    { messageId: z.string().describe("Graph message id") },
    async ({ messageId }) => {
      const res = await graph.getMessage(Date.now(), messageId);
      if (!res.ok) return text(`Error ${res.status}: ${JSON.stringify(res.data)}`);
      return json(res.data);
    },
  );

  // ── Classification (§5) ──────────────────────────────────
  server.tool(
    "raven_classify_message",
    "Classify a candidate message into a LAPS category and routing action (auto-send / HITL / escalate). Rules-based and deterministic (§5).",
    {
      text: z.string().describe("Subject + body (or preview) to classify"),
      isFirstTouch: z.boolean().optional().describe("First outbound touch on the thread?"),
      hint: z.enum(CATEGORY_HINTS).optional().describe("Optional caller category hint (e.g. timer-driven reminder)"),
    },
    async ({ text: t, isFirstTouch, hint }) => {
      const result = classifyMessage({ text: t, isFirstTouch, hint: hint as Category | undefined });
      return json(result);
    },
  );

  // ── Owner attribution (§6) ───────────────────────────────
  server.tool(
    "raven_resolve_owner",
    "Resolve the attributed human 'on behalf of' owner for a prospect/thread via HubSpot, with the configurable unassigned fallback (§6).",
    {
      prospectEmail: z.string().optional().describe("Prospect email (used to find the HubSpot deal)"),
      dealId: z.string().optional().describe("Known HubSpot deal id (skips the email search)"),
    },
    async ({ prospectEmail, dealId }) => {
      const attribution = await resolveOwner(prospectEmail, dealId);
      return json(attribution);
    },
  );

  // ── Compose (draft only, with guards) ────────────────────
  server.tool(
    "raven_compose_email",
    "Compose an outbound body: redact pricing if needed, enforce never-impersonate + retired-language guards, and append the on-behalf-of disclosure (§4). Does NOT send.",
    {
      ownerName: z.string().describe("Attributed human owner name for the sign-off"),
      subject: z.string().describe("Email subject"),
      bodyHtml: z.string().describe("Draft body (HTML)"),
      redactPricing: z.boolean().optional().describe("Force pricing redaction (auto-on for pricing_adjacent)"),
    },
    async ({ ownerName, subject, bodyHtml, redactPricing: forceRedact }) => {
      let body = bodyHtml;
      let redactedCount = 0;
      if (forceRedact) {
        const r = redactPricing(body);
        body = r.text;
        redactedCount = r.redactedCount;
      }
      const check = checkContent(body, ownerName);
      if (!check.ok) {
        return json({ ok: false, blocked: true, violations: check.violations });
      }
      const finalBody = applyDisclosure(body, ownerName);
      return json({ ok: true, subject, body: finalBody, redactedCount });
    },
  );

  // ── End-to-end handler (§5–§7) ───────────────────────────
  server.tool(
    "raven_handle_email",
    "End-to-end: classify → resolve owner → compose with disclosure/guards → apply the HITL gate → send, draft, or escalate → write the audit record (§5–§7). This is the primary Raven entry point.",
    {
      prospectEmail: z.string().describe("Prospect's email address (recipient + HubSpot lookup)"),
      subject: z.string().describe("Email subject"),
      bodyHtml: z.string().describe("Proposed body (HTML)"),
      threadId: z.string().optional().describe("Conversation/thread id for the audit log"),
      dealId: z.string().optional().describe("Known HubSpot deal id"),
      isFirstTouch: z.boolean().optional().describe("First outbound touch? (forces HITL)"),
      hint: z.enum(CATEGORY_HINTS).optional().describe("Optional category hint"),
      cc: z.array(z.string()).optional().describe("CC recipients"),
    },
    async ({ prospectEmail, subject, bodyHtml, threadId, dealId, isFirstTouch, hint, cc }) => {
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();

      // 1. Classify.
      const cls = classifyMessage({
        text: `${subject}\n${bodyHtml}`,
        isFirstTouch,
        hint: hint as Category | undefined,
      });

      // 2. Resolve owner.
      const attribution = await resolveOwner(prospectEmail, dealId);

      // Helper to record + return consistently.
      const finish = async (disposition: Disposition, extra: Record<string, unknown>, disclosureText: string, body: string) => {
        await writeAudit({
          timestamp: nowIso,
          prospect: prospectEmail,
          threadId: threadId ?? null,
          hubspotDealId: attribution.dealId,
          owner: attribution.ownerName,
          category: cls.category,
          disposition,
          approvedBy: (extra.approvedBy as string) ?? null,
          approvedAt: (extra.approvedAt as string) ?? null,
          disclosureText,
          body,
          subject,
          rationale: `${cls.rationale} | owner: ${attribution.rationale}`,
        });
        return json({
          category: cls.category,
          action: cls.action,
          owner: attribution.ownerName,
          ownerSource: attribution.source,
          hubspotDealId: attribution.dealId,
          disposition,
          ...extra,
        });
      };

      // 3. Escalation → never auto-send. Route to a human.
      if (cls.action === "escalate") {
        return finish(
          "escalated",
          {
            escalatedTo: routingTarget(cls.category, bodyHtml),
            note: "No message auto-sent. Routed to a human per §4/§5.",
            rationale: cls.rationale,
          },
          "",
          bodyHtml,
        );
      }

      // 4. Compose: redact (if pricing) → guard → disclosure.
      let body = bodyHtml;
      if (cls.requiresPricingRedaction) body = redactPricing(body).text;

      const signAs = attribution.ownerName; // may be null if held unsigned
      const check = checkContent(body, signAs ?? "");
      if (!check.ok) {
        return finish(
          "escalated",
          { blocked: true, violations: check.violations, note: "Content guard blocked the send." },
          "",
          body,
        );
      }

      // 5. If owner is unassigned and held → draft, unsigned, regardless of gate (§6).
      if (attribution.holdAsDraft || signAs === null) {
        const draft = await graph.createDraft(nowMs, {
          subject,
          bodyHtml: signAs ? applyDisclosure(body, signAs) : body,
          to: [prospectEmail],
          cc,
        });
        return finish(
          "held_draft",
          {
            draftId: draft.ok ? draft.data.id : null,
            draftWebLink: draft.ok ? draft.data.webLink : null,
            graphOk: draft.ok,
            note: "Held as draft pending owner assignment (§6).",
          },
          "",
          body,
        );
      }

      const disclosed = applyDisclosure(body, signAs);
      const disclosureText = disclosed.slice(body.length);

      // 6. Apply the HITL gate.
      const mode = resolveGate(cls.action);
      if (mode === "auto_send") {
        const res = await graph.sendMail(nowMs, { subject, bodyHtml: disclosed, to: [prospectEmail], cc });
        return finish(
          "auto_sent",
          { graphOk: res.ok, graphStatus: res.status, note: res.ok ? "Sent." : `Send failed: ${JSON.stringify(res.data)}` },
          disclosureText,
          disclosed,
        );
      }

      // mode === "hitl" → request approval.
      const approval = await requestApproval({
        category: cls.category,
        owner: signAs,
        prospect: prospectEmail,
        subject,
        bodyHtml: disclosed,
        hubspotDealId: attribution.dealId,
        rationale: cls.rationale,
      });

      if (approval.approved) {
        const res = await graph.sendMail(nowMs, { subject, bodyHtml: disclosed, to: [prospectEmail], cc });
        return finish(
          "hitl_approved",
          {
            approvedBy: approval.approvedBy,
            approvedAt: approval.approvedAt,
            graphOk: res.ok,
            note: res.ok ? "Approved and sent." : `Approved but send failed: ${JSON.stringify(res.data)}`,
          },
          disclosureText,
          disclosed,
        );
      }

      // Not approved (or pending) → persist a draft for the human.
      const draft = await graph.createDraft(nowMs, { subject, bodyHtml: disclosed, to: [prospectEmail], cc });
      return finish(
        "held_draft",
        {
          draftId: draft.ok ? draft.data.id : null,
          draftWebLink: draft.ok ? draft.data.webLink : null,
          approvalChannel: approval.channel,
          approvalPending: approval.pending,
          note: approval.note ?? "Awaiting HITL approval; draft created.",
        },
        disclosureText,
        disclosed,
      );
    },
  );
}

/** Pick the escalation routing target for the audit log (§4). */
function routingTarget(category: Category, body: string): string {
  const lower = body.toLowerCase();
  if (category === "pricing_adjacent") return `deal owner (${ESCALATION_CONTACTS.deal_owner})`;
  if (/(tax|depreciation|k-1|capital gains|section 179)/.test(lower)) return `Maher (${ESCALATION_CONTACTS.Maher})`;
  if (/(equity|ownership|firm strategy|partner)/.test(lower)) return `Mark (${ESCALATION_CONTACTS.Mark})`;
  return "deal owner";
}
