/**
 * Client-side push notification utilities for Ciseau Noir.
 *
 * Handles service-worker registration, permission request,
 * subscription creation, and persisting the subscription to Supabase
 * via the /api/push/subscribe endpoint.
 */

/** Check if the browser supports push notifications */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Register the service worker if not already registered */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    return registration;
  } catch (err) {
    console.error("[push] Service worker registration failed:", err);
    return null;
  }
}

/** Request notification permission from the user */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Subscribe the user to push notifications.
 * Returns the PushSubscription or null on failure.
 *
 * NOTE: NEXT_PUBLIC_VAPID_PUBLIC_KEY must be set in the environment
 * for encrypted push to work. If not set, subscription is created
 * without applicationServerKey (works for testing, not production).
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  if (!registration) return null;

  const permission = await requestNotificationPermission();
  if (permission !== "granted") return null;

  try {
    // Wait for the service worker to be ready
    const ready = await navigator.serviceWorker.ready;

    const subscribeOptions: PushSubscriptionOptionsInit = {
      userVisibleOnly: true,
    };

    // Use VAPID public key if available
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (vapidKey) {
      subscribeOptions.applicationServerKey = urlBase64ToUint8Array(vapidKey) as BufferSource;
    }

    const subscription = await ready.pushManager.subscribe(subscribeOptions);
    return subscription;
  } catch (err) {
    console.error("[push] Subscription failed:", err);
    return null;
  }
}

/**
 * Save a push subscription to the backend (Supabase via API route).
 * Optionally links it to a client email.
 */
export async function saveSubscription(
  subscription: PushSubscription,
  clientEmail?: string
): Promise<boolean> {
  try {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        client_email: clientEmail || "",
      }),
    });

    if (!response.ok) {
      console.error("[push] Failed to save subscription:", await response.text());
      return false;
    }

    return true;
  } catch (err) {
    console.error("[push] Failed to save subscription:", err);
    return false;
  }
}

/**
 * Full flow: subscribe + save in one call.
 * Returns true if successful, false otherwise.
 */
export async function subscribeAndSave(clientEmail?: string): Promise<boolean> {
  const subscription = await subscribeToPush();
  if (!subscription) return false;

  return saveSubscription(subscription, clientEmail);
}

/** Convert a URL-safe base64 string to a Uint8Array (for VAPID key) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
