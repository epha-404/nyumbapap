const CACHE = "nyumbapap-shell-v3";
const SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isPrivate = url.origin === self.location.origin && (/^\/(api|dashboard|account)(\/|$)/).test(url.pathname);
  if (isPrivate) {
    event.respondWith(fetch(event.request).catch(() => new Response("You are offline. Reconnect and try again.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    })));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(async () => (await caches.match(event.request)) || (await caches.match("/offline.html")) || new Response("Offline", { status: 503 })));
    return;
  }
  if (new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(async () => (await caches.match(event.request)) || new Response("Resource unavailable", { status: 503 })));
  }
});
