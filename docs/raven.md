# Raven — LAPS Sales Coordinator Agent

Raven is an email-handling agent for the LAPS pipeline (Leads → Appointments →
Presentations → Sales). It reads and sends correspondence from a dedicated
shared mailbox **on behalf of a named human deal owner**, with AI-assistance
disclosed on every message. It handles scheduling, confirmations, reminders and
follow-ups — it does **not** close deals, quote pricing, or answer technical
tax/QoE questions.

This document covers what was built in code and — importantly — what must be
provisioned **out-of-band** (M365/Azure tenant admin work that can't happen from
a repo), plus the decisions still open for Mark.

---

## What's in this repo

Raven ships as the `src/raven/` module of the Executive Assistant MCP server.

| File | Responsibility (handoff §) |
|---|---|
| `graph.ts` | Graph **application** (client-credentials) client scoped to the shared mailbox — send / read / draft (§3.5) |
| `persona.ts` | Verbatim system prompt + retired-language / escalation constants (§4) |
| `classifier.ts` | Deterministic message classification → routing action (§5) |
| `attribution.ts` | HubSpot deal-owner lookup + configurable fallback (§6) |
| `disclosure.ts` | On-behalf-of footer, never-impersonate guard, retired-language guard, pricing redaction (§4/§5) |
| `hitl.ts` | Human-in-the-loop gate + pluggable approver seam (§5/§9) |
| `logging.ts` | JSONL audit trail (§7) |
| `tools.ts` | MCP tools wiring it together |

### MCP tools

- `raven_get_persona` — returns the verbatim system prompt.
- `raven_list_inbox` / `raven_get_message` — read the shared mailbox.
- `raven_classify_message` — classify + route a candidate message.
- `raven_resolve_owner` — resolve the attributed human owner.
- `raven_compose_email` — draft with guards + disclosure (no send).
- `raven_handle_email` — **primary entry point**: classify → resolve owner →
  compose → HITL gate → send / draft / escalate → audit.

Plus the `raven_handle_lead` prompt template in `src/index.ts`.

---

## Architecture note (read this)

The handoff describes Raven as a sub-agent inside a *Dockerized Claude Agent SDK
service under an "Alfred" orchestrator*, reusing an existing *Teams PreToolUse
hook* for HITL and existing HubSpot / LAPS-webhook infrastructure. **None of
that infrastructure exists in this repository** — this repo is a single stdio
MCP server (Karbon + Outlook + reporting). So:

- Raven's **logic** (classification, attribution, disclosure, gating, logging,
  Graph send/read) is implemented here as reusable modules + MCP tools.
- The **HITL delivery** is left as a clean seam (`registerApprover()` in
  `hitl.ts`). This repo does **not** contain a working Teams integration; the
  parent service registers its Teams-hook-backed approver at startup. Until one
  is registered, the gate **fails closed** — nothing auto-sends; drafts are
  held for manual review.
- When Raven runs under the Agent SDK service, wire the existing Teams
  PreToolUse hook to intercept the `raven_send_email`/`raven_handle_email` tool
  call rather than forking a new approval path (§5).

---

## Out-of-band provisioning (§3) — cannot be done from this repo

These are Microsoft 365 / Azure tenant-admin tasks. Do them before Raven can
send real mail; the code will surface a clear config error until then.

### 3.1 Mailbox
Create the shared mailbox `raven@edlerzain.com`. Do not license it as a
standalone user unless calendar/Teams presence is needed later (open question).

### 3.2 App registration
Register **"Raven LAPS Agent"**; record `client_id`, `tenant_id`. Use a
**certificate** (not a client secret) for the production credential; a secret is
acceptable for initial dev/test.

### 3.3 API permissions (application, not delegated)
Microsoft Graph: `Mail.Send`, `Mail.ReadWrite`. Grant tenant admin consent.

### 3.4 Application Access Policy — **mandatory, do not skip**
Scope the app to the Raven mailbox only, so its application permissions can't
touch the rest of the tenant:

```powershell
Connect-ExchangeOnline

New-DistributionGroup -Name "Raven-Mailbox-Scope" -Type Security
Add-DistributionGroupMember -Identity "Raven-Mailbox-Scope" -Member "raven@edlerzain.com"

New-ApplicationAccessPolicy `
  -AppId "<client_id>" `
  -PolicyScopeGroupId "Raven-Mailbox-Scope" `
  -AccessRight RestrictAccess `
  -Description "Restrict Raven LAPS agent to its own mailbox only"

Test-ApplicationAccessPolicy -AppId "<client_id>" -Identity "raven@edlerzain.com"   # expect: Granted
Test-ApplicationAccessPolicy -AppId "<client_id>" -Identity "<any other mailbox>"    # expect: Denied
```

**Acceptance check:** the second `Test-ApplicationAccessPolicy` must return
**Denied** before this is considered done.

### 3.5 Auth flow (implemented in `graph.ts`)
OAuth2 client-credentials, scope `https://graph.microsoft.com/.default`.
Send → `POST /users/raven@edlerzain.com/sendMail`; read →
`GET /users/raven@edlerzain.com/messages`. A Graph subscription/webhook for
new-mail events is preferable to polling if the parent infra supports it —
check the `ms-graph-api` skill / existing LAPS webhook handling before building
a poller.

---

## Configuration

See `.env.example` for the full list. Key Raven vars:

| Var | Purpose |
|---|---|
| `RAVEN_MAILBOX` | Shared mailbox address (default `raven@edlerzain.com`) |
| `RAVEN_CLIENT_ID` / `RAVEN_CLIENT_SECRET` / `RAVEN_TENANT_ID` | Raven app registration (falls back to `MICROSOFT_*`) |
| `HUBSPOT_ACCESS_TOKEN` | Deal-owner lookup; if unset, attribution skips HubSpot |
| `DEFAULT_OWNER_ON_UNASSIGNED` | **Open decision (§6)** — default owner for unassigned leads; blank = hold as unsigned draft |
| `RAVEN_HOLD_UNASSIGNED_AS_DRAFT` | Hold unassigned leads as drafts (default true) |
| `RAVEN_SOFT_LAUNCH_GATE_ALL` | **§9** route 100% of sends through HITL (default true) |
| `RAVEN_AUDIT_LOG_PATH` | JSONL audit destination (§7) |

---

## Soft launch (§9)

Ship with `RAVEN_SOFT_LAUNCH_GATE_ALL=true`: **every** send routes through HITL
regardless of category for the first 1–2 weeks. Once low-risk categories
(confirmations, reminders) are quality-proven, set it to `false` so those
auto-send while first-touch / persuasive / pricing-adjacent stay gated.

Deliverability (§8): confirm SPF/DKIM/DMARC cover `edlerzain.com` and that
Graph-sent mail from the shared mailbox passes them; ramp volume gradually; keep
Raven's mailbox reputation isolated from Smartlead's cold-sequence domains.

---

## Open questions for Mark (do not guess — §10)

1. **Default owner on unassigned lead (§6):** default to Jon Bock (closer) or
   hold as unsigned draft until HubSpot assigns an owner? Currently
   configurable via `DEFAULT_OWNER_ON_UNASSIGNED`; **defaults to hold-as-draft**
   (blank) pending decision.
2. **Teams presence:** email-only, or also a licensed mailbox with Teams
   presence? (Affects §3.1 licensing.)
3. **Post-call follow-ups:** route through Raven directly, or keep them in the
   existing `post-call-routing` skill with Raven handling only the send step?
   The classifier currently tags `post_call_followup` and defers content to that
   skill.
