import { cookies } from "next/headers";

const apiBaseUrl = (process.env.API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

export async function backendFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookieHeader = (await cookies()).toString();
  if (cookieHeader) headers.set("cookie", cookieHeader);

  return fetch(`${apiBaseUrl}/api/${path.replace(/^\/?api\/?|^\//, "")}`, {
    ...init,
    headers,
    cache: init.cache ?? "no-store"
  });
}
