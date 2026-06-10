# Test Coverage Analysis — Ciseau Noir

**Generated:** 2026-06-10
**Test runner:** Vitest
**Current status:** 522 passing | 362 todo | 1 failing

---

## Summary

| Category | Count |
|----------|-------|
| Routes with zero test files | 31 |
| Tests marked TODO/skip | 362 |
| Failing tests | 1 |
| Lib files with no dedicated tests | 1 (`use-realtime-bookings.ts`) |

---

## 1. FAILING TEST (fix immediately)

**File:** `tests/cron-monthly-reminders.test.ts:39`

**Error:** `TypeError: Cannot read properties of undefined (reading 'searchParams')`

**Root cause:** The test at line 39 constructs `new Request(...)` (standard Web API) instead of `new NextRequest(...)`. The route accesses `req.nextUrl.searchParams` which only exists on `NextRequest`.

**Fix:** Change line 39 from:
```ts
const req = new Request("http://localhost/api/cron/monthly-reminders");
```
to:
```ts
const req = new NextRequest("http://localhost/api/cron/monthly-reminders");
```

---

## 2. COMPLETELY UNTESTED ROUTES (no test file)

### Priority HIGH — Auth & Core Business Logic

| Route | File | Risk |
|-------|------|------|
| `POST/DELETE /api/auth/login` | `auth/login/route.ts` | Auth bypass, cookie poisoning |
| `GET /api/booking/init` | `booking/init/route.ts` | Core booking flow broken silently |
| `GET /api/calendar/[barber]` | `calendar/[barber]/route.ts` | iCal auth bypass, PII exposure |
| `POST /api/push/subscribe` | `push/subscribe/route.ts` | Zod validation untested |
| `POST /api/push/send` | `push/send/route.ts` | Missing field validation |

### Priority HIGH — AI & Automation

| Route | File | Risk |
|-------|------|------|
| `POST /api/admin/generate-post` | `admin/generate-post/route.ts` | `requireAdmin` bypass untested |
| `POST /api/expenses/analyze` | `expenses/analyze/route.ts` | AI + file upload entirely untested |
| `POST /api/telegram/webhook` | `telegram/webhook/route.ts` | Complex AI decision tree, 0 coverage |
| `POST /api/telegram/setup` | `telegram/setup/route.ts` | Webhook registration untested |
| `GET /api/cron/auto-post` | `cron/auto-post/route.ts` | Social media AI automation |
| `GET /api/cron/check-emails` | `cron/check-emails/route.ts` | AI email triage untested |

### Priority MEDIUM — Meta / Google Integrations

| Route | Risk |
|-------|------|
| `POST /api/meta/comments` | Facebook comment AI reply |
| `POST /api/meta/post` | Social post creation |
| `POST /api/meta/reply` | Messenger reply |
| `POST /api/meta/story` | Story posting |
| `GET /api/google/auth` | OAuth redirect |
| `GET /api/google/callback` | OAuth token exchange |
| `GET /api/google/gmail-auth` | Gmail OAuth |
| `GET /api/google/gmail-callback` | Gmail token exchange |
| `GET /api/google/locations` | GMB location listing |
| `POST /api/google/post` | GMB post creation |

### Priority LOW — Admin Utilities

| Route | Risk |
|-------|------|
| `GET /api/admin/gmail-reauth` | Gmail token refresh |
| `POST /api/admin/inbox-scan` | AI inbox processing |
| `POST /api/admin/portfolio/upload` | File upload validation |
| `GET /api/admin/test-post` | Dev utility |
| `GET /api/figaro/messages` | Message history |
| `GET /api/cron/holiday-alerts` | Holiday detection |
| `GET /api/cron/newsletter` | Newsletter send |
| `GET /api/cron/promo-rotation` | Promo rotation |
| `GET /api/cron/reply-fb-comments` | FB comment automation |
| `GET /api/cron/reply-reviews` | Review reply automation |

---

## 3. EDGE CASES NOT COVERED IN EXISTING TESTS

### `bookings-api.test.ts` (362 todos include these)
- POST with body that fails JSON.parse (malformed JSON)
- POST when barber is inactive (should be rejected)
- PATCH cancel on already-cancelled booking (idempotent?)
- Concurrent double-booking race condition (optimistic lock)
- Booking at exactly barber schedule boundary times

### `auth.test.ts`
- Login route POST: correct password sets `admin_auth` cookie
- Login route POST: rate-limit blocks after 5 attempts
- Login route DELETE: clears cookie regardless of auth state
- `generateToken` with missing `AUTH_SECRET` env var

### `clients-api.test.ts`
- Search with special characters (SQL injection via `ilike`)
- Search with empty string returns all (or 0?)
- Pagination limits (what happens with 10,000+ clients?)

### `loyalty.test.ts`
- Client with exactly 10 completed cuts (free cut threshold)
- Client with 0 cuts (returns progress: 0/10)
- Multiple barbers — counts across all or per-barber?

### `sms-webhook.test.ts`
- ANNULER with multiple matching bookings (ambiguous phone)
- Phone number with country code vs without
- Body with accented characters (RÉSERVER vs RESERVER)
- Twilio `X-Twilio-Signature` validation when env is set

### `cron-auto-complete.test.ts`
- Booking exactly at the 1-hour-ago boundary
- `review_request_sent` flag prevents duplicate emails
- First-visit promo: `completed_count` check off-by-one (should be 1, not >1)

### `recurring-booking.test.ts`
- Generating 52 weekly occurrences correctly
- Skipping dates that fall on barber day-overrides
- Recurring with a barber block in the middle
- POST returns all created booking IDs

---

## 4. MISSING ERROR HANDLING TESTS

These patterns appear in source code but are not tested:

| Route | Missing error test |
|-------|--------------------|
| `expenses/analyze` | AI API timeout / `response.content[0]` undefined |
| `expenses/analyze` | `JSON.parse` of AI response throws (invalid JSON) |
| `expenses/analyze` | Supabase storage upload fails |
| `figaro/chat` | AI streaming error mid-stream |
| `telegram/webhook` | `fetch()` to Telegram API fails |
| `cron/auto-post` | Meta Graph API returns 4xx |
| `cron/check-emails` | Gmail API rate limit |
| `booking/init` | One of the 5 parallel Supabase queries fails |
| `push/subscribe` | Supabase upsert conflict on `endpoint` |
| `sms-webhook` | Twilio client throws |

---

## 5. INTEGRATION TEST GAPS

- **Booking flow end-to-end:** `POST /api/booking/init` → `POST /api/bookings` → SMS/email sent
- **Cancel flow:** `GET /api/bookings/[id]/cancel` → status updated → waitlist notified
- **Cron auto-complete chain:** mark completed → send review request → loyalty count incremented
- **SMS webhook → booking cancel:** ANNULER → find booking → cancel → notify barber
- **Admin generate-post → meta/post:** generate text → publish to Facebook

---

## 6. UNTESTED LIB FUNCTIONS

| File | Untested functions |
|------|--------------------|
| `use-realtime-bookings.ts` | React hook — no tests (needs React Testing Library) |
| `ai.ts` | `aiClient` initialization with missing `ANTHROPIC_API_KEY` |
| `gmail.ts` | `sendGmailReply`, `archiveEmail` — only tested via integration in cron |
| `google.ts` | OAuth token refresh logic |
| `supabase.ts` | `supabaseAdmin` initialization guard |
