/**
 * Lightweight HTTP helpers wrapping native fetch for API calls.
 */

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export async function apiGet<T = unknown>(
  url: string,
  headers: Record<string, string>,
): Promise<ApiResponse<T>> {
  const res = await fetch(url, { method: "GET", headers });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function apiPost<T = unknown>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function apiPatch<T = unknown>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export async function apiDelete<T = unknown>(
  url: string,
  headers: Record<string, string>,
): Promise<ApiResponse<T>> {
  const res = await fetch(url, { method: "DELETE", headers });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}
