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

Cloudflare Workers app serving a video hosting site. Two halves: a **Hono API backend** (TypeScript, `src/`) and a **vanilla JS SPA frontend** (no build step, `public/`).

### Request Routing

`wrangler.jsonc` splits traffic: `/api/*` hits the Worker (Hono), everything else serves static files from `public/` with SPA fallback to `index.html`.

### Backend (`src/`)

- **Entry**: `index.ts` — mounts three Hono route groups under `/api/auth`, `/api/videos`, `/api/upload`
- **Auth flow**: GitHub OAuth → JWT in HttpOnly cookie. `middleware/auth.ts` exports `authRequired` (returns 401) and `authOptional` (passes through). JWT is hand-rolled via Web Crypto HMAC-SHA256 in `services/jwt.ts` — not a library.
- **Upload flow**: Two-step presigned URL process. Client calls `/api/upload/presign` to get R2 presigned PUT URLs (via `aws4fetch`), uploads directly to R2 bypassing the Worker, then calls `/api/upload/complete` to write metadata to D1.
- **Video streaming**: `routes/videos.ts` handles Range requests for `/:id/stream`, parsing the Range header and passing it to `R2Bucket.get()` with offset/length options.
- **Bindings**: All Cloudflare bindings typed in `types.ts` as `Env` interface — `R2_BUCKET` (R2Bucket), `DB` (D1Database), plus string secrets.

### Frontend (`public/`)

- Hash-based SPA router in `js/app.js` — routes: `#/`, `#/video/:id`, `#/upload`, `#/login`
- Auth state checked via `/api/auth/me` on load; unauthorized redirects to login page
- Thumbnail generation is client-side: `<video>` + `<canvas>` captures a frame, exports JPEG blob, uploads alongside video
- All API calls go through `js/api.js` which dispatches `auth:unauthorized` events on 401s

### Design System

`DESIGN.md` contains the Pinterest-inspired design spec. UI uses warm neutrals (#e5e5e0, #62625b), brand red (#e60023), 16px border-radius, CSS column-based masonry grid, no shadows. Reference this file before any UI changes.

### Data Model

Single `videos` table in D1. Video files stored in R2 at `videos/{uuid}/{filename}`, thumbnails at `thumbnails/{uuid}.jpg`. No separate users table — uploader info is denormalized from JWT claims.

## Key Constraints

- Worker free tier: 10ms CPU time per request, 100MB request body limit — this is why uploads use presigned URLs to bypass the Worker
- R2 bucket name `r2-page-video` is hardcoded in the presign endpoint (`routes/upload.ts`), not read from the binding
- All `/api/videos/*` and `/api/upload/*` routes require auth; `/api/auth/*` routes are public
- Frontend is plain JS modules (no bundler) — `type="module"` script tags in `index.html`
- UI text is in Chinese (zh-CN)
