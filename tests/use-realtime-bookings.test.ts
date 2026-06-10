/**
 * Tests for src/lib/use-realtime-bookings.ts
 *
 * useRealtimeTable is a React hook that subscribes to Supabase Realtime
 * postgres_changes for N tables, calls onChange() on events, polls every
 * pollMs as a WebSocket disconnect fallback, and cleans up on unmount.
 *
 * Full hook tests need @testing-library/react installed.
 * Run: npm install -D @testing-library/react @testing-library/react-hooks
 */
import { describe, it, expect } from "vitest";

// ─── Export smoke test ────────────────────────────────────────────────────────

describe("useRealtimeTable", () => {
  it.todo("calls supabase.channel() with the provided channelName");
  it.todo("subscribes to postgres_changes for each table in the tables array");
  it.todo("calls onChange when a realtime event fires");
  it.todo("calls supabase.channel().subscribe() to activate the subscription");
  it.todo("sets a polling interval using the provided pollMs value");
  it.todo("calls onChange when the polling interval fires");
  it.todo("calls supabase.removeChannel on hook unmount — no memory leak");
  it.todo("clears the setInterval on hook unmount — no memory leak");
  it.todo("re-subscribes when channelName changes");
  it.todo("re-subscribes when tables array changes");
  it.todo("defaults pollMs to 300000 (5 minutes) when not provided");
});
