/**
 * Microsoft Graph client for Raven, scoped to the dedicated LAPS shared
 * mailbox (raven@edlerzain.com).
 *
 * Unlike src/outlook/client.ts — which uses *delegated* auth against `/me/*`
 * for a single interactive user — this client uses the OAuth2
 * **client-credentials** grant (application permissions Mail.Send +
 * Mail.ReadWrite) and addresses the mailbox explicitly via
 * `/users/{mailbox}/...`.
 *
 * The app registration MUST be constrained by an Exchange Online Application
 * Access Policy so these application permissions can only touch the Raven
 * mailbox, not the whole tenant. See docs/raven.md §3.4.
 */
import { config } from "../config.js";
import { apiGet, apiPost } from "../http.js";

// ── Token cache (client-credentials) ────────────────────────

let cachedToken = "";
let cachedTokenExpiresAt = 0; // epoch ms

async function getAppToken(nowMs: number): Promise<string> {
  // Reuse the cached token until ~60s before expiry.
  if (cachedToken && nowMs < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }
  const { clientId, clientSecret, tenantId } = config.raven;
  if (!clientId || !clientSecret || !tenantId) {
    throw new Error(
      "Raven Graph auth is not configured. Set RAVEN_CLIENT_ID / " +
        "RAVEN_CLIENT_SECRET / RAVEN_TENANT_ID (or the shared MICROSOFT_* " +
        "equivalents). See docs/raven.md §3.",
    );
  }
  const tokenEndpoint = `${config.microsoft.tokenUrl}/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Raven token request failed: ${data.error_description ?? data.error ?? res.statusText}`,
    );
  }
  cachedToken = data.access_token;
  cachedTokenExpiresAt = nowMs + (data.expires_in ?? 3600) * 1000;
  return cachedToken;
}

async function authHeaders(nowMs: number): Promise<Record<string, string>> {
  const token = await getAppToken(nowMs);
  return { Authorization: `Bearer ${token}`, Accept: "application/json" };
}

const graph = (path: string) => `${config.microsoft.graphBaseUrl}${path}`;
const mailboxPath = (suffix: string) =>
  `/users/${encodeURIComponent(config.raven.mailbox)}${suffix}`;

// ── Messages ────────────────────────────────────────────────

export interface RavenMessage {
  id: string;
  subject?: string;
  from?: { emailAddress: { name?: string; address: string } };
  toRecipients?: { emailAddress: { name?: string; address: string } }[];
  receivedDateTime?: string;
  bodyPreview?: string;
  conversationId?: string;
  isRead?: boolean;
  [key: string]: unknown;
}

interface GraphList<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

/** List messages in the Raven mailbox (defaults to inbox, newest first). */
export async function listMessages(
  nowMs: number,
  params?: { folder?: string; top?: number; filter?: string; search?: string },
) {
  const folder = params?.folder ?? "inbox";
  const qp = new URLSearchParams();
  qp.set("$top", String(params?.top ?? 25));
  qp.set("$orderby", "receivedDateTime desc");
  qp.set(
    "$select",
    "id,subject,from,toRecipients,receivedDateTime,bodyPreview,conversationId,isRead",
  );
  if (params?.filter) qp.set("$filter", params.filter);
  if (params?.search) qp.set("$search", `"${params.search}"`);
  return apiGet<GraphList<RavenMessage>>(
    graph(mailboxPath(`/mailFolders/${folder}/messages?${qp.toString()}`)),
    await authHeaders(nowMs),
  );
}

/** Fetch one message (full body) from the Raven mailbox. */
export async function getMessage(nowMs: number, messageId: string) {
  return apiGet<RavenMessage>(
    graph(mailboxPath(`/messages/${messageId}`)),
    await authHeaders(nowMs),
  );
}

export interface SendParams {
  subject: string;
  bodyHtml: string;
  to: string[];
  cc?: string[];
  replyToInternetMessageId?: string;
}

/**
 * Send mail directly from the Raven mailbox. This is the tool call the HITL
 * gate protects — callers must go through raven/hitl.ts, never call this
 * unconditionally.
 */
export async function sendMail(nowMs: number, p: SendParams) {
  const message = {
    subject: p.subject,
    body: { contentType: "HTML", content: p.bodyHtml },
    toRecipients: p.to.map((address) => ({ emailAddress: { address } })),
    ccRecipients: p.cc?.map((address) => ({ emailAddress: { address } })),
  };
  return apiPost(
    graph(mailboxPath("/sendMail")),
    await authHeaders(nowMs),
    { message, saveToSentItems: true },
  );
}

/**
 * Create an unsent draft in the Raven mailbox instead of sending. Used when a
 * message is gated for HITL or held pending owner assignment (Section 6).
 * Returns the created draft (including its id and webLink) so a human can open
 * and send it from Outlook after review.
 */
export async function createDraft(nowMs: number, p: SendParams) {
  const draft: Record<string, unknown> = {
    subject: p.subject,
    body: { contentType: "HTML", content: p.bodyHtml },
    toRecipients: p.to.map((address) => ({ emailAddress: { address } })),
  };
  if (p.cc?.length) {
    draft.ccRecipients = p.cc.map((address) => ({ emailAddress: { address } }));
  }
  return apiPost<{ id: string; webLink?: string }>(
    graph(mailboxPath("/messages")),
    await authHeaders(nowMs),
    draft,
  );
}
