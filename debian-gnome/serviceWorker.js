async function handleFetch(request) {
  let response;
  try {
    response = await fetch(request);
  } catch (e) {
    console.error(e);
    throw e;
  }

  if (response.status === 0) return response;

  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  if (response.redirected) headers.set("location", response.url);

  return new Response(response.redirected ? null : response.body, {
    headers,
    status: response.redirected ? 301 : response.status,
    statusText: response.statusText,
  });
}

function initWorker() {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
  self.addEventListener("fetch", (e) => {
    try {
      e.respondWith(handleFetch(e.request));
    } catch (err) {
      console.error("Service worker fetch error:", err);
    }
  });
}

async function registerWorker() {
  if (window.crossOriginIsolated) return;
  if (!window.isSecureContext) return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register(
      window.document.currentScript.src
    );

    registration.addEventListener("updatefound", () => {
      try { window.location.reload(); } catch {}
    });

    if (registration.active && !navigator.serviceWorker.controller) {
      try { window.location.reload(); } catch {}
    }
  } catch (e) {
    console.error("Service worker registration failed:", e);
  }
}

if (typeof window === "undefined") initWorker();
else registerWorker();
