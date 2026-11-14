import type { CalendarResponse, MetaResponse, PredictResponse } from "./types";

const TOKEN_KEY = "reshis_avia_token";
const LOGGED_OUT_KEY = "reshis_avia_logged_out";

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(LOGGED_OUT_KEY);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(LOGGED_OUT_KEY, "1");
}

export function wasExplicitlyLoggedOut(): boolean {
  return localStorage.getItem(LOGGED_OUT_KEY) === "1";
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  onUnauthorized?: () => void
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401 && onUnauthorized) {
    onUnauthorized();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Ошибка сервера (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export async function demoLoginRequest(): Promise<{
  token: string;
  user: { email: string };
}> {
  const res = await fetch("/api/demo-login", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Ошибка демо-входа");
  return data;
}

export function loginRequest(email: string, password: string) {
  return apiFetch<{ token: string; user: { email: string } }>("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function registerRequest(email: string, password: string) {
  return apiFetch<{ token: string; user: { email: string } }>("/api/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(onUnauthorized?: () => void) {
  return apiFetch<{ email: string }>("/api/me", {}, onUnauthorized);
}

export function fetchMeta(onUnauthorized?: () => void) {
  return apiFetch<MetaResponse>("/api/meta", {}, onUnauthorized);
}

export function predictRequest(
  payload: { origin: string; destination: string; date: string; price: number },
  onUnauthorized?: () => void
) {
  return apiFetch<PredictResponse>(
    "/api/predict",
    { method: "POST", body: JSON.stringify(payload) },
    onUnauthorized
  );
}

export function fetchCalendar(route: string, onUnauthorized?: () => void) {
  return apiFetch<CalendarResponse>(
    `/api/calendar?route=${encodeURIComponent(route)}`,
    {},
    onUnauthorized
  );
}
