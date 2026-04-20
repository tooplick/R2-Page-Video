# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Local dev server (wrangler dev)
npm run deploy       # Deploy to Cloudflare Workers
npm run db:init      # Apply D1 schema (src/db/schema.sql)
npx tsc --noEmit     # Type-check (no test suite exists)
npx wrangler tail    # Stream live logs from deployed Worker
```

## Architecture

Cloudflare Workers app serving a video hosting site. Two halves: a **Hono API backend** (TypeScript, `src/`) and a **vanilla JS SPA frontend** (no build step, `public/`). UI text is zh-CN.

### Request Routing

`wrangler.jsonc` splits traffic via `assets.run_worker_first: ["/api/*"]` + `not_found_handling: "single-page-application"`: `/api/*` hits the Worker (Hono), everything else serves static files from `public/` with SPA fallback to `index.html`.

### Backend (`src/`)

- **Entry**: `index.ts` default export is a **Worker object** (`{ fetch, scheduled }`), not the bare Hono app — `fetch` delegates to `app.fetch`, `scheduled` runs `cleanupOrphans(env)` via `ctx.waitUntil` for the Cron Trigger. Mounts five Hono route groups: `/api/auth`, `/api/videos`, `/api/upload`, `/api/admin`, `/api/settings`. On the first `/api/*` request it runs an idempotent `batch()` of `CREATE TABLE IF NOT EXISTS` (videos + settings) plus `INSERT OR IGNORE` seeds for default quotas, so `npm run db:init` is optional.
- **Auth stack** (`middleware/auth.ts` + `middleware/admin.ts`): `authRequired` (401 on missing/invalid), `authOptional` (pass through), `notGuest` (403 if JWT has `is_guest: true`), `adminRequired` (403 unless DB `admin_user_id` matches `user.sub`). Composition: uploads use `authRequired + notGuest`; `PUT /api/settings` uses `authRequired + adminRequired`; `POST /api/admin/claim` uses `authRequired + notGuest`; `POST /api/admin/cleanup-orphans` uses `authRequired + notGuest + adminRequired`.
- **Auth flow**: GitHub OAuth → JWT in HttpOnly cookie. `/api/auth/guest` issues a JWT with `is_guest: true` for read-only browsing. JWT is hand-rolled via Web Crypto HMAC-SHA256 in `services/jwt.ts` — not a library. `GET /api/auth/me` returns `is_admin` by querying the DB each request (NOT a JWT claim — so admin changes take effect without token refresh).
- **Upload flow**: Two-step presigned URL process. Client → `POST /api/upload/presign` gets R2 presigned PUT URLs (via `aws4fetch`) → uploads directly to R2 bypassing the Worker → `POST /api/upload/complete` writes metadata to D1. Presign reads `services/settings.ts` to enforce current quotas (single-file + total-storage sum check).
- **Video streaming**: `routes/videos.ts` handles Range requests for `/:id/stream`, parsing the Range header and passing it to `R2Bucket.get()` with offset/length options.
- **Bindings**: `Env` in `types.ts` — `R2_BUCKET` (R2Bucket), `DB` (D1Database), plus string secrets: GitHub OAuth (`GITHUB_CLIENT_ID`/`_SECRET`), `JWT_SECRET`, R2 S3 keys (`R2_ACCESS_KEY_ID`/`_SECRET_ACCESS_KEY`), and `CF_ACCOUNT_ID` (for R2 presign URL hostname). Non-plaintext values are set via `wrangler secret put <NAME>`; plaintext vars live in `wrangler.jsonc` `vars`. For local dev, put secrets in a `.dev.vars` file (must be gitignored).

### Admin & Settings System

- No user table, no admin whitelist env var. The first logged-in non-guest user who visits `#/admin` claims admin via `POST /api/admin/claim`, which atomically `INSERT OR IGNORE`s `admin_user_id` into the `settings` key-value table. Reset admin with `wrangler d1 execute ... --command "DELETE FROM settings WHERE key='admin_user_id'"`.
- Quotas (`max_single_video_size`, `max_total_storage`) live in the same `settings` table. `services/settings.ts` centralizes reads/writes with hardcoded fallback defaults in bytes (`DEFAULT_MAX_SINGLE_VIDEO_SIZE = 1_000_000_000` ≈ 1.00 GB, `DEFAULT_MAX_TOTAL_STORAGE = 9_900_000_000` ≈ 9.9 GB, both decimal). Quota is a **soft limit** — checked only in presign, not re-checked in `/api/upload/complete`, so concurrent uploads can race past the total cap (accepted tradeoff).
- **Current usage** (`services/settings.ts::getCurrentUsage`) is computed from D1 as `SELECT COALESCE(SUM(file_size), 0) FROM videos`. This counts only video payloads tracked in D1 — thumbnails (tens of KB each, not stored in D1) and any in-flight orphan objects are excluded, so the figure will be marginally lower than the R2 dashboard bucket-size. Because quota is soft-checked in presign only, concurrent uploads can still race past the cap (accepted tradeoff).

### Orphan File Cleanup

Because the upload flow is 3-step (presign → client R2 PUT → `/complete`), failures between steps 2 and 3 leave R2 objects with no D1 row. `services/cleanup.ts::cleanupOrphans(env, graceMs=1h)` handles this:

- Reads all known `r2_key` + `thumbnail_r2_key` from D1 via `getAllR2Keys()` into a `Set`.
- Paginates `R2_BUCKET.list()` over `videos/` and `thumbnails/` prefixes with cursor until `!truncated`.
- For each object: delete iff not in the D1 Set AND `uploaded` timestamp > `graceMs` ago. The grace period tolerates in-flight uploads that haven't reached `/complete` yet.
- Triggered **hourly** by Cron Trigger (`wrangler.jsonc` `triggers.crons: ["0 * * * *"]`), via the `scheduled` handler in `index.ts`. Also exposed as `POST /api/admin/cleanup-orphans` for manual/debug runs — that path returns `{ scanned, deleted, deletedKeys }` synchronously (no `waitUntil`).

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

- Worker free tier: 10ms CPU, 100MB request body — this is why uploads use presigned URLs bypassing the Worker entirely. `scheduled` handlers get a higher CPU limit (~30s) so the orphan scan has room.
- R2 bucket name `r2-page-video` is hardcoded in `routes/upload.ts` presign. `services/cleanup.ts` uses the `R2_BUCKET` binding directly (no hardcoded name). Presign targets `https://{CF_ACCOUNT_ID}.r2.cloudflarestorage.com` via `aws4fetch`; the binding is used server-side for streaming/download/delete/list/cleanup.
- All `/api/videos/*` and `/api/settings/*` require auth (guests OK for GET); `/api/upload/*` and `/api/admin/*` also require non-guest; `PUT /api/settings` and `POST /api/admin/cleanup-orphans` additionally require admin.
- Upload cap is **dynamic** (read from `settings` in presign), not a compiled constant. Filenames sanitized to `[a-zA-Z0-9._\-\u4e00-\u9fff]` (CJK allowed).
- **Display units are decimal GB (1000³), NOT binary GiB (1024³)** — chosen to match CF dashboard's reported bucket size. All conversions use `1000 * 1000 * 1000`: frontend `GB` constants in `admin.js` and `upload.js`, `formatFileSize`/`formatSize` helpers in `video-card.js` / `upload.js` / `video.js`, and backend error messages in `routes/upload.ts`.
- Frontend is plain ES modules (no bundler) — `type="module"` script tags in `index.html`. Adding a new page module requires an `<script>` entry there.
