export function apiPath(path: string) {
  return `/api/${path.replace(/^\/?api\/?|^\//, "")}`;
}

let csrfTokenPromise: Promise<string> | null = null;

async function csrfToken(force = false) {
  if (force) csrfTokenPromise = null;
  csrfTokenPromise ??= fetch(apiPath("auth/csrf"), {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store"
  }).then(async (response) => {
    if (!response.ok) throw new Error("Could not initialize request security");
    const body = await response.json() as { token?: string };
    if (!body.token) throw new Error("Missing CSRF token");
    return body.token;
  }).catch((error) => {
    csrfTokenPromise = null;
    throw error;
  });
  return csrfTokenPromise;
}

export async function csrfFetch(path: string, init: RequestInit = {}) {
  async function send(forceToken = false) {
    const token = await csrfToken(forceToken);
    const headers = new Headers(init.headers);
    headers.set("x-csrf-token", token);
    return fetch(apiPath(path), { ...init, headers, credentials: "same-origin" });
  }
  const response = await send();
  if (response.status !== 403) return response;
  return send(true);
}
