# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**super-train** — a single-congregation (single-tenant) PWA that helps the territory servant **manage territory assignments** and **locate himself inside a territory** on a live map. The core pain it solves is field navigation ("não me perco no território").

Design and plan docs live in `docs/`:
- `docs/superpowers/specs/2026-07-02-super-train-mvp-design.md` — the approved design
- `docs/superpowers/plans/2026-07-02-super-train-mvp.md` — the implementation plan
- `docs/design/super-train.excalidraw` — data model + architecture diagram

## Commands

- **Dev server:** `npm run dev` (localhost, fixed port 3000 via `strictPort`).
- **Phone (real GPS):** `npm run celular` — LAN, **fixed port 3001**, HTTPS (self-signed via `@vitejs/plugin-basic-ssl`), which the browser requires to grant geolocation off-localhost. Runs alongside `npm run dev` (3000) instead of fighting it for the port. The phone opens `https://<ip-da-máquina>:3001` and has to accept the self-signed certificate once. The Mapbox token's URL allowlist must include that host, or the map comes up blank.
- **Build (typecheck + bundle):** `npm run build` (`tsc -b && vite build`).
- **Tests:** `npm run test` (Vitest, run mode).
- **Single test file:** `npx vitest run src/lib/territorios.test.ts`
- **Single test by name:** `npx vitest run -t "statusTerritorio"`
- **Lint:** `npm run lint` (oxlint).

## Architecture

React 19 + TypeScript + Vite SPA (PWA via `vite-plugin-pwa`) talking **directly** to Supabase — there is no backend server. Access control is enforced by Postgres RLS, not application code.

- **`src/lib/`** — the only place that touches Supabase. `supabase.ts` is the client singleton (reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`). `types.ts` holds the domain types. `territorios.ts` / `publicadores.ts` / `designacoes.ts` / `saidas.ts` / `quadras.ts` are the typed data layer; UI never calls `supabase` directly. `statusTerritorio()` in `territorios.ts` and `progressoDe()` in `quadras.ts` are pure functions — territory state and progress are **derived**, never stored. `utils.ts` exports the shadcn `cn()` helper (clsx + tailwind-merge).
- **`src/auth/`** — single-user gate. `useSession` tracks the Supabase session; `App` renders `<Login>` until authenticated. RLS: `authenticated` = full access, `anon` = none.
- **`src/map/`** — `BaseMap` wraps Mapbox GL (`react-map-gl@8`, imported from **`react-map-gl/mapbox`**); `showLocation` mounts the `GeolocateControl` for the live "you are here". `TerritorioPolygon` renders **one feature per quadra** (so a tap can tell which quadra was hit), painted by `EstadoQuadra` (`feita` / `outra` / `falta`); `onQuadraClick` makes it interactive.
- **`src/screens/`** — `Cadastro` (draw polygon with `@mapbox/mapbox-gl-draw`, read via `draw.*` events, save GeoJSON), `Gestao` (status list + progresso `5/8` + publicadores + designar/devolver + nova rodada + excluir território), `Campo` (boundary + live position + quadras feitas em verde), `Calendario` (monthly field-service roster; `SaidaForm` is its day panel), `MarcarQuadras` (`/saida/:saidaId/territorio/:territorioId` — marca no mapa o que a saída fez naquele dia). `TerritorioGlyph` renders a território's boundary as a small normalized SVG "seal" — one path per quadra, painting the ones already done. Routes wired in `App.tsx` behind the auth gate.
- **`supabase/migrations/`** — the schema (`0001_init.sql`, `0002_calendario.sql`, `0003_quadras_feitas.sql`). The Supabase MCP is **read-only**; schema changes are applied by a human running the SQL in the Supabase SQL Editor, then committed here.

## Code style

- **Do not write comments in code.** Code should be self-explanatory through clear naming. Only add a comment if the user explicitly asks for it.

## UI & styling

- **Tailwind CSS v4** via the `@tailwindcss/vite` plugin — no `tailwind.config.js`; all config lives in `src/index.css` using `@import "tailwindcss"`, `@theme`, and `@layer`. `tw-animate-css` provides animation utilities.
- **shadcn/ui** components in `src/components/ui/` (`components.json`: new-york style, `rsc: false`, lucide icons, Radix primitives via the `radix-ui` package). Add components with the shadcn CLI; they land here and use `cn()` from `@/lib/utils`.
- **Design tokens** in `src/index.css` — a jw.org-derived, desaturated palette (`--color-jwblue`, `--color-sage`, `--color-ink`, `--color-paper`, `--color-danger`, …) exposed as Tailwind color utilities via `@theme`, plus shadcn semantic tokens (`--primary`, `--destructive`, …) mapped onto that palette. Light-only (`color-scheme: light`). Theme color `#33507d` also drives the PWA manifest.
- **Toasts:** `sonner` — `<Toaster richColors position="top-center">` is mounted once in `main.tsx`.
- **Path alias:** `@` → `./src` (configured in both `vite.config.ts` and `tsconfig`).

## Domain rules that shape the schema

- **One open assignment per territory**, enforced by a partial unique index: `unique(territorio_id) where data_devolucao is null`. A publisher may hold many territories.
- **Derived state (never stored):** availability = `ativo` AND no open `designacao`; "last worked" = latest `data_devolucao`; assignment open = `data_devolucao is null`; **progress** = distinct `quadra_feita` rows whose saída is on/after `territorio.progresso_desde`. The only stored admin flags are `territorio.ativo` ("don't assign for now") and `territorio.progresso_desde` (the round's cut line).
- Territory boundaries are **GeoJSON in a `jsonb` column** — no PostGIS. Since `0003`, `limites` is a **`FeatureCollection` of Polygons, each carrying `properties.id`**: a quadra has a **stable identity** (the id `mapbox-gl-draw` already assigns), so a mark survives redrawing and reordering. `quadrasDe()` still reads legacy `Polygon` / `MultiPolygon` rows, giving them index-based ids.
- **Quadras feitas.** A mark is `quadra_feita(saida_id, territorio_id, quadra_id)` — no date column (it's the saída's) and no boolean (the row existing *is* the mark). Its composite FK to `saida_territorio` cascades: deleting a saída, or dropping a território from one, cleans the marks. Marking happens **only from a saída** (the roster is the complete record of field work), on the map, after the fact. A round is closed **by hand** ("Começar nova rodada" → `progresso_desde = today`); nothing auto-resets, and zeroing never deletes marks. An orphan mark (quadra erased from the drawing) simply stops counting.
- **`saida` (the calendar) is not `designacao`.** A `designacao` is custody of a territory ("território 6 is with Kleber until he returns it"); a `saida` is one scheduled field-service outing (date, período, meeting point, dirigente, 0..N territories via `saida_territorio`). A day holds **N saídas** — Sundays run two in the same morning from different meeting points — so there is deliberately no `unique(data, periodo)`. The dirigente is nullable ("a definir"). The two concepts never talk to each other; the only coupling is that `saida` FKs make `on delete restrict` fire for publishers/territories already on the roster.
- **Deleting a território** (`excluirTerritorio`) is blocked by the `designacao` FK: the DB raises Postgres error `23503` when any assignment references it, and the UI translates that into a "has assignments" message rather than deleting the history.

## Out of scope (deliberately deferred)

Addresses/"não bater" list, service groups, group-level assignment, publisher logins, offline tiles, territory `tipo`, assignment `observacao`, Supabase Storage. Don't add these without a new design pass.

## Secrets

`.env` (git-ignored) holds `SUPABASE_ACCESS_TOKEN` (admin/MCP — **never** `VITE_`-prefixed), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MAPBOX_TOKEN`. `.env.example` documents the shape. The Mapbox token should be URL-restricted in production; for LAN phone testing its allowlist must include the dev host.
