/**
 * Configuration loaded from environment variables.
 * Copy .env.example to .env and fill in your credentials.
 */
export const config = {
  karbon: {
    accessKey: process.env.KARBON_ACCESS_KEY ?? "",
    bearerToken: process.env.KARBON_BEARER_TOKEN ?? "",
    baseUrl: "https://api.karbonhq.com/v3",
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? "",
    tenantId: process.env.MICROSOFT_TENANT_ID ?? "",
    accessToken: process.env.MICROSOFT_ACCESS_TOKEN ?? "",
    refreshToken: process.env.MICROSOFT_REFRESH_TOKEN ?? "",
    graphBaseUrl: "https://graph.microsoft.com/v1.0",
    tokenUrl: "https://login.microsoftonline.com",
  },
  hubspot: {
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN ?? "",
    baseUrl: "https://api.hubapi.com",
  },
  // ── Raven — LAPS Sales Coordinator agent ──────────────────
  // Raven sends/reads mail from a dedicated M365 SHARED mailbox using
  // Graph *application* (client-credentials) auth — a different flow from
  // the delegated `/me/*` Outlook client above. Provision + scope the app
  // per docs/raven.md (Application Access Policy is mandatory).
  raven: {
    mailbox: process.env.RAVEN_MAILBOX ?? "raven@edlerzain.com",
    // App registration for "Raven LAPS Agent". Falls back to the shared
    // Microsoft app creds if a dedicated registration isn't provided yet.
    clientId: process.env.RAVEN_CLIENT_ID ?? process.env.MICROSOFT_CLIENT_ID ?? "",
    clientSecret:
      process.env.RAVEN_CLIENT_SECRET ?? process.env.MICROSOFT_CLIENT_SECRET ?? "",
    tenantId: process.env.RAVEN_TENANT_ID ?? process.env.MICROSOFT_TENANT_ID ?? "",
    // Section 6 open decision (confirm with Mark). Left BLANK on purpose:
    // when unset, unassigned leads are held as unsigned drafts rather than
    // defaulting to a closer. Set to e.g. "Jon Bock" to default instead.
    defaultOwnerOnUnassigned: process.env.DEFAULT_OWNER_ON_UNASSIGNED ?? "",
    // If no owner can be resolved and no default is set, hold as draft.
    holdUnassignedAsDraft:
      (process.env.RAVEN_HOLD_UNASSIGNED_AS_DRAFT ?? "true") !== "false",
    // Section 9 soft launch: route 100% of sends through HITL regardless of
    // category. Keep ON until low-risk categories are quality-proven.
    softLaunchGateAll:
      (process.env.RAVEN_SOFT_LAUNCH_GATE_ALL ?? "true") !== "false",
    auditLogPath: process.env.RAVEN_AUDIT_LOG_PATH ?? "./logs/raven-audit.jsonl",
  },
} as const;
