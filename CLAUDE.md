# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Local dev server (wrangler dev)
npm run deploy       # Deploy to Cloudflare Workers
npm run db:init      # Apply D1 schema (src/db/schema.sql)
npx tsc --noEmit     # Type-check (no test suite exists)
```

## Architecture

Cloudflare Workers app serving a video hosting site. Two halves: a **Hono API backend** (TypeScript, `src/`) and a **vanilla JS SPA frontend** (no build step, `public/`). UI text is zh-CN.

### Request Routing

`wrangler.jsonc` splits traffic via `assets.run_worker_first: ["/api/*"]` + `not_found_handling: "single-page-application"`: `/api/*` hits the Worker (Hono), everything else serves static files from `public/` with SPA fallback to `index.html`.

### Backend (`src/`)

- **Entry**: `index.ts` mounts five Hono route groups: `/api/auth`, `/api/videos`, `/api/upload`, `/api/admin`, `/api/settings`. On the first `/api/*` request it runs an idempotent `batch()` of `CREATE TABLE IF NOT EXISTS` (videos + settings) plus `INSERT OR IGNORE` seeds for default quotas, so `npm run db:init` is optional.
- **Auth stack** (`middleware/auth.ts` + `middleware/admin.ts`): `authRequired` (401 on missing/invalid), `authOptional` (pass through), `notGuest` (403 if JWT has `is_guest: true`), `adminRequired` (403 unless DB `admin_user_id` matches `user.sub`). Composition: uploads use `authRequired + notGuest`; `PUT /api/settings` uses `authRequired + adminRequired`; `POST /api/admin/claim` uses `authRequired + notGuest`.
- **Auth flow**: GitHub OAuth → JWT in HttpOnly cookie. `/api/auth/guest` issues a JWT with `is_guest: true` for read-only browsing. JWT is hand-rolled via Web Crypto HMAC-SHA256 in `services/jwt.ts` — not a library. `GET /api/auth/me` returns `is_admin` by querying the DB each request (NOT a JWT claim — so admin changes take effect without token refresh).
- **Upload flow**: Two-step presigned URL process. Client → `POST /api/upload/presign` gets R2 presigned PUT URLs (via `aws4fetch`) → uploads directly to R2 bypassing the Worker → `POST /api/upload/complete` writes metadata to D1. Presign reads `services/settings.ts` to enforce current quotas (single-file + total-storage sum check).
- **Video streaming**: `routes/videos.ts` handles Range requests for `/:id/stream`, parsing the Range header and passing it to `R2Bucket.get()` with offset/length options.
- **Bindings**: `Env` in `types.ts` — `R2_BUCKET` (R2Bucket), `DB` (D1Database), plus string secrets (GitHub OAuth, JWT_SECRET, R2 S3 keys, CF_ACCOUNT_ID).

### Admin & Settings System

- No user table, no admin whitelist env var. The first logged-in non-guest user who visits `#/admin` claims admin via `POST /api/admin/claim`, which atomically `INSERT OR IGNORE`s `admin_user_id` into the `settings` key-value table. Reset admin with `wrangler d1 execute ... --command "DELETE FROM settings WHERE key='admin_user_id'"`.
- Quotas (`max_single_video_size`, `max_total_storage`) live in the same `settings` table. `services/settings.ts` centralizes reads/writes with hardcoded fallback defaults (1 GiB / 9.5 GiB in bytes). Quota is a **soft limit** — checked only in presign, not re-checked in `/api/upload/complete`, so concurrent uploads can race past the total cap (accepted tradeoff).

### Frontend (`public/`)

- Hash-based SPA router in `js/app.js` — routes: `#/`, `#/video/:id`, `#/upload`, `#/admin`, `#/login`. Guests redirected from `#/upload` and `#/admin`.
- Auth state checked via `/api/auth/me` on load; `js/auth.js` exposes `getUser()`, `isGuest()`, `isAdmin()`. 401s trigger `auth:unauthorized` → login redirect.
- API client `js/api.js` has `apiGet/apiPost/apiPut/apiDelete` and parses `{error: "..."}` JSON from non-2xx responses for user-facing messages.
- Thumbnail generation is client-side on upload: `<video>` + `<canvas>` captures a frame, exports JPEG blob. On the home page, all thumbnails render at **forced 16:9** via `.pin-image { aspect-ratio: 16/9; object-fit: cover; }` — portrait videos get center-cropped so the masonry grid stays visually uniform. On the playback page, `.video-player-wrapper` starts at 16:9 and JS overrides `style.aspectRatio` from `videoEl.videoWidth/videoHeight` on `loadedmetadata` so portrait videos render at real aspect (capped by `max-height: 85vh`).
- Confirm dialogs use `components/modal.js` `showConfirm({ title, message, danger })` — native `confirm()` is not used. Returns a Promise<boolean>, styled per DESIGN.md.

### Masonry Grid

The home-page grid is **JS-distributed flex columns**, not CSS `column-count`: `public/js/pages/home.js` picks a column count from viewport width and round-robins cards into child `.masonry-column` divs, re-laying out on `resize`. This avoids the `column-fill: balance` quirk where small item counts get redistributed into fewer visible columns. Breakpoints (1/2/3/4/5/6 cols) live in `getColumnCount()` — not CSS media queries. Round-robin is fine for balance because all cards now have identical 16:9 image heights.

### Design System

`DESIGN.md` contains the Pinterest-inspired design spec. Warm neutrals (`#e5e5e0`, `#62625b`), Pinterest Red (`#e60023`) for CTAs only, plum black (`#211922`) text, 16px radius on buttons, 20px+ on cards, no shadows. CSS tokens in `public/css/style.css` `:root`. Reference DESIGN.md before UI work.

### Data Model

- `videos`: single table, uploader info denormalized from JWT claims (no users table). Video files at R2 `videos/{uuid}/{filename}`, thumbnails at `thumbnails/{uuid}.jpg`.
- `settings`: key-value (`key TEXT PK`, `value TEXT`). Known keys: `max_single_video_size`, `max_total_storage`, `admin_user_id` (optional).

## Key Constraints

- Worker free tier: 10ms CPU, 100MB request body — this is why uploads use presigned URLs bypassing the Worker entirely.
- R2 bucket name `r2-page-video` is hardcoded in `routes/upload.ts` presign, not read from the binding. Presign targets `https://{CF_ACCOUNT_ID}.r2.cloudflarestorage.com` directly via `aws4fetch`; the `R2_BUCKET` binding is only used server-side for streaming/download/delete.
- All `/api/videos/*` and `/api/settings/*` require auth (guests OK for GET); `/api/upload/*` and `/api/admin/*` also require non-guest; `PUT /api/settings` additionally requires admin.
- Upload cap is **dynamic** (read from `settings` in presign), not a compiled constant. Filenames sanitized to `[a-zA-Z0-9._\-\u4e00-\u9fff]` (CJK allowed).
- Frontend is plain ES modules (no bundler) — `type="module"` script tags in `index.html`. Adding a new page module requires an `<script>` entry there.
