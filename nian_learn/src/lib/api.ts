export const API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function apiConfigured(): boolean {
  return API_URL.length > 0;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  init: { method: string; body?: unknown; token?: string; familyId?: string },
): Promise<T> {
  const headers = new Headers();
  if (init.body !== undefined) headers.set("content-type", "application/json");
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.familyId) headers.set("x-family-id", init.familyId);
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let message = "后端没有完成这次保存";
      try {
        const parsed = JSON.parse(text) as { error?: string };
        if (parsed.error) message = parsed.error;
      } catch {
        /* 用上面的默认提示 */
      }
      throw new ApiError(res.status, message);
    }
    return (text ? JSON.parse(text) : null) as T;
  } finally {
    window.clearTimeout(timer);
  }
}
