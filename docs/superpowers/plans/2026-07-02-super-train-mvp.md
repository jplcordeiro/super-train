# super-train MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA that lets the congregation's territory servant locate himself inside a field-service territory on a live map and manage territory assignments to individual publishers.

**Architecture:** React SPA (Vite) talking directly to Supabase (Postgres + Auth + RLS) via `@supabase/supabase-js`. Territory boundaries are stored as GeoJSON polygons and rendered on Mapbox GL, which also provides live GPS position. A thin typed data layer wraps all Supabase access; three screens (Cadastro, Gestão, Campo) consume it. Single authenticated user; RLS grants full access to authenticated and nothing to anon.

**Tech Stack:** React 18 + TypeScript + Vite · `@supabase/supabase-js` v2 · `react-map-gl` + `mapbox-gl` + `@mapbox/mapbox-gl-draw` · `vite-plugin-pwa` · `react-router-dom` · Vitest + `@testing-library/react` for unit tests.

## Global Constraints

- **Single-tenant, single user.** No `congregacao` table. Only the territory servant logs in (Supabase email/password). Publishers are name records, not auth users.
- **RLS mandatory on every table:** `authenticated` = full access; `anon` = no access.
- **Frontend env vars must be `VITE_`-prefixed** to reach the browser. The `SUPABASE_ACCESS_TOKEN` (admin/MCP) must NEVER be `VITE_`-prefixed or imported into frontend code.
- **Env var names (exact):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MAPBOX_TOKEN`.
- **One open assignment per territory** enforced in the DB by a partial unique index. A publisher may hold many territories.
- **Derived, never stored:** territory availability, "last worked" date, assignment open/closed state. Only `territorio.ativo` is a stored administrative flag.
- **Assume network in the field** (urban). Tiles load online; no offline tile caching in the MVP.
- **Portuguese** for all user-facing copy and table/column names (matches the spec).
- **MCP stays read-only.** Schema is applied by the user running the committed `.sql` in the Supabase SQL Editor — the agent never writes to the database.

---

## File Structure

```
supabase/migrations/0001_init.sql   # schema + RLS + indexes (user runs it)
index.html                          # Vite entry
vite.config.ts                      # Vite + PWA config
.env / .env.example                 # already exist
src/
  main.tsx                          # React root + router
  App.tsx                           # shell: auth gate + routes
  lib/
    supabase.ts                     # supabase client singleton
    types.ts                        # Territorio, Publicador, Designacao types
    territorios.ts                  # data layer: territorios + derived status
    publicadores.ts                 # data layer: publicadores CRUD
    designacoes.ts                  # data layer: designar / devolver
  auth/
    useSession.ts                   # auth session hook
    Login.tsx                       # email/password login screen
  map/
    BaseMap.tsx                     # Mapbox wrapper + live geolocation
    TerritorioPolygon.tsx           # renders a GeoJSON polygon layer
  screens/
    Cadastro.tsx                    # draw polygon, save territorio
    Gestao.tsx                      # list/status, publicadores, designar/devolver
    Campo.tsx                       # view polygon + live position
```

Split by responsibility: each data-layer file owns one table's access; map primitives are reusable across Cadastro and Campo; screens compose them.

---

## Task 1: Database schema + RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `territorio(id, numero, nome, limites, ativo, created_at)`, `publicador(id, nome, telefone, created_at)`, `designacao(id, territorio_id, publicador_id, data_saida, data_devolucao, created_at)`. These column names are consumed verbatim by the data layer in Tasks 4/7.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0001_init.sql`:

```sql
-- super-train — schema inicial (MVP)
-- Rode este arquivo em Supabase → SQL Editor (uma vez).

create table if not exists territorio (
  id         uuid primary key default gen_random_uuid(),
  numero     text not null unique,
  nome       text,
  limites    jsonb,                         -- polígono GeoJSON (geometry)
  ativo      boolean not null default true, -- false = "não designar por enquanto"
  created_at timestamptz not null default now()
);

create table if not exists publicador (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  telefone   text,
  created_at timestamptz not null default now()
);

create table if not exists designacao (
  id             uuid primary key default gen_random_uuid(),
  territorio_id  uuid not null references territorio(id) on delete restrict,
  publicador_id  uuid not null references publicador(id) on delete restrict,
  data_saida     date not null default current_date,
  data_devolucao date,
  created_at     timestamptz not null default now()
);

-- No máximo UMA designação aberta por território.
create unique index if not exists designacao_territorio_aberta_uidx
  on designacao (territorio_id)
  where data_devolucao is null;

-- Índices de apoio às consultas por território/publicador.
create index if not exists designacao_territorio_idx on designacao (territorio_id);
create index if not exists designacao_publicador_idx on designacao (publicador_id);

-- ------- RLS: autenticado = tudo, anônimo = nada -------
alter table territorio enable row level security;
alter table publicador enable row level security;
alter table designacao enable row level security;

create policy "auth_full_territorio" on territorio
  for all to authenticated using (true) with check (true);
create policy "auth_full_publicador" on publicador
  for all to authenticated using (true) with check (true);
create policy "auth_full_designacao" on designacao
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: User applies the migration**

In the Supabase dashboard for project `rsvpjzyvdbjyacnqiciu`: **SQL Editor → New query → paste the file → Run.** Expected: "Success. No rows returned."

- [ ] **Step 3: Create the territory-servant user**

Supabase → **Authentication → Users → Add user** → email + password (this is the only login). Note the credentials; they are used to sign in at Task 3.

- [ ] **Step 4: Verify the schema**

After restarting the Claude Code session (so the read-only Supabase MCP tools load), list tables and confirm `territorio`, `publicador`, `designacao` exist with RLS enabled. Or, in SQL Editor, run:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public';
```
Expected: three rows, all with `rowsecurity = true`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): schema inicial territorio/publicador/designacao + RLS"
```

---

## Task 2: Project scaffold + Supabase client

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`
- Create: `src/lib/supabase.ts`, `src/lib/types.ts`
- Test: `src/lib/supabase.test.ts`

**Interfaces:**
- Produces: `supabase` (a `SupabaseClient`) exported from `src/lib/supabase.ts`; types `Territorio`, `Publicador`, `Designacao` from `src/lib/types.ts`.

- [ ] **Step 1: Scaffold Vite + React + TS**

Run:
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install @supabase/supabase-js react-router-dom react-map-gl mapbox-gl @mapbox/mapbox-gl-draw
npm install -D vite-plugin-pwa vitest @testing-library/react @testing-library/jest-dom jsdom @types/mapbox-gl
```
Expected: `node_modules/` populated, `package.json` created. (Answer "y" to overwrite the current directory if prompted; keep existing `.env`, `.gitignore`, `docs/`, `supabase/`.)

- [ ] **Step 2: Configure Vitest**

In `vite.config.ts`, add the PWA plugin and a test config:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "super-train",
        short_name: "super-train",
        description: "Territórios de campo da congregação",
        theme_color: "#0b3d91",
        display: "standalone",
        start_url: "/",
      },
    }),
  ],
  // @ts-expect-error vitest augments the Vite config
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/setupTests.ts"] },
});
```

Create `src/setupTests.ts`:
```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 3: Define domain types**

Create `src/lib/types.ts`:
```ts
export interface Territorio {
  id: string;
  numero: string;
  nome: string | null;
  limites: GeoJSON.Polygon | null;
  ativo: boolean;
  created_at: string;
}

export interface Publicador {
  id: string;
  nome: string;
  telefone: string | null;
  created_at: string;
}

export interface Designacao {
  id: string;
  territorio_id: string;
  publicador_id: string;
  data_saida: string;        // ISO date
  data_devolucao: string | null;
  created_at: string;
}
```
(`GeoJSON` types come from `@types/mapbox-gl`'s transitive `geojson` types; if not resolved, add `npm i -D @types/geojson`.)

- [ ] **Step 4: Write the failing test for the client**

Create `src/lib/supabase.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { supabase } from "./supabase";

describe("supabase client", () => {
  it("is configured with url and key from env", () => {
    expect(supabase).toBeDefined();
    // The client exposes `from`, proving it constructed correctly.
    expect(typeof supabase.from).toBe("function");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/lib/supabase.test.ts`
Expected: FAIL — cannot resolve `./supabase`.

- [ ] **Step 6: Implement the client**

Create `src/lib/supabase.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórios (.env)");
}

export const supabase = createClient(url, key);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/lib/supabase.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig*.json index.html src/
git commit -m "feat: scaffold Vite+React+TS+PWA e cliente Supabase"
```

---

## Task 3: Auth gate (login)

**Files:**
- Create: `src/auth/useSession.ts`, `src/auth/Login.tsx`
- Modify: `src/App.tsx`
- Test: `src/auth/useSession.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts`.
- Produces: `useSession(): { session: Session | null; loading: boolean }`; `<Login />` component that calls `supabase.auth.signInWithPassword`.

- [ ] **Step 1: Write the failing test**

Create `src/auth/useSession.test.tsx`:
```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useSession } from "./useSession";

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

describe("useSession", () => {
  it("resolves to no session and stops loading", async () => {
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/auth/useSession.test.tsx`
Expected: FAIL — cannot resolve `./useSession`.

- [ ] **Step 3: Implement the hook**

Create `src/auth/useSession.ts`:
```ts
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/auth/useSession.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement the Login screen**

Create `src/auth/Login.tsx`:
```tsx
import { useState } from "react";
import { supabase } from "../lib/supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro("E-mail ou senha inválidos.");
  }

  return (
    <form onSubmit={entrar} style={{ maxWidth: 320, margin: "20vh auto", display: "grid", gap: 12 }}>
      <h1>super-train</h1>
      <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
      {erro && <p style={{ color: "crimson" }}>{erro}</p>}
      <button type="submit">Entrar</button>
    </form>
  );
}
```

- [ ] **Step 6: Wire the gate into App**

Replace `src/App.tsx`:
```tsx
import { useSession } from "./auth/useSession";
import { Login } from "./auth/Login";

export default function App() {
  const { session, loading } = useSession();
  if (loading) return <p>Carregando…</p>;
  if (!session) return <Login />;
  return <p>Autenticado. (rotas na Task 4)</p>;
}
```

- [ ] **Step 7: Manually verify login**

Run: `npm run dev`. Open the app, sign in with the user created in Task 1 Step 3. Expected: login form → after submit, "Autenticado." Wrong password shows the error.

- [ ] **Step 8: Commit**

```bash
git add src/auth src/App.tsx
git commit -m "feat(auth): gate de login com Supabase Auth"
```

---

## Task 4: Data layer

**Files:**
- Create: `src/lib/territorios.ts`, `src/lib/publicadores.ts`, `src/lib/designacoes.ts`
- Test: `src/lib/territorios.test.ts`

**Interfaces:**
- Consumes: `supabase`, and the types from Task 2.
- Produces:
  - `listTerritorios(): Promise<Territorio[]>`
  - `criarTerritorio(input: { numero: string; nome?: string; limites: GeoJSON.Polygon }): Promise<Territorio>`
  - `setAtivo(id: string, ativo: boolean): Promise<void>`
  - `statusTerritorio(t: Territorio, designacaoAberta: Designacao | undefined): "disponivel" | "designado" | "inativo"` (pure function)
  - `listPublicadores()`, `criarPublicador({ nome, telefone? })`
  - `designacoesAbertas(): Promise<Designacao[]>` (all rows where `data_devolucao is null`)
  - `designar(territorio_id, publicador_id): Promise<Designacao>`
  - `devolver(designacao_id): Promise<void>` (sets `data_devolucao = today`)

- [ ] **Step 1: Write the failing test for the pure status function**

Create `src/lib/territorios.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { statusTerritorio } from "./territorios";
import type { Territorio, Designacao } from "./types";

const base: Territorio = { id: "t1", numero: "12", nome: null, limites: null, ativo: true, created_at: "" };

describe("statusTerritorio", () => {
  it("é 'inativo' quando ativo=false, mesmo sem designação", () => {
    expect(statusTerritorio({ ...base, ativo: false }, undefined)).toBe("inativo");
  });
  it("é 'designado' quando há designação aberta", () => {
    const d = { id: "d1", territorio_id: "t1", publicador_id: "p1", data_saida: "2026-07-01", data_devolucao: null, created_at: "" } as Designacao;
    expect(statusTerritorio(base, d)).toBe("designado");
  });
  it("é 'disponivel' quando ativo e sem designação aberta", () => {
    expect(statusTerritorio(base, undefined)).toBe("disponivel");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/territorios.test.ts`
Expected: FAIL — cannot resolve `./territorios`.

- [ ] **Step 3: Implement `territorios.ts`**

Create `src/lib/territorios.ts`:
```ts
import { supabase } from "./supabase";
import type { Territorio, Designacao } from "./types";

export function statusTerritorio(
  t: Territorio,
  designacaoAberta: Designacao | undefined,
): "disponivel" | "designado" | "inativo" {
  if (!t.ativo) return "inativo";
  if (designacaoAberta) return "designado";
  return "disponivel";
}

export async function listTerritorios(): Promise<Territorio[]> {
  const { data, error } = await supabase.from("territorio").select("*").order("numero");
  if (error) throw error;
  return data as Territorio[];
}

export async function criarTerritorio(input: {
  numero: string;
  nome?: string;
  limites: GeoJSON.Polygon;
}): Promise<Territorio> {
  const { data, error } = await supabase
    .from("territorio")
    .insert({ numero: input.numero, nome: input.nome ?? null, limites: input.limites })
    .select()
    .single();
  if (error) throw error;
  return data as Territorio;
}

export async function setAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from("territorio").update({ ativo }).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/territorios.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `publicadores.ts`**

Create `src/lib/publicadores.ts`:
```ts
import { supabase } from "./supabase";
import type { Publicador } from "./types";

export async function listPublicadores(): Promise<Publicador[]> {
  const { data, error } = await supabase.from("publicador").select("*").order("nome");
  if (error) throw error;
  return data as Publicador[];
}

export async function criarPublicador(input: { nome: string; telefone?: string }): Promise<Publicador> {
  const { data, error } = await supabase
    .from("publicador")
    .insert({ nome: input.nome, telefone: input.telefone ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as Publicador;
}
```

- [ ] **Step 6: Implement `designacoes.ts`**

Create `src/lib/designacoes.ts`:
```ts
import { supabase } from "./supabase";
import type { Designacao } from "./types";

export async function designacoesAbertas(): Promise<Designacao[]> {
  const { data, error } = await supabase
    .from("designacao")
    .select("*")
    .is("data_devolucao", null);
  if (error) throw error;
  return data as Designacao[];
}

export async function designar(territorio_id: string, publicador_id: string): Promise<Designacao> {
  const { data, error } = await supabase
    .from("designacao")
    .insert({ territorio_id, publicador_id })
    .select()
    .single();
  if (error) throw error; // unique index rejeita 2ª designação aberta no mesmo território
  return data as Designacao;
}

export async function devolver(designacao_id: string): Promise<void> {
  const { error } = await supabase
    .from("designacao")
    .update({ data_devolucao: new Date().toISOString().slice(0, 10) })
    .eq("id", designacao_id);
  if (error) throw error;
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/territorios.ts src/lib/territorios.test.ts src/lib/publicadores.ts src/lib/designacoes.ts
git commit -m "feat(data): camada de acesso territorios/publicadores/designacoes"
```

---

## Task 5: Map primitives (base map + live position + polygon)

**Files:**
- Create: `src/map/BaseMap.tsx`, `src/map/TerritorioPolygon.tsx`
- Modify: `src/main.tsx` (import `mapbox-gl/dist/mapbox-gl.css`)

**Interfaces:**
- Produces:
  - `<BaseMap initialViewState? children? showLocation?>` — wraps `react-map-gl` `Map` with the Mapbox token; when `showLocation` is set, mounts a `GeolocateControl` configured to track the user (the live "you are here").
  - `<TerritorioPolygon polygon={GeoJSON.Polygon} />` — a `Source`+`Layer` pair drawing the boundary fill + outline.

- [ ] **Step 1: Import Mapbox CSS globally**

In `src/main.tsx`, add near the top:
```ts
import "mapbox-gl/dist/mapbox-gl.css";
```

- [ ] **Step 2: Implement `BaseMap.tsx`**

Create `src/map/BaseMap.tsx`:
```tsx
import Map, { GeolocateControl, NavigationControl, type MapProps } from "react-map-gl";

const token = import.meta.env.VITE_MAPBOX_TOKEN;

export function BaseMap({
  showLocation = false,
  children,
  ...props
}: { showLocation?: boolean } & Partial<MapProps> & { children?: React.ReactNode }) {
  return (
    <Map
      mapboxAccessToken={token}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: "100%", height: "100%" }}
      initialViewState={{ longitude: -46.63, latitude: -23.55, zoom: 13 }}
      {...props}
    >
      <NavigationControl position="top-right" />
      {showLocation && (
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showUserHeading
          positionOptions={{ enableHighAccuracy: true }}
        />
      )}
      {children}
    </Map>
  );
}
```

- [ ] **Step 3: Implement `TerritorioPolygon.tsx`**

Create `src/map/TerritorioPolygon.tsx`:
```tsx
import { Source, Layer } from "react-map-gl";

export function TerritorioPolygon({ polygon }: { polygon: GeoJSON.Polygon }) {
  const feature: GeoJSON.Feature = { type: "Feature", geometry: polygon, properties: {} };
  return (
    <Source id="territorio" type="geojson" data={feature}>
      <Layer id="territorio-fill" type="fill" paint={{ "fill-color": "#0b3d91", "fill-opacity": 0.15 }} />
      <Layer id="territorio-line" type="line" paint={{ "line-color": "#0b3d91", "line-width": 3 }} />
    </Source>
  );
}
```

- [ ] **Step 4: Manually verify the base map renders**

Temporarily render `<div style={{height:"100dvh"}}><BaseMap showLocation /></div>` from `App.tsx` (post-login), run `npm run dev`, open on a phone (or responsive mode). Expected: Mapbox streets map loads; the geolocate button, when tapped and permission granted, centers on your position with a live blue dot. Revert the temporary render after verifying.

- [ ] **Step 5: Commit**

```bash
git add src/map src/main.tsx
git commit -m "feat(map): BaseMap com geolocalização ao vivo e camada de polígono"
```

---

## Task 6: Cadastro screen (draw polygon → save)

**Files:**
- Create: `src/screens/Cadastro.tsx`
- Test: `src/screens/Cadastro.test.tsx`

**Interfaces:**
- Consumes: `BaseMap`, `criarTerritorio`, mapbox-gl-draw.
- Produces: `<Cadastro />` route component.

- [ ] **Step 1: Write the failing test (form validation)**

Create `src/screens/Cadastro.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Cadastro } from "./Cadastro";

vi.mock("../map/BaseMap", () => ({ BaseMap: () => <div data-testid="map" /> }));
vi.mock("../lib/territorios", () => ({ criarTerritorio: vi.fn() }));

describe("Cadastro", () => {
  it("desabilita salvar sem número e sem polígono", () => {
    render(<Cadastro />);
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/Cadastro.test.tsx`
Expected: FAIL — cannot resolve `./Cadastro`.

- [ ] **Step 3: Implement `Cadastro.tsx`**

Create `src/screens/Cadastro.tsx`:
```tsx
import { useState, useRef, useCallback } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useControl } from "react-map-gl";
import { BaseMap } from "../map/BaseMap";
import { criarTerritorio } from "../lib/territorios";

function DrawControl({ onChange }: { onChange: (p: GeoJSON.Polygon | null) => void }) {
  useControl<MapboxDraw>(
    () => new MapboxDraw({ displayControlsDefault: false, controls: { polygon: true, trash: true } }),
    ({ map }) => {
      const read = () => {
        const fc = (map as any).getStyle && (map as any)._draw?.getAll?.();
        const feat = fc?.features?.[0];
        onChange(feat ? (feat.geometry as GeoJSON.Polygon) : null);
      };
      map.on("draw.create", read).on("draw.update", read).on("draw.delete", () => onChange(null));
    },
  );
  return null;
}

export function Cadastro() {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [polygon, setPolygon] = useState<GeoJSON.Polygon | null>(null);
  const [salvando, setSalvando] = useState(false);
  const onChange = useCallback((p: GeoJSON.Polygon | null) => setPolygon(p), []);

  async function salvar() {
    if (!numero || !polygon) return;
    setSalvando(true);
    try {
      await criarTerritorio({ numero, nome: nome || undefined, limites: polygon });
      setNumero(""); setNome(""); setPolygon(null);
      alert("Território salvo.");
    } catch (e: any) {
      alert(e?.message?.includes("duplicate") ? "Já existe um território com esse número." : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100dvh" }}>
      <div style={{ display: "flex", gap: 8, padding: 8 }}>
        <input placeholder="Número*" value={numero} onChange={(e) => setNumero(e.target.value)} />
        <input placeholder="Nome (opcional)" value={nome} onChange={(e) => setNome(e.target.value)} />
        <button onClick={salvar} disabled={!numero || !polygon || salvando}>Salvar</button>
      </div>
      <BaseMap>
        <DrawControl onChange={onChange} />
      </BaseMap>
    </div>
  );
}
```

> Note for implementer: `useControl` from `react-map-gl` registers the `MapboxDraw` instance as a real map control. Reading the drawn feature via the `draw.*` events is the reliable path; verify `getAll()` access against the installed `@mapbox/mapbox-gl-draw` version and adjust the accessor if the internal `_draw` handle differs — the public API is `draw.getAll()` on the control instance returned by `useControl`, so prefer capturing that instance in a ref if the event target does not expose it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/Cadastro.test.tsx`
Expected: PASS.

- [ ] **Step 5: Manually verify draw + save**

`npm run dev` → Cadastro route. Draw a polygon, type a número, click Salvar. Expected: "Território salvo." Reload and confirm via Gestão (Task 7) or SQL that the row exists with `limites` populated. Saving a duplicate número shows the friendly error.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Cadastro.tsx src/screens/Cadastro.test.tsx
git commit -m "feat(cadastro): desenhar polígono e salvar território"
```

---

## Task 7: Gestão screen (list/status, publicadores, designar/devolver)

**Files:**
- Create: `src/screens/Gestao.tsx`
- Test: `src/screens/Gestao.test.tsx`

**Interfaces:**
- Consumes: `listTerritorios`, `setAtivo`, `statusTerritorio`, `listPublicadores`, `criarPublicador`, `designacoesAbertas`, `designar`, `devolver`.
- Produces: `<Gestao />` route component.

- [ ] **Step 1: Write the failing test (renders status from data)**

Create `src/screens/Gestao.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Gestao } from "./Gestao";

vi.mock("../lib/territorios", async (orig) => {
  const actual = await (orig() as Promise<any>);
  return {
    ...actual,
    listTerritorios: vi.fn().mockResolvedValue([
      { id: "t1", numero: "12", nome: "Centro", limites: null, ativo: true, created_at: "" },
    ]),
    setAtivo: vi.fn(),
  };
});
vi.mock("../lib/publicadores", () => ({ listPublicadores: vi.fn().mockResolvedValue([]), criarPublicador: vi.fn() }));
vi.mock("../lib/designacoes", () => ({ designacoesAbertas: vi.fn().mockResolvedValue([]), designar: vi.fn(), devolver: vi.fn() }));

describe("Gestao", () => {
  it("mostra o território como disponível", async () => {
    render(<Gestao />);
    await waitFor(() => expect(screen.getByText(/12/)).toBeInTheDocument());
    expect(screen.getByText(/disponível/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/Gestao.test.tsx`
Expected: FAIL — cannot resolve `./Gestao`.

- [ ] **Step 3: Implement `Gestao.tsx`**

Create `src/screens/Gestao.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTerritorios, setAtivo, statusTerritorio } from "../lib/territorios";
import { listPublicadores, criarPublicador } from "../lib/publicadores";
import { designacoesAbertas, designar, devolver } from "../lib/designacoes";
import type { Territorio, Publicador, Designacao } from "../lib/types";

export function Gestao() {
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [abertas, setAbertas] = useState<Designacao[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoTel, setNovoTel] = useState("");

  async function carregar() {
    const [t, p, d] = await Promise.all([listTerritorios(), listPublicadores(), designacoesAbertas()]);
    setTerritorios(t); setPublicadores(p); setAbertas(d);
  }
  useEffect(() => { carregar(); }, []);

  const abertaDe = (tid: string) => abertas.find((d) => d.territorio_id === tid);
  const nomePub = (pid: string) => publicadores.find((p) => p.id === pid)?.nome ?? "?";

  async function addPublicador() {
    if (!novoNome) return;
    await criarPublicador({ nome: novoNome, telefone: novoTel || undefined });
    setNovoNome(""); setNovoTel(""); carregar();
  }

  return (
    <div style={{ padding: 12, display: "grid", gap: 24 }}>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link to="/cadastro">Cadastrar território</Link>
      </nav>

      <section>
        <h2>Territórios</h2>
        <table>
          <thead><tr><th>Nº</th><th>Nome</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            {territorios.map((t) => {
              const d = abertaDe(t.id);
              const status = statusTerritorio(t, d);
              return (
                <tr key={t.id}>
                  <td><Link to={`/campo/${t.id}`}>{t.numero}</Link></td>
                  <td>{t.nome ?? "—"}</td>
                  <td>
                    {status === "designado" ? `Designado a ${nomePub(d!.publicador_id)} (desde ${d!.data_saida})`
                      : status === "inativo" ? "Inativo"
                      : "Disponível"}
                  </td>
                  <td>
                    {d ? (
                      <button onClick={async () => { await devolver(d.id); carregar(); }}>Devolver</button>
                    ) : (
                      <select defaultValue="" onChange={async (e) => { if (e.target.value) { await designar(t.id, e.target.value); carregar(); } }}>
                        <option value="" disabled>Designar a…</option>
                        {publicadores.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </select>
                    )}
                    <label style={{ marginLeft: 8 }}>
                      <input type="checkbox" checked={t.ativo} onChange={async (e) => { await setAtivo(t.id, e.target.checked); carregar(); }} /> ativo
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Publicadores</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Nome*" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          <input placeholder="Telefone" value={novoTel} onChange={(e) => setNovoTel(e.target.value)} />
          <button onClick={addPublicador} disabled={!novoNome}>Adicionar</button>
        </div>
        <ul>{publicadores.map((p) => <li key={p.id}>{p.nome}{p.telefone ? ` — ${p.telefone}` : ""}</li>)}</ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/Gestao.test.tsx`
Expected: PASS.

- [ ] **Step 5: Manually verify the full assignment cycle**

`npm run dev` → Gestão. Add a publicador; designe a território to him (status → "Designado a …"); try designating the same território to a second publicador — the DB unique index blocks a second open assignment (the select only appears when there is no open assignment, so this is naturally prevented in UI; verify at data level by attempting via console that `designar` on an already-open território throws). Click Devolver (status → "Disponível"). Toggle "ativo" off (status → "Inativo").

- [ ] **Step 6: Commit**

```bash
git add src/screens/Gestao.tsx src/screens/Gestao.test.tsx
git commit -m "feat(gestao): status, publicadores e ciclo designar/devolver"
```

---

## Task 8: Campo screen (polygon + live position) + routing

**Files:**
- Create: `src/screens/Campo.tsx`
- Modify: `src/App.tsx`, `src/main.tsx` (router)
- Test: `src/screens/Campo.test.tsx`

**Interfaces:**
- Consumes: `BaseMap`, `TerritorioPolygon`, `listTerritorios` (to fetch one by id), `useParams`.
- Produces: `<Campo />` route at `/campo/:id`; full route table in `App`.

- [ ] **Step 1: Write the failing test**

Create `src/screens/Campo.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Campo } from "./Campo";

vi.mock("../map/BaseMap", () => ({ BaseMap: ({ children }: any) => <div data-testid="map">{children}</div> }));
vi.mock("../map/TerritorioPolygon", () => ({ TerritorioPolygon: () => <div data-testid="poly" /> }));
vi.mock("../lib/territorios", () => ({
  listTerritorios: vi.fn().mockResolvedValue([
    { id: "t1", numero: "12", nome: "Centro", limites: { type: "Polygon", coordinates: [] }, ativo: true, created_at: "" },
  ]),
}));

describe("Campo", () => {
  it("renderiza o polígono do território pedido", async () => {
    render(
      <MemoryRouter initialEntries={["/campo/t1"]}>
        <Routes><Route path="/campo/:id" element={<Campo />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("poly")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/Campo.test.tsx`
Expected: FAIL — cannot resolve `./Campo`.

- [ ] **Step 3: Implement `Campo.tsx`**

Create `src/screens/Campo.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BaseMap } from "../map/BaseMap";
import { TerritorioPolygon } from "../map/TerritorioPolygon";
import { listTerritorios } from "../lib/territorios";
import type { Territorio } from "../lib/types";

// Centro do polígono (média dos vértices do anel externo) para enquadrar o mapa.
function centro(p: GeoJSON.Polygon): { longitude: number; latitude: number } | null {
  const ring = p.coordinates?.[0];
  if (!ring?.length) return null;
  const [sx, sy] = ring.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
  return { longitude: sx / ring.length, latitude: sy / ring.length };
}

export function Campo() {
  const { id } = useParams();
  const [t, setT] = useState<Territorio | null>(null);

  useEffect(() => {
    listTerritorios().then((all) => setT(all.find((x) => x.id === id) ?? null));
  }, [id]);

  if (!t) return <p>Carregando território…</p>;
  const c = t.limites ? centro(t.limites) : null;

  return (
    <div style={{ height: "100dvh" }}>
      <BaseMap
        showLocation
        initialViewState={c ? { ...c, zoom: 15 } : undefined}
      >
        {t.limites && <TerritorioPolygon polygon={t.limites} />}
      </BaseMap>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/screens/Campo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the router**

Replace `src/main.tsx` router body and `src/App.tsx` to route the three screens behind the auth gate:

`src/App.tsx`:
```tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./auth/useSession";
import { Login } from "./auth/Login";
import { Gestao } from "./screens/Gestao";
import { Cadastro } from "./screens/Cadastro";
import { Campo } from "./screens/Campo";

export default function App() {
  const { session, loading } = useSession();
  if (loading) return <p>Carregando…</p>;
  if (!session) return <Login />;
  return (
    <Routes>
      <Route path="/" element={<Gestao />} />
      <Route path="/cadastro" element={<Cadastro />} />
      <Route path="/campo/:id" element={<Campo />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

`src/main.tsx` (wrap in `BrowserRouter`):
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "mapbox-gl/dist/mapbox-gl.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 6: Full manual walkthrough (on a phone)**

`npm run dev` (or `npm run build && npm run preview`) and open on your phone over the LAN. Sign in → Gestão lists territórios → tap a número → Campo shows the boundary; tap the geolocate button → your live blue dot appears inside/near the polygon. This is the core "não me perco" flow. Expected: boundary + live position visible together.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Campo.tsx src/screens/Campo.test.tsx src/App.tsx src/main.tsx
git commit -m "feat(campo): mapa do território com posição ao vivo + rotas"
```

---

## Self-Review Notes

- **Spec coverage:** single-tenant/no congregação (Task 1 + Global Constraints) · only servant logs in (Task 3) · publishers as name records (Task 4/7) · live location essential (Task 5 GeolocateControl, Task 8 Campo) · GeoJSON polygon, no PostGIS (Tasks 1/6) · Mapbox GL (Task 5) · assume signal / online tiles (Task 5) · nav + assignment management both in MVP (Tasks 6–8) · 3 tables + partial unique index + RLS (Task 1) · derived status (Task 4 `statusTerritorio`) · `ativo` flag (Tasks 1/4/7) · no Storage (nothing uploads) · fields `numero` unique + `nome` optional, `nome`+`telefone` publicador, dates-only designação (Tasks 1/4). All covered.
- **Out of scope confirmed absent:** endereços/"não bater", grupos, publisher login, offline tiles, `tipo`, `observacao`, Storage — none appear in any task.
- **Type consistency:** `statusTerritorio` returns `"disponivel" | "designado" | "inativo"` and is used identically in Task 7. Data-layer signatures declared in Task 4 Interfaces match their call sites in Tasks 6–8.
- **Known implementer caution:** the mapbox-gl-draw feature-read accessor (Task 6 Step 3 note) may need a small adjustment to the installed version's API; the public `draw.getAll()` path is documented inline.
```
