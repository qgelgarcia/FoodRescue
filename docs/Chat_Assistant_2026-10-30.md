# FoodRescue assistant

## Product scope

Member route: `/app/chat`. Open Assistant from Profile; desktop also has a header shortcut. Saved conversations belong to the signed-in member. The app does not expose other members' chats or let the model perform app actions.

The assistant handles:

- FoodRescue navigation, claims, donor approval, pickup verification, cancellation, maps, profiles, notifications, reports and recovery using a verified guide compiled from the current implementation.
- General food composition and nutrition education. Serving size/preparation are requested when needed, and numeric amounts are estimates rather than verified analysis of a donor's listing.
- General balanced-meal ideas, preferences and budget. Medical treatment diets, diagnosis, dosing, extreme restriction and personalized clinical prescriptions are outside scope.

Unrelated topics receive a scope reminder. Common instruction-override/secret requests are blocked locally; a structured model classifier checks other questions before answer generation. Answer scope is checked again and malformed/truncated output fails closed. These are layered controls, not a claim that a language model can never be manipulated. The model has no tools, credentials, private account records or live listing access in its context.

## Data and provider

The server uses OpenRouter's [chat completion API](https://openrouter.ai/docs/api/api-reference/chat/create-a-chat-completion), with strict [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs). Default model is `xingchen-agi/xing4.0-29b-a4b:free`, the tested free structured-output endpoint compatible with the existing privacy policy. The backend rejects paid models and non-free routers before sending requests, and caps provider prompt/completion prices at zero. Only the free router or explicit `:free` variants are permitted; there is no paid fallback. Provider routing requests `data_collection: deny`, `zdr: true` and supported required parameters; routing failures do not downgrade those privacy settings. See [provider selection](https://openrouter.ai/docs/guides/routing/provider-selection).

Only the member's question and up to 16 recent saved user/assistant messages are sent, plus the static app guide/policy. Profile names, phone, email, pickup codes, live claims and GPS are not automatically included. Members should avoid submitting private health details or credentials. Nutrition is general information; [NIDDK guidance](https://www.niddk.nih.gov/health-information/weight-management/choosing-a-safe-successful-weight-loss-program) supports involving a health professional when selecting a plan suited to individual health needs.

Messages are plain text; no model HTML, scripts or tools execute. Chats are stored in Supabase and can be deleted by their owner from the page. Provider retention settings do not erase chat history stored in the app.

## Server contract

- Bearer Supabase session required on every `/api/chat` request; token verified server-side and profile must be active.
- `GET /conversations`, `POST /conversations`, `GET /conversations/:id`, `DELETE /conversations/:id`.
- `POST /conversations/:id/messages` accepts only `{ message, requestId }`; no caller-selected owner, system prompt, model, assistant history or credentials.
- Question limit 2,000 characters; at most 40 messages per conversation. At most 100 conversations per account.
- Per-account rate limits: 10 requests/minute and 100/day for chat creation/generation, with one generation in flight per account. Limits are process-local for the present single-server setup; use a shared limiter before horizontal scaling. SQL version checks still prevent stale concurrent exchanges from being saved.
- User/assistant pairs persist atomically. Reusing a request ID with the same question returns the saved pair; reusing it with a different question is rejected. Provider failures do not persist invented successful replies.
- Database RLS permits only owner reads/deletes; direct member message writes and assistant spoofing are denied. Only the backend service role can write an exchange through its constrained RPC.

## Configuration and local run

Ignored `apps/backend/.env`:

```text
OPENROUTER_API_KEY=<local secret, never commit>
OPENROUTER_MODEL=xingchen-agi/xing4.0-29b-a4b:free
```

The key must never be named `VITE_*`. Existing Supabase URL/service-role configuration is required on the server. The frontend dev server proxies `/api` to localhost:5000. Restart the backend after changing its environment. Production/native clients require an HTTPS `VITE_API_BASE_URL` and an allowed backend CORS origin; no native package is produced by this work.

Migration: `20261030040000_chat_conversations.sql` was applied to linked project `tbmmqimhhazbuazetdwa` and verified. Unit tests use mocked provider responses and isolated database fixtures; they do not prove model factual accuracy or resistance to every adversarial prompt.

## Verification

- Full regression suite: 78/78 passed; lint and shared/backend/frontend builds passed. Existing large frontend-chunk warning remains.
- Focused chat coverage includes account isolation, direct assistant-spoof denial, server auth/strict request fields, ordered atomic message pairs, idempotency, stale writes, storage/length limits, scope/medical/secret guards, generic provider failures, retained retry IDs and clearing old messages on account change.
- Security review's emergency-guidance finding was fixed and regression tested.
- Localhost `/app/chat` returns HTTP 200. Direct backend and Vite-proxied chat API both return HTTP 401 without a token. This verifies route/proxy integration, not a signed-in real-provider exchange.
- Browser interaction tools were unavailable in this turn; physical mobile keyboard and visual acceptance remain pending. UI behavior was verified with React component tests and responsive styles inspected in source.
- No APK was built, synchronized or bundled. No new Git commit/push was made for this chatbot feature.

## Provider acceptance

The supplied key was saved only in the ignored backend environment. A synthetic app-guidance request returned HTTP 401 from OpenRouter. The owner is updating the local key. Real AI-answer acceptance remains pending until a replacement key is ready and a synthetic end-to-end check passes. Do not substitute mock replies as production success or silently switch providers.


## Free-only enforcement (2026-10-31)

Paid model IDs and non-free routers are blocked before any network request. The default pinned free variant and `openrouter/free` are permitted, along with explicit `:free` variants. All requests cap prompt, completion and per-request prices at zero, retain `data_collection: deny` and `zdr: true`, and never retry on paid models. Free endpoint exhaustion returns a recoverable busy/unavailable message.

The replacement local key authenticated successfully (HTTP 200). The automatic free router and three other free structured-output variants rejected the existing ZDR policy. The pinned Xing free endpoint passed the routing filters but returned upstream HTTP 429 on two attempts. A successful real generated reply remains unverified until free-provider capacity recovers. No privacy restrictions were relaxed and no paid generation was requested.
