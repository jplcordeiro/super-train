# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**super-train** — a single-congregation (single-tenant) PWA that helps the territory servant **manage territory assignments** and **locate himself inside a territory** on a live map. The core pain it solves is field navigation ("não me perco no território").

Design and plan docs live in `docs/`:
- `docs/superpowers/specs/2026-07-02-super-train-mvp-design.md` — the approved design
- `docs/superpowers/plans/2026-07-02-super-train-mvp.md` — the implementation plan
- `docs/design/super-train.excalidraw` — data model + architecture diagram

## Commands

- **Dev server:** `npm run dev` (localhost). For testing on a phone with real GPS: `npm run dev -- --host` — serves HTTPS (self-signed via `@vitejs/plugin-basic-ssl`) on the LAN, which the browser requires to grant geolocation off-localhost.
- **Build (typecheck + bundle):** `npm run build` (`tsc -b && vite build`).
- **Tests:** `npm run test` (Vitest, run mode).
- **Single test file:** `npx vitest run src/lib/territorios.test.ts`
- **Single test by name:** `npx vitest run -t "statusTerritorio"`
- **Lint:** `npm run lint` (oxlint).

## Architecture

React 19 + TypeScript + Vite SPA (PWA via `vite-plugin-pwa`) talking **directly** to Supabase — there is no backend server. Access control is enforced by Postgres RLS, not application code.

- **`src/lib/`** — the only place that touches Supabase. `supabase.ts` is the client singleton (reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`). `types.ts` holds the domain types. `territorios.ts` / `publicadores.ts` / `designacoes.ts` are the typed data layer; UI never calls `supabase` directly. `statusTerritorio()` in `territorios.ts` is a pure function — territory state is **derived**, never stored.
- **`src/auth/`** — single-user gate. `useSession` tracks the Supabase session; `App` renders `<Login>` until authenticated. RLS: `authenticated` = full access, `anon` = none.
- **`src/map/`** — `BaseMap` wraps Mapbox GL (`react-map-gl@8`, imported from **`react-map-gl/mapbox`**); `showLocation` mounts the `GeolocateControl` for the live "you are here". `TerritorioPolygon` renders a boundary from a GeoJSON polygon.
- **`src/screens/`** — `Cadastro` (draw polygon with `@mapbox/mapbox-gl-draw`, read via `draw.*` events, save GeoJSON), `Gestao` (status list + publicadores + designar/devolver), `Campo` (boundary + live position). Routes wired in `App.tsx` behind the auth gate.
- **`supabase/migrations/0001_init.sql`** — the schema. The Supabase MCP is **read-only**; schema changes are applied by a human running the SQL in the Supabase SQL Editor, then committed here.

## Domain rules that shape the schema

- **One open assignment per territory**, enforced by a partial unique index: `unique(territorio_id) where data_devolucao is null`. A publisher may hold many territories.
- **Derived state (never stored):** availability = `ativo` AND no open `designacao`; "last worked" = latest `data_devolucao`; assignment open = `data_devolucao is null`. The only stored admin flag is `territorio.ativo` ("don't assign for now").
- Territory boundaries are **GeoJSON polygons in a `jsonb` column** — no PostGIS.

## Out of scope (deliberately deferred)

Addresses/"não bater" list, service groups, group-level assignment, publisher logins, offline tiles, territory `tipo`, assignment `observacao`, Supabase Storage. Don't add these without a new design pass.

## Secrets

`.env` (git-ignored) holds `SUPABASE_ACCESS_TOKEN` (admin/MCP — **never** `VITE_`-prefixed), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MAPBOX_TOKEN`. `.env.example` documents the shape. The Mapbox token should be URL-restricted in production; for LAN phone testing its allowlist must include the dev host.
