// Composio integration — standalone lib for Ciseau Noir
// Entity: "ciseau-noir-barbershop" — séparé des autres projets Composio
// Pour connecter Facebook/Instagram/GMB: composio.dev → Toolkits → Connect

export const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY ?? "";
export const CISEAU_NOIR_ENTITY = "ciseau-noir-barbershop";

export function isComposioConfigured(): boolean {
  return !!COMPOSIO_API_KEY;
}

// Appel générique vers l'API Composio REST
async function composioRequest(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`https://backend.composio.dev/api/v1${path}`, {
    method,
    headers: {
      "x-api-key": COMPOSIO_API_KEY,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Composio ${method} ${path} → ${res.status}: ${err}`);
  }
  return res.json();
}

export async function listComposioConnections(): Promise<{ app: string; status: string }[]> {
  try {
    const data = await composioRequest(`/connectedAccounts?entityId=${CISEAU_NOIR_ENTITY}`);
    return (data.items ?? []).map((c: { appName: string; status: string }) => ({
      app: c.appName,
      status: c.status,
    }));
  } catch {
    return [];
  }
}

export async function composioExecuteAction(
  action: string,
  params: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const data = await composioRequest(`/actions/${action}/execute`, "POST", {
      entityId: CISEAU_NOIR_ENTITY,
      input: params,
    });
    return { success: true, data };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function composioFacebookPost(message: string) {
  return composioExecuteAction("FACEBOOK_POST_TO_FEED", { message });
}

export async function composioInstagramPost(caption: string, imageUrl?: string) {
  return composioExecuteAction("INSTAGRAM_BASIC_DISPLAY_CREATE_MEDIA", {
    caption,
    ...(imageUrl ? { image_url: imageUrl } : {}),
  });
}
