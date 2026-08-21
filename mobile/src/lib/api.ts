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

async function authenticatedHeaders(method: string, initial?: HeadersInit, forceCsrf = false) {
  const headers = new Headers(initial);
  headers.set("x-nyumbapap-client", "expo");
  headers.set("x-nyumbapap-device", await deviceId());
  const token = await sessionToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("x-csrf-token", await csrfToken(forceCsrf));
  return headers;
}

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
  const method = (init.method ?? "GET").toUpperCase();
  const headers = await authenticatedHeaders(method, init.headers);
  const response = await fetch(`${API_BASE}/api/${path.replace(/^\/?api\/?|^\//, "")}`, { ...init, headers });
  if (response.status === 403 && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("x-csrf-token", await csrfToken(true));
    return fetch(`${API_BASE}/api/${path.replace(/^\/?api\/?|^\//, "")}`, { ...init, headers });
  }
  return response;
}

type MultipartResponse = Pick<Response, "ok" | "status" | "json" | "text">;

async function sendNativeMultipart(path: string, body: FormData, forceCsrf = false): Promise<MultipartResponse> {
  const headers = await authenticatedHeaders("POST", undefined, forceCsrf);
  const url = `${API_BASE}/api/${path.replace(/^\/?api\/?|^\//, "")}`;
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    headers.forEach((value, key) => request.setRequestHeader(key, value));
    request.timeout = 120_000;
    request.onerror = () => {
      console.error("Native multipart transport failed", { host: new URL(API_BASE).host, path, readyState: request.readyState, status: request.status });
      reject(new Error(`Could not reach the NyumbaPap API at ${new URL(API_BASE).host}. Check your connection and retry.`));
    };
    request.ontimeout = () => reject(new Error("The upload timed out while the image was being processed. Retry this photo."));
    request.onload = () => {
      const responseText = typeof request.responseText === "string" ? request.responseText : "";
      resolve({
        ok: request.status >= 200 && request.status < 300,
        status: request.status,
        text: async () => responseText,
        json: async () => JSON.parse(responseText || "{}")
      });
    };
    // React Native's XHR bridge serializes native {uri,name,type} FormData parts.
    // Expo's WinterCG fetch converter does not, so multipart must stay on XHR.
    request.send(body);
  });
}

export async function apiMultipart(path: string, body: FormData) {
  const response = await sendNativeMultipart(path, body);
  return response.status === 403 ? sendNativeMultipart(path, body, true) : response;
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
