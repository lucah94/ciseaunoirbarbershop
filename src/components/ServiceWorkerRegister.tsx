"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker ET force un reload quand une nouvelle version
 * est activée. Critique pour mobile où le cache JS est très agressif.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let didReload = false;
    const reloadOnce = () => {
      if (didReload) return;
      didReload = true;
      window.location.reload();
    };

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.addEventListener("updatefound", () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener("statechange", () => {
          if (newSW.state === "activated" && navigator.serviceWorker.controller) {
            reloadOnce();
          }
        });
      });
      reg.update().catch(() => {});
    }).catch((err) => {
      console.error("[sw] Registration failed:", err);
    });

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") reloadOnce();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
