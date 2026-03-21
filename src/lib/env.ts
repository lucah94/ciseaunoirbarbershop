const requiredServerVars = [
  "RESEND_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
] as const;

const requiredPublicVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const missing: string[] = [];

for (const key of requiredPublicVars) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

// Only validate server-side vars when running on the server (not during client build)
if (typeof window === "undefined") {
  for (const key of requiredServerVars) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
}

if (missing.length > 0) {
  console.warn(
    `[env] Missing environment variables: ${missing.join(", ")}. Some features may not work.`
  );
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? "",
} as const;
