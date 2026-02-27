import { config } from "../config.js";
import { apiGet, apiPost, apiPatch, apiDelete } from "../http.js";

let accessToken = config.microsoft.accessToken;

function headers() {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

const graph = (path: string) => `${config.microsoft.graphBaseUrl}${path}`;

// ── Token Refresh ───────────────────────────────────────────

export async function refreshAccessToken(): Promise<string> {
  const tokenEndpoint = `${config.microsoft.tokenUrl}/${config.microsoft.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    refresh_token: config.microsoft.refreshToken,
    grant_type: "refresh_token",
    scope: "https://graph.microsoft.com/.default offline_access",
  });

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Token refresh failed: ${data.error ?? res.statusText}`,
    );
  }
  accessToken = data.access_token;
  return accessToken;
}

/** Ensure we have a valid token; refresh if expired. */
async function ensureAuth() {
  if (!accessToken && config.microsoft.refreshToken) {
    await refreshAccessToken();
  }
}

// ── Email Messages ──────────────────────────────────────────

export interface OutlookMessage {
  id: string;
  subject: string;
  from?: { emailAddress: { name: string; address: string } };
  toRecipients?: { emailAddress: { name: string; address: string } }[];
  receivedDateTime?: string;
  bodyPreview?: string;
  body?: { contentType: string; content: string };
  isRead?: boolean;
  importance?: string;
  flag?: { flagStatus: string };
  categories?: string[];
  hasAttachments?: boolean;
  [key: string]: unknown;
}

interface GraphListResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

export async function listMessages(params?: {
  folder?: string;
  top?: number;
  filter?: string;
  search?: string;
  orderBy?: string;
  select?: string;
}) {
  await ensureAuth();
  const folder = params?.folder ?? "inbox";
  const qp = new URLSearchParams();
  if (params?.top) qp.set("$top", String(params.top));
  if (params?.filter) qp.set("$filter", params.filter);
  if (params?.search) qp.set("$search", `"${params.search}"`);
  if (params?.orderBy) qp.set("$orderby", params.orderBy);
  if (params?.select) qp.set("$select", params.select);
  const qs = qp.toString() ? `?${qp.toString()}` : "";
  return apiGet<GraphListResponse<OutlookMessage>>(
    graph(`/me/mailFolders/${folder}/messages${qs}`),
    headers(),
  );
}

export async function getMessage(messageId: string) {
  await ensureAuth();
  return apiGet<OutlookMessage>(graph(`/me/messages/${messageId}`), headers());
}

export async function sendEmail(params: {
  subject: string;
  body: string;
  toRecipients: string[];
  ccRecipients?: string[];
  importance?: "low" | "normal" | "high";
}) {
  await ensureAuth();
  const message = {
    subject: params.subject,
    body: { contentType: "HTML", content: params.body },
    toRecipients: params.toRecipients.map((addr) => ({
      emailAddress: { address: addr },
    })),
    ccRecipients: params.ccRecipients?.map((addr) => ({
      emailAddress: { address: addr },
    })),
    importance: params.importance ?? "normal",
  };
  return apiPost(graph("/me/sendMail"), headers(), { message });
}

export async function replyToEmail(messageId: string, comment: string) {
  await ensureAuth();
  return apiPost(graph(`/me/messages/${messageId}/reply`), headers(), {
    comment,
  });
}

export async function forwardEmail(
  messageId: string,
  toRecipients: string[],
  comment?: string,
) {
  await ensureAuth();
  return apiPost(graph(`/me/messages/${messageId}/forward`), headers(), {
    comment: comment ?? "",
    toRecipients: toRecipients.map((addr) => ({
      emailAddress: { address: addr },
    })),
  });
}

export async function updateMessage(
  messageId: string,
  updates: Partial<Pick<OutlookMessage, "isRead" | "categories" | "flag" | "importance">>,
) {
  await ensureAuth();
  return apiPatch(graph(`/me/messages/${messageId}`), headers(), updates);
}

export async function deleteMessage(messageId: string) {
  await ensureAuth();
  return apiDelete(graph(`/me/messages/${messageId}`), headers());
}

export async function moveMessage(messageId: string, destinationFolder: string) {
  await ensureAuth();
  return apiPost(graph(`/me/messages/${messageId}/move`), headers(), {
    destinationId: destinationFolder,
  });
}

// ── Mail Folders ────────────────────────────────────────────

export interface MailFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
  [key: string]: unknown;
}

export async function listMailFolders() {
  await ensureAuth();
  return apiGet<GraphListResponse<MailFolder>>(
    graph("/me/mailFolders?$top=50"),
    headers(),
  );
}

// ── Calendar Events ─────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  organizer?: { emailAddress: { name: string; address: string } };
  attendees?: { emailAddress: { name: string; address: string }; type: string }[];
  location?: { displayName: string };
  body?: { contentType: string; content: string };
  isAllDay?: boolean;
  [key: string]: unknown;
}

export async function listCalendarEvents(params?: {
  startDateTime?: string;
  endDateTime?: string;
  top?: number;
}) {
  await ensureAuth();
  const qp = new URLSearchParams();
  if (params?.startDateTime && params?.endDateTime) {
    qp.set("startDateTime", params.startDateTime);
    qp.set("endDateTime", params.endDateTime);
  }
  if (params?.top) qp.set("$top", String(params.top));
  const qs = qp.toString() ? `?${qp.toString()}` : "";

  if (params?.startDateTime && params?.endDateTime) {
    return apiGet<GraphListResponse<CalendarEvent>>(
      graph(`/me/calendarView${qs}`),
      headers(),
    );
  }
  return apiGet<GraphListResponse<CalendarEvent>>(
    graph(`/me/events?$top=${params?.top ?? 25}&$orderby=start/dateTime`),
    headers(),
  );
}

export async function createCalendarEvent(params: {
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  body?: string;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
}) {
  await ensureAuth();
  const event: Record<string, unknown> = {
    subject: params.subject,
    start: params.start,
    end: params.end,
    isAllDay: params.isAllDay ?? false,
  };
  if (params.body) event.body = { contentType: "HTML", content: params.body };
  if (params.location) event.location = { displayName: params.location };
  if (params.attendees) {
    event.attendees = params.attendees.map((addr) => ({
      emailAddress: { address: addr },
      type: "required",
    }));
  }
  return apiPost<CalendarEvent>(graph("/me/events"), headers(), event);
}

export async function deleteCalendarEvent(eventId: string) {
  await ensureAuth();
  return apiDelete(graph(`/me/events/${eventId}`), headers());
}
