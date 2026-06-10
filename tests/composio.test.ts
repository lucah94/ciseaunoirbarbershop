/**
 * Tests for src/lib/composio.ts
 *
 * Covers: isComposioConfigured, listComposioConnections,
 * composioExecuteAction, and the social-specific wrappers.
 *
 * All fetch calls are mocked via vi.stubGlobal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── isComposioConfigured ─────────────────────────────────────────────────────

describe("isComposioConfigured", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("returns false when COMPOSIO_API_KEY is not set", async () => {
    const originalKey = process.env.COMPOSIO_API_KEY;
    delete process.env.COMPOSIO_API_KEY;
    const { isComposioConfigured } = await import("@/lib/composio");
    expect(isComposioConfigured()).toBe(false);
    process.env.COMPOSIO_API_KEY = originalKey;
  });

  it("returns true when COMPOSIO_API_KEY is set to a non-empty string", async () => {
    process.env.COMPOSIO_API_KEY = "test-api-key";
    vi.resetModules();
    const { isComposioConfigured } = await import("@/lib/composio");
    expect(isComposioConfigured()).toBe(true);
    delete process.env.COMPOSIO_API_KEY;
  });
});

// ── listComposioConnections ──────────────────────────────────────────────────

describe("listComposioConnections", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.COMPOSIO_API_KEY = "test-key";
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.COMPOSIO_API_KEY;
    vi.resetModules();
  });

  it("returns mapped connections array on success", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          { appName: "facebook", status: "ACTIVE" },
          { appName: "instagram", status: "PENDING" },
        ],
      }),
    });

    const { listComposioConnections } = await import("@/lib/composio");
    const result = await listComposioConnections();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ app: "facebook", status: "ACTIVE" });
    expect(result[1]).toEqual({ app: "instagram", status: "PENDING" });
  });

  it("returns empty array when response has no items", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const { listComposioConnections } = await import("@/lib/composio");
    const result = await listComposioConnections();
    expect(result).toEqual([]);
  });

  it("returns empty array when fetch throws (error suppressed)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const { listComposioConnections } = await import("@/lib/composio");
    const result = await listComposioConnections();
    expect(result).toEqual([]);
  });

  it("returns empty array when Composio returns non-ok status", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
      statusText: "Forbidden",
    });

    const { listComposioConnections } = await import("@/lib/composio");
    const result = await listComposioConnections();
    expect(result).toEqual([]);
  });
});

// ── composioExecuteAction ────────────────────────────────────────────────────

describe("composioExecuteAction", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.COMPOSIO_API_KEY = "test-key";
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.COMPOSIO_API_KEY;
    vi.resetModules();
  });

  it("returns success:true with data on a successful action", async () => {
    const responseData = { postId: "12345" };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => responseData,
    });

    const { composioExecuteAction } = await import("@/lib/composio");
    const result = await composioExecuteAction("FACEBOOK_POST_TO_FEED", { message: "Hello" });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(responseData);
  });

  it("returns success:false with error message when API returns non-ok", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Bad request",
      statusText: "Bad Request",
    });

    const { composioExecuteAction } = await import("@/lib/composio");
    const result = await composioExecuteAction("FACEBOOK_POST_TO_FEED", { message: "Hello" });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns success:false with error message when fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));

    const { composioExecuteAction } = await import("@/lib/composio");
    const result = await composioExecuteAction("FACEBOOK_POST_TO_FEED", { message: "Hello" });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Connection refused/);
  });

  it("sends the correct entityId and input in the request body", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const { composioExecuteAction } = await import("@/lib/composio");
    await composioExecuteAction("TEST_ACTION", { foo: "bar" });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.entityId).toBe("ciseau-noir-barbershop");
    expect(body.input).toEqual({ foo: "bar" });
  });
});

// ── composioFacebookPost ─────────────────────────────────────────────────────

describe("composioFacebookPost", () => {
  it.todo("calls composioExecuteAction with FACEBOOK_POST_TO_FEED and message");
  it.todo("returns composioExecuteAction result directly");
});

// ── composioInstagramPost ────────────────────────────────────────────────────

describe("composioInstagramPost", () => {
  it.todo("calls composioExecuteAction with INSTAGRAM_BASIC_DISPLAY_CREATE_MEDIA and caption");
  it.todo("includes image_url in params when imageUrl is provided");
  it.todo("omits image_url from params when imageUrl is undefined");
});
