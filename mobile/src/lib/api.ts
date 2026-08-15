import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://nyumba-pap-bew3p.deployments.nisoko.co.ke").replace(/\/$/, "");
const SESSION_KEY = "nyumbapap.mobile-session.v1";
const DEVICE_KEY = "nyumbapap.mobile-device.v1";
let csrf: string | null = null;

async function deviceId() {
  const stored = await SecureStore.getItemAsync(DEVICE_KEY);
  if (stored) return stored;
  const created = `${Crypto.randomUUID()}-${Crypto.randomUUID()}`;
  await SecureStore.setItemAsync(DEVICE_KEY, created);
  return created;
}

export async function sessionToken() { return SecureStore.getItemAsync(SESSION_KEY); }
export async function saveSession(token: string) { await SecureStore.setItemAsync(SESSION_KEY, token); }
export async function clearSession() { await SecureStore.deleteItemAsync(SESSION_KEY); }

async function csrfToken(force = false) {
  if (force) csrf = null;
  if (csrf) return csrf;
  const response = await fetch(`${API_BASE}/api/auth/csrf`, { headers: { "x-nyumbapap-client": "expo", "x-nyumbapap-device": await deviceId() } });
  const body = await response.json() as { token?: string };
  if (!response.ok || !body.token) throw new Error("Could not initialize request security");
  csrf = body.token;
  return csrf;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-nyumbapap-client", "expo");
  headers.set("x-nyumbapap-device", await deviceId());
  const token = await sessionToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("x-csrf-token", await csrfToken());
  const response = await fetch(`${API_BASE}/api/${path.replace(/^\/?api\/?|^\//, "")}`, { ...init, headers });
  if (response.status === 403 && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("x-csrf-token", await csrfToken(true));
    return fetch(`${API_BASE}/api/${path.replace(/^\/?api\/?|^\//, "")}`, { ...init, headers });
  }
  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}) {
  const response = await apiFetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}

export function absoluteMediaUrl(url: string | null | undefined) {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}
