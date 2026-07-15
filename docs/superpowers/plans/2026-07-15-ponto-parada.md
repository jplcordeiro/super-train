# Ponto de parada ("paramos aqui") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir registrar no mapa **onde o grupo parou** numa quadra (um pino "comece por aqui"), criando o terceiro estado *em andamento* entre *feita* e *falta*.

**Architecture:** Nova tabela `ponto_parada` (um pino por quadra, com a saída que o deixou). Uma camada de dados pura/tipada em `quadras.ts` deriva o estado e o progresso. O mapa (`TerritorioPolygon`) ganha o estado `andamento` e renderiza os pinos; `MarcarQuadras` ganha um botão de modo para largar/mover/remover o pino; `Campo` e `Gestão` passam a exibir os pinos e a contagem.

**Tech Stack:** React 19 + TypeScript + Vite, Supabase (Postgres + RLS), `react-map-gl/mapbox` (Mapbox GL), Tailwind v4, Vitest + Testing Library.

## Global Constraints

- **Sem comentários no código** (CLAUDE.md) — nomes claros bastam.
- **Só `src/lib/` toca no Supabase.** UI nunca chama `supabase` direto.
- **Estado é derivado, nunca armazenado** (feita/andamento/falta saem de funções puras).
- **Cor do estado `andamento`:** reusar o token existente `--color-ocre` (`#8a6636`); **não criar token novo**. No mapa, fill `#8a6636` opacidade `0.30`. Fora do mapa, utilitários `ocre` / `ocre-wash`.
- **Regra da rodada:** um pino só conta se `data da saída >= territorio.progresso_desde` (mesma linha de corte de `marcasDaRodada`). Nova rodada nunca apaga pinos.
- **Exclusão mútua feita × andamento:** feita sempre vence; `paradaAtualDe` exclui quadras já feitas.
- **Migrations aplicadas à mão** no Supabase SQL Editor (MCP é read-only); o arquivo `.sql` é só commitado aqui.
- **Testes:** `npx vitest run <arquivo>` para um arquivo; `npm run build` faz typecheck (`tsc -b`) + bundle.

---

### Task 1: Migration `ponto_parada`

**Files:**
- Create: `supabase/migrations/0004_ponto_parada.sql`

**Interfaces:**
- Consumes: tabela `saida_territorio (saida_id, territorio_id)` de `0002`.
- Produces: tabela `ponto_parada (territorio_id, quadra_id, saida_id, lng, lat, created_at)`, pk `(territorio_id, quadra_id)`, RLS `authenticated` full.

- [ ] **Step 1: Criar o arquivo de migration**

Create `supabase/migrations/0004_ponto_parada.sql`:

```sql
-- super-train — ponto de parada ("paramos aqui")
-- Rode este arquivo em Supabase → SQL Editor (uma vez).

-- Um pino por quadra: onde o grupo parou, pra próxima saída continuar dali.
-- saida_id registra qual saída deixou o pino (data/local/dirigente saem dela).
-- FK composta para saida_territorio, como quadra_feita: só se marca de um
-- território que está naquela saída, e o cascade limpa o pino quando a saída
-- é apagada ou o território sai dela.
create table if not exists ponto_parada (
  territorio_id uuid not null,
  quadra_id     text not null,
  saida_id      uuid not null,
  lng           double precision not null,
  lat           double precision not null,
  created_at    timestamptz not null default now(),
  primary key (territorio_id, quadra_id),
  foreign key (saida_id, territorio_id)
    references saida_territorio (saida_id, territorio_id) on delete cascade
);

alter table ponto_parada enable row level security;

drop policy if exists "auth_full_ponto_parada" on ponto_parada;
create policy "auth_full_ponto_parada" on ponto_parada
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0004_ponto_parada.sql
git commit -m "feat(quadras): migration da tabela ponto_parada"
```

> Nota para quem executa: aplique o SQL no Supabase SQL Editor antes de testar as telas de verdade. Os testes unitários não dependem disso (mockam o Supabase).

---

### Task 2: Camada de dados em `quadras.ts`

**Files:**
- Modify: `src/lib/quadras.ts`
- Test: `src/lib/quadras.test.ts`

**Interfaces:**
- Consumes: `quadrasDe`, `quadrasFeitasDe`, `Territorio`, `Marca`, `SaidaRow` (já em `quadras.ts`), `supabase`.
- Produces:
  - `interface Parada { territorio_id: string; quadra_id: string; saida_id: string; lng: number; lat: number; data: string; local: string | null; publicador_id: string | null }`
  - `interface Progresso { feitas: number; total: number; emAndamento: number; concluido: boolean }` (campo `emAndamento` novo)
  - `paradasDaRodada(t: Territorio, paradas: Parada[]): Parada[]`
  - `paradaAtualDe(t: Territorio, marcas: Marca[], paradas: Parada[]): Map<string, Parada>`
  - `progressoDe(t: Territorio, marcas: Marca[], paradas?: Parada[]): Progresso`
  - `listParadas(): Promise<Parada[]>`
  - `pararEm(saida_id, territorio_id, quadra_id, lng, lat): Promise<void>`
  - `limparParada(territorio_id, quadra_id): Promise<void>`

- [ ] **Step 1: Escrever os testes que falham**

Em `src/lib/quadras.test.ts`, no bloco de mock do supabase (topo), adicione `ponto_parada` às linhas:

```ts
const linhas: Record<string, unknown[]> = {
  quadra_feita: [],
  saida: [],
  ponto_parada: [],
};
```

Estenda os imports do topo:

```ts
import {
  listMarcas,
  listParadas,
  historicoDaQuadra,
  marcasDaRodada,
  paradasDaRodada,
  paradaAtualDe,
  quadrasFeitasDe,
  progressoDe,
} from "./quadras";
import type { Marca, Parada } from "./quadras";
```

Adicione um helper `parada` logo após o helper `marca` existente:

```ts
const parada = (quadra_id: string, data: string, saida_id = "s1"): Parada => ({
  saida_id,
  territorio_id: "t1",
  quadra_id,
  lng: -46,
  lat: -23,
  data,
  local: null,
  publicador_id: null,
});
```

Substitua o bloco `describe("progressoDe", ...)` inteiro por esta versão (inclui `emAndamento`) e acrescente os novos blocos ao final do arquivo:

```ts
describe("progressoDe", () => {
  it("mostra as quadras feitas sobre o total do território", () => {
    const t = territorio(["a", "b", "c"]);
    expect(progressoDe(t, [marca("a", "2026-07-12")])).toEqual({
      feitas: 1,
      total: 3,
      emAndamento: 0,
      concluido: false,
    });
  });

  it("é concluído quando todas as quadras foram feitas", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-07-12"), marca("b", "2026-07-12")];
    expect(progressoDe(t, marcas)).toEqual({
      feitas: 2,
      total: 2,
      emAndamento: 0,
      concluido: true,
    });
  });

  it("volta a zero depois de a rodada ser zerada, sem apagar as marcas antigas", () => {
    const marcas = [marca("a", "2026-07-12"), marca("b", "2026-07-12")];
    const zerado = territorio(["a", "b"], "2026-07-13");
    expect(progressoDe(zerado, marcas)).toEqual({
      feitas: 0,
      total: 2,
      emAndamento: 0,
      concluido: false,
    });
  });

  it("a quadra órfã não infla o total nem o feito", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-07-12"), marca("sumiu", "2026-07-12")];
    expect(progressoDe(t, marcas)).toEqual({
      feitas: 1,
      total: 2,
      emAndamento: 0,
      concluido: false,
    });
  });

  it("território sem limites não tem progresso nem fica concluído", () => {
    const semLimites: Territorio = { ...territorio([]), limites: null };
    expect(progressoDe(semLimites, [])).toEqual({
      feitas: 0,
      total: 0,
      emAndamento: 0,
      concluido: false,
    });
  });

  it("conta como em andamento o pino de uma quadra ainda não feita", () => {
    const t = territorio(["a", "b", "c"]);
    const marcas = [marca("a", "2026-07-12")];
    const paradas = [parada("b", "2026-07-12")];
    expect(progressoDe(t, marcas, paradas)).toEqual({
      feitas: 1,
      total: 3,
      emAndamento: 1,
      concluido: false,
    });
  });
});

describe("listParadas", () => {
  it("traz data, local e dirigente do pino a partir da saída dele", async () => {
    linhas.ponto_parada = [
      { territorio_id: "t1", quadra_id: "qa", saida_id: "s1", lng: -46.1, lat: -23.2 },
    ];
    linhas.saida = [
      { id: "s1", data: "2026-07-12", local: "Gruta da Ilha", publicador_id: "p1" },
    ];

    expect(await listParadas()).toEqual([
      {
        territorio_id: "t1",
        quadra_id: "qa",
        saida_id: "s1",
        lng: -46.1,
        lat: -23.2,
        data: "2026-07-12",
        local: "Gruta da Ilha",
        publicador_id: "p1",
      },
    ]);
  });

  it("descarta o pino cuja saída sumiu, em vez de inventar uma data", async () => {
    linhas.ponto_parada = [
      { territorio_id: "t1", quadra_id: "qa", saida_id: "sumiu", lng: -46, lat: -23 },
    ];
    linhas.saida = [{ id: "s1", data: "2026-07-12", local: null, publicador_id: null }];

    expect(await listParadas()).toEqual([]);
  });
});

describe("paradasDaRodada", () => {
  it("conta tudo quando a rodada nunca foi zerada", () => {
    const t = territorio(["a", "b"]);
    const paradas = [parada("a", "2026-01-10"), parada("b", "2026-07-12")];
    expect(paradasDaRodada(t, paradas)).toHaveLength(2);
  });

  it("descarta os pinos anteriores à linha de corte", () => {
    const t = territorio(["a", "b"], "2026-07-01");
    const paradas = [parada("a", "2026-06-28"), parada("b", "2026-07-12")];
    expect(paradasDaRodada(t, paradas).map((p) => p.quadra_id)).toEqual(["b"]);
  });

  it("ignora pinos de outro território", () => {
    const t = territorio(["a"]);
    const deOutro: Parada = { ...parada("a", "2026-07-12"), territorio_id: "t2" };
    expect(paradasDaRodada(t, [deOutro])).toEqual([]);
  });
});

describe("paradaAtualDe", () => {
  it("devolve o pino de uma quadra ainda não feita", () => {
    const t = territorio(["a", "b"]);
    const atual = paradaAtualDe(t, [], [parada("b", "2026-07-12")]);
    expect([...atual.keys()]).toEqual(["b"]);
  });

  it("exclui o pino de uma quadra que já está feita (feita vence)", () => {
    const t = territorio(["a", "b"]);
    const atual = paradaAtualDe(t, [marca("b", "2026-07-12")], [parada("b", "2026-07-12")]);
    expect(atual.size).toBe(0);
  });

  it("exclui o pino de uma saída anterior à linha de corte", () => {
    const t = territorio(["a"], "2026-07-01");
    const atual = paradaAtualDe(t, [], [parada("a", "2026-06-28")]);
    expect(atual.size).toBe(0);
  });

  it("exclui o pino de uma quadra que não existe mais no desenho", () => {
    const t = territorio(["a"]);
    const atual = paradaAtualDe(t, [], [parada("sumiu", "2026-07-12")]);
    expect(atual.size).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx vitest run src/lib/quadras.test.ts`
Expected: FAIL — `listParadas`, `paradasDaRodada`, `paradaAtualDe` não existem e `progressoDe` não tem `emAndamento`.

- [ ] **Step 3: Implementar em `src/lib/quadras.ts`**

Substitua a `interface Progresso` por:

```ts
export interface Progresso {
  feitas: number;
  total: number;
  emAndamento: number;
  concluido: boolean;
}
```

Adicione o tipo `Parada` logo após a interface `PassagemQuadra`:

```ts
export interface Parada {
  territorio_id: string;
  quadra_id: string;
  saida_id: string;
  lng: number;
  lat: number;
  data: string;
  local: string | null;
  publicador_id: string | null;
}
```

Adicione as funções puras (perto de `marcasDaRodada` / `quadrasFeitasDe`):

```ts
export function paradasDaRodada(t: Territorio, paradas: Parada[]): Parada[] {
  return paradas.filter(
    (p) =>
      p.territorio_id === t.id && (!t.progresso_desde || p.data >= t.progresso_desde),
  );
}

export function paradaAtualDe(
  t: Territorio,
  marcas: Marca[],
  paradas: Parada[],
): Map<string, Parada> {
  const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
  const feitas = quadrasFeitasDe(t, marcas);
  const atual = new Map<string, Parada>();
  for (const p of paradasDaRodada(t, paradas)) {
    if (!existentes.has(p.quadra_id) || feitas.has(p.quadra_id)) continue;
    atual.set(p.quadra_id, p);
  }
  return atual;
}
```

Substitua `progressoDe`:

```ts
export function progressoDe(
  t: Territorio,
  marcas: Marca[],
  paradas: Parada[] = [],
): Progresso {
  const total = quadrasDe(t.limites).length;
  const feitas = quadrasFeitasDe(t, marcas).size;
  const emAndamento = paradaAtualDe(t, marcas, paradas).size;
  return { feitas, total, emAndamento, concluido: total > 0 && feitas === total };
}
```

Adicione as funções de acesso ao Supabase (perto de `listMarcas` / `marcarQuadra`), reusando o `SaidaRow` já declarado no arquivo:

```ts
type ParadaRow = {
  territorio_id: string;
  quadra_id: string;
  saida_id: string;
  lng: number;
  lat: number;
};

export async function listParadas(): Promise<Parada[]> {
  const [paradas, saidas] = await Promise.all([
    supabase.from("ponto_parada").select("territorio_id, quadra_id, saida_id, lng, lat"),
    supabase.from("saida").select("id, data, local, publicador_id"),
  ]);
  if (paradas.error) throw paradas.error;
  if (saidas.error) throw saidas.error;

  const saidaDe = new Map((saidas.data as SaidaRow[]).map((s) => [s.id, s]));
  return (paradas.data as ParadaRow[]).flatMap((p) => {
    const s = saidaDe.get(p.saida_id);
    return s
      ? [{ ...p, data: s.data, local: s.local, publicador_id: s.publicador_id }]
      : [];
  });
}

export async function pararEm(
  saida_id: string,
  territorio_id: string,
  quadra_id: string,
  lng: number,
  lat: number,
): Promise<void> {
  const { error } = await supabase
    .from("ponto_parada")
    .upsert(
      { saida_id, territorio_id, quadra_id, lng, lat },
      { onConflict: "territorio_id,quadra_id" },
    );
  if (error) throw error;
}

export async function limparParada(
  territorio_id: string,
  quadra_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("ponto_parada")
    .delete()
    .eq("territorio_id", territorio_id)
    .eq("quadra_id", quadra_id);
  if (error) throw error;
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx vitest run src/lib/quadras.test.ts`
Expected: PASS (todos, incluindo os novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/quadras.ts src/lib/quadras.test.ts
git commit -m "feat(quadras): camada de dados do ponto de parada (listParadas, pararEm, paradaAtualDe, progresso emAndamento)"
```

---

### Task 3: Estado `andamento` e pinos em `TerritorioPolygon`

**Files:**
- Modify: `src/map/TerritorioPolygon.tsx`

**Interfaces:**
- Consumes: `featureCollectionDe`, `Limites`, `PassagemQuadra`, `Marker` de `react-map-gl/mapbox`, `MapPin` de `lucide-react`, `cn` de `@/lib/utils`.
- Produces:
  - `EstadoQuadra` passa a incluir `"andamento"`.
  - Prop nova `paradas?: { quadraId: string; lng: number; lat: number }[]`.
  - Prop nova `onParadaClick?: (quadraId: string) => void`.
  - `onQuadraClick` passa a ter assinatura `(quadraId: string, lngLat: { lng: number; lat: number }) => void`.

- [ ] **Step 1: Atualizar os imports e o mapa de cores**

Troque a linha de import do react-map-gl e acrescente os utilitários:

```ts
import { Source, Layer, Popup, Marker, useMap } from "react-map-gl/mapbox";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
```

Substitua o tipo e o mapa de cores:

```ts
export type EstadoQuadra = "feita" | "outra" | "falta" | "andamento";

const CORES: Record<EstadoQuadra, { fill: string; opacidade: number }> = {
  feita: { fill: "#5c8a76", opacidade: 0.42 },
  outra: { fill: "#5c8a76", opacidade: 0.16 },
  andamento: { fill: "#8a6636", opacidade: 0.3 },
  falta: { fill: "#486492", opacidade: 0.12 },
};
```

Substitua a expressão `porEstado` para incluir o novo estado:

```ts
const porEstado = (
  chave: "fill" | "opacidade",
): mapboxgl.ExpressionSpecification => [
  "match",
  ["get", "estado"],
  "feita",
  CORES.feita[chave],
  "outra",
  CORES.outra[chave],
  "andamento",
  CORES.andamento[chave],
  CORES.falta[chave],
];
```

- [ ] **Step 2: Atualizar as props e o clique da quadra**

Substitua a assinatura do componente:

```ts
export function TerritorioPolygon({
  limites,
  estados,
  paradas,
  onQuadraClick,
  onParadaClick,
  historicoDe,
}: {
  limites: Limites;
  estados?: Record<string, EstadoQuadra>;
  paradas?: { quadraId: string; lng: number; lat: number }[];
  onQuadraClick?: (quadraId: string, lngLat: { lng: number; lat: number }) => void;
  onParadaClick?: (quadraId: string) => void;
  historicoDe?: (quadraId: string) => PassagemQuadra[];
}) {
```

Dentro do `useEffect`, no handler `clique`, passe também o `lngLat`:

```ts
    const clique = (e: mapboxgl.MapLayerMouseEvent) => {
      if (abriuNoToque.current) {
        abriuNoToque.current = false;
        return;
      }
      setAberto(null);
      const id = quadraDe(e);
      if (id && onQuadraClick)
        onQuadraClick(id, { lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
```

- [ ] **Step 3: Renderizar os pinos**

Dentro do `<Source>`, logo antes do bloco `{aberto && historicoDe && (`, adicione os markers:

```tsx
      {paradas?.map((p) => (
        <Marker
          key={p.quadraId}
          longitude={p.lng}
          latitude={p.lat}
          anchor="bottom"
          onClick={
            onParadaClick
              ? (e) => {
                  e.originalEvent.stopPropagation();
                  onParadaClick(p.quadraId);
                }
              : undefined
          }
        >
          <div
            className={cn(
              "grid size-6 place-items-center rounded-full border-2 border-white bg-ocre text-white shadow-card",
              onParadaClick && "cursor-pointer",
            )}
          >
            <MapPin className="size-3.5" aria-hidden="true" />
          </div>
        </Marker>
      ))}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run build && npm run lint`
Expected: sem erros de tipo (os chamadores atuais de `onQuadraClick` continuam válidos — uma função que ignora o 2º argumento é atribuível).

- [ ] **Step 5: Commit**

```bash
git add src/map/TerritorioPolygon.tsx
git commit -m "feat(map): estado andamento e pinos de parada no TerritorioPolygon"
```

---

### Task 4: Modo "Paramos aqui" em `MarcarQuadras`

**Files:**
- Modify: `src/screens/MarcarQuadras.tsx`
- Test: `src/screens/MarcarQuadras.test.tsx`

**Interfaces:**
- Consumes: `listParadas`, `pararEm`, `limparParada`, `paradaAtualDe`, `Parada` (Task 2); `TerritorioPolygon` com `paradas` / `onParadaClick` / `onQuadraClick(id, lngLat)` (Task 3); `cn` de `@/lib/utils`; `Check`, `MapPin` de `lucide-react`.
- Produces: tela com botão de modo (`feita` / `parada`), que grava/move/remove o pino e mantém a exclusão mútua feita × andamento.

- [ ] **Step 1: Atualizar os testes**

Em `src/screens/MarcarQuadras.test.tsx`, troque o import de `fireEvent`:

```ts
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
```

Substitua o mock de `TerritorioPolygon` e o objeto `props` (topo) por esta versão, que captura também `paradas` e `onParadaClick` e usa a nova assinatura de `onQuadraClick`:

```ts
const props: {
  estados?: Record<string, EstadoQuadra>;
  paradas?: { quadraId: string; lng: number; lat: number }[];
  onQuadraClick?: (id: string, lngLat: { lng: number; lat: number }) => void;
  onParadaClick?: (id: string) => void;
} = {};

vi.mock("../map/BaseMap", () => ({
  BaseMap: (p: { children?: React.ReactNode }) => (
    <div data-testid="map">{p.children}</div>
  ),
}));
vi.mock("../map/TerritorioPolygon", () => ({
  TerritorioPolygon: (p: {
    estados?: Record<string, EstadoQuadra>;
    paradas?: { quadraId: string; lng: number; lat: number }[];
    onQuadraClick?: (id: string, lngLat: { lng: number; lat: number }) => void;
    onParadaClick?: (id: string) => void;
  }) => {
    props.estados = p.estados;
    props.paradas = p.paradas;
    props.onQuadraClick = p.onQuadraClick;
    props.onParadaClick = p.onParadaClick;
    return <div data-testid="poly" />;
  },
}));
```

Substitua o mock de `../lib/quadras` para incluir as novas funções:

```ts
vi.mock("../lib/quadras", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/quadras")>()),
  listMarcas: vi.fn(),
  listParadas: vi.fn(),
  marcarQuadra: vi.fn().mockResolvedValue(undefined),
  desmarcarQuadra: vi.fn().mockResolvedValue(undefined),
  pararEm: vi.fn().mockResolvedValue(undefined),
  limparParada: vi.fn().mockResolvedValue(undefined),
}));
```

No `beforeEach`, resete e dê um default a `listParadas`:

```ts
  beforeEach(async () => {
    const { listMarcas, listParadas, marcarQuadra, desmarcarQuadra, pararEm, limparParada } =
      await import("../lib/quadras");
    vi.mocked(marcarQuadra).mockClear();
    vi.mocked(desmarcarQuadra).mockClear();
    vi.mocked(pararEm).mockClear();
    vi.mocked(limparParada).mockClear();
    vi.mocked(listParadas).mockResolvedValue([]);
    vi.mocked(listMarcas).mockResolvedValue([
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qa",
        data: "2026-07-12",
        local: null,
        publicador_id: null,
      },
      {
        saida_id: "s0",
        territorio_id: "t1",
        quadra_id: "qb",
        data: "2026-07-05",
        local: null,
        publicador_id: null,
      },
    ]);
    toastInfo.mockClear();
  });
```

Acrescente estes testes ao final do `describe("MarcarQuadras", ...)`:

```ts
  it("no modo paramos, tocar numa quadra grava o ponto onde tocou", async () => {
    const { pararEm } = await import("../lib/quadras");
    await renderTela();

    fireEvent.click(screen.getByRole("button", { name: /paramos aqui/i }));
    await act(async () =>
      props.onQuadraClick?.("qc", { lng: -45.5, lat: -22.5 }),
    );

    expect(pararEm).toHaveBeenCalledWith("s1", "t1", "qc", -45.5, -22.5);
    await waitFor(() => expect(props.estados?.qc).toBe("andamento"));
  });

  it("no modo paramos, largar pino numa quadra feita tira a marca e vira andamento", async () => {
    const { pararEm, desmarcarQuadra } = await import("../lib/quadras");
    await renderTela();

    fireEvent.click(screen.getByRole("button", { name: /paramos aqui/i }));
    await act(async () => props.onQuadraClick?.("qa", { lng: -46, lat: -23 }));

    expect(pararEm).toHaveBeenCalledWith("s1", "t1", "qa", -46, -23);
    expect(desmarcarQuadra).toHaveBeenCalledWith("s1", "t1", "qa");
    await waitFor(() => expect(props.estados?.qa).toBe("andamento"));
  });

  it("tocar no pino remove o ponto de parada", async () => {
    const { listParadas, limparParada } = await import("../lib/quadras");
    vi.mocked(listParadas).mockResolvedValue([
      {
        territorio_id: "t1",
        quadra_id: "qc",
        saida_id: "s1",
        lng: -45.5,
        lat: -22.5,
        data: "2026-07-12",
        local: null,
        publicador_id: null,
      },
    ]);
    await renderTela();
    expect(props.estados?.qc).toBe("andamento");

    await act(async () => props.onParadaClick?.("qc"));

    expect(limparParada).toHaveBeenCalledWith("t1", "qc");
    await waitFor(() => expect(props.estados?.qc).toBeUndefined());
  });

  it("no modo feita, marcar uma quadra que tinha pino limpa o pino", async () => {
    const { listParadas, marcarQuadra, limparParada } = await import("../lib/quadras");
    vi.mocked(listParadas).mockResolvedValue([
      {
        territorio_id: "t1",
        quadra_id: "qc",
        saida_id: "s1",
        lng: -45.5,
        lat: -22.5,
        data: "2026-07-12",
        local: null,
        publicador_id: null,
      },
    ]);
    await renderTela();

    await act(async () => props.onQuadraClick?.("qc", { lng: -45.5, lat: -22.5 }));

    expect(marcarQuadra).toHaveBeenCalledWith("s1", "t1", "qc");
    expect(limparParada).toHaveBeenCalledWith("t1", "qc");
    await waitFor(() => expect(props.estados?.qc).toBe("feita"));
  });
```

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx vitest run src/screens/MarcarQuadras.test.tsx`
Expected: FAIL — não há botão "Paramos aqui" nem uso de `pararEm`/`limparParada`.

- [ ] **Step 3: Reescrever `src/screens/MarcarQuadras.tsx`**

Substitua o arquivo inteiro por:

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { BaseMap } from "../map/BaseMap";
import { TerritorioPolygon, type EstadoQuadra } from "../map/TerritorioPolygon";
import { boundsDeTerritorios, listTerritorios, quadrasDe } from "../lib/territorios";
import {
  desmarcarQuadra,
  historicoDaQuadra,
  limparParada,
  listMarcas,
  listParadas,
  marcarQuadra,
  marcasDaRodada,
  paradaAtualDe,
  pararEm,
  type Marca,
  type Parada,
} from "../lib/quadras";
import { listPublicadores } from "../lib/publicadores";
import { buscarSaida, dataBR, diaDaSemana, DIA_SEMANA } from "../lib/saidas";
import type { Publicador, Saida, Territorio } from "../lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RadarLoader } from "../components/RadarLoader";

type Modo = "feita" | "parada";

export function MarcarQuadras() {
  const { saidaId, territorioId } = useParams();
  const [saida, setSaida] = useState<Saida | null>(null);
  const [territorio, setTerritorio] = useState<Territorio | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [modo, setModo] = useState<Modo>("feita");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!saidaId) return;
    setCarregando(true);
    Promise.all([
      buscarSaida(saidaId),
      listTerritorios(),
      listMarcas(),
      listParadas(),
      listPublicadores(),
    ])
      .then(([s, todos, marcadas, paradasList, pubs]) => {
        setSaida(s);
        setTerritorio(todos.find((t) => t.id === territorioId) ?? null);
        setMarcas(marcadas);
        setParadas(paradasList);
        setPublicadores(pubs);
      })
      .catch(() => toast.error("Não foi possível abrir a saída. Tente novamente."))
      .finally(() => setCarregando(false));
  }, [saidaId, territorioId]);

  if (carregando) return <RadarLoader texto="Abrindo o território…" />;

  if (!saida || !territorio || !territorio.limites) {
    return (
      <div className="grid h-dvh place-items-center bg-paper px-6">
        <div className="grid justify-items-center gap-4 text-center">
          <h1 className="text-lg font-semibold text-ink">Nada para marcar aqui</h1>
          <p className="text-[0.9rem] text-ink-soft">
            A saída não existe mais, ou este território ainda não tem quadras
            desenhadas.
          </p>
          <Button asChild>
            <Link to="/calendario">Voltar ao calendário</Link>
          </Button>
        </div>
      </div>
    );
  }

  const daRodada = marcasDaRodada(territorio, marcas);
  const desteDia = new Map(
    daRodada.filter((m) => m.saida_id === saida.id).map((m) => [m.quadra_id, m]),
  );
  const deOutroDia = new Map(
    daRodada.filter((m) => m.saida_id !== saida.id).map((m) => [m.quadra_id, m]),
  );
  const paradaAtual = paradaAtualDe(territorio, marcas, paradas);

  const quadras = quadrasDe(territorio.limites);
  const estados: Record<string, EstadoQuadra> = {};
  for (const q of quadras) {
    if (desteDia.has(q.id)) estados[q.id] = "feita";
    else if (deOutroDia.has(q.id)) estados[q.id] = "outra";
    else if (paradaAtual.has(q.id)) estados[q.id] = "andamento";
  }
  const feitas = desteDia.size + deOutroDia.size;
  const pinos = [...paradaAtual.values()].map((p) => ({
    quadraId: p.quadra_id,
    lng: p.lng,
    lat: p.lat,
  }));

  const semParada = (lista: Parada[], quadraId: string) =>
    lista.filter(
      (p) => !(p.territorio_id === territorio.id && p.quadra_id === quadraId),
    );
  const semMarca = (lista: Marca[], quadraId: string) =>
    lista.filter(
      (m) =>
        !(
          m.saida_id === saida.id &&
          m.territorio_id === territorio.id &&
          m.quadra_id === quadraId
        ),
    );

  async function marcarFeita(quadraId: string) {
    if (!saida || !territorio) return;
    const marcada = desteDia.has(quadraId);
    const tinhaPino = paradaAtual.has(quadraId);
    const antesM = marcas;
    const antesP = paradas;
    setMarcas(
      marcada
        ? semMarca(marcas, quadraId)
        : [
            ...marcas,
            {
              saida_id: saida.id,
              territorio_id: territorio.id,
              quadra_id: quadraId,
              data: saida.data,
              local: saida.local,
              publicador_id: saida.publicador_id,
            },
          ],
    );
    if (!marcada && tinhaPino) setParadas(semParada(paradas, quadraId));
    try {
      if (marcada) await desmarcarQuadra(saida.id, territorio.id, quadraId);
      else {
        await marcarQuadra(saida.id, territorio.id, quadraId);
        if (tinhaPino) await limparParada(territorio.id, quadraId);
      }
    } catch {
      setMarcas(antesM);
      setParadas(antesP);
      toast.error("Não foi possível salvar a quadra. Tente novamente.");
    }
  }

  async function marcarParada(
    quadraId: string,
    lngLat: { lng: number; lat: number },
  ) {
    if (!saida || !territorio) return;
    const eraFeita = desteDia.has(quadraId);
    const antesM = marcas;
    const antesP = paradas;
    const nova: Parada = {
      saida_id: saida.id,
      territorio_id: territorio.id,
      quadra_id: quadraId,
      lng: lngLat.lng,
      lat: lngLat.lat,
      data: saida.data,
      local: saida.local,
      publicador_id: saida.publicador_id,
    };
    setParadas([...semParada(paradas, quadraId), nova]);
    if (eraFeita) setMarcas(semMarca(marcas, quadraId));
    try {
      await pararEm(saida.id, territorio.id, quadraId, lngLat.lng, lngLat.lat);
      if (eraFeita) await desmarcarQuadra(saida.id, territorio.id, quadraId);
    } catch {
      setMarcas(antesM);
      setParadas(antesP);
      toast.error("Não foi possível salvar o ponto de parada. Tente novamente.");
    }
  }

  async function aoTocarQuadra(
    quadraId: string,
    lngLat: { lng: number; lat: number },
  ) {
    const jaFeitaEmOutra = deOutroDia.get(quadraId);
    if (jaFeitaEmOutra) {
      toast.info(`Esta quadra já foi feita na saída de ${dataBR(jaFeitaEmOutra.data)}.`);
      return;
    }
    if (modo === "feita") await marcarFeita(quadraId);
    else await marcarParada(quadraId, lngLat);
  }

  async function removerPino(quadraId: string) {
    if (!territorio) return;
    const antes = paradas;
    setParadas(semParada(paradas, quadraId));
    try {
      await limparParada(territorio.id, quadraId);
    } catch {
      setParadas(antes);
      toast.error("Não foi possível remover o ponto. Tente novamente.");
    }
  }

  const nomeDia = DIA_SEMANA[diaDaSemana(saida.data)];
  const botaoModo =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[0.82rem] font-medium transition-colors";

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <BaseMap bounds={boundsDeTerritorios([territorio]) ?? undefined}>
        <TerritorioPolygon
          limites={territorio.limites}
          estados={estados}
          paradas={pinos}
          onQuadraClick={aoTocarQuadra}
          onParadaClick={modo === "parada" ? removerPino : undefined}
          historicoDe={(quadraId) =>
            historicoDaQuadra(territorio.id, quadraId, marcas, publicadores)
          }
        />
      </BaseMap>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto grid max-w-130 gap-2.5 rounded-xl border border-line bg-white/95 px-3 py-2.5 shadow-card backdrop-blur">
          <div className="flex items-center gap-2.5">
            <Link
              to="/calendario"
              aria-label="Voltar ao calendário"
              className="grid size-9 flex-none place-items-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-jwblue"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <div className="grid min-w-0 gap-0.5">
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                Marcando {nomeDia}, {dataBR(saida.data)}
              </span>
              <span className="truncate text-[0.95rem] font-semibold text-jwblue-deep">
                Território Nº {territorio.numero}
                {territorio.nome ? ` · ${territorio.nome}` : ""}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-mist p-1">
            <button
              type="button"
              onClick={() => setModo("feita")}
              className={cn(
                botaoModo,
                modo === "feita"
                  ? "bg-white text-jwblue-deep shadow-card"
                  : "text-ink-soft",
              )}
            >
              <Check className="size-3.5" aria-hidden="true" /> Feita
            </button>
            <button
              type="button"
              onClick={() => setModo("parada")}
              className={cn(
                botaoModo,
                modo === "parada" ? "bg-white text-ocre shadow-card" : "text-ink-soft",
              )}
            >
              <MapPin className="size-3.5" aria-hidden="true" /> Paramos aqui
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto grid max-w-130 gap-1 rounded-xl border border-line bg-white/95 px-3.5 py-3 text-center shadow-card backdrop-blur">
          <span className="text-[0.95rem] font-semibold text-ink">
            {feitas} de {quadras.length} quadras feitas nesta rodada
          </span>
          <span className="text-[0.8rem] text-ink-soft">
            {modo === "feita"
              ? "Toque numa quadra para marcar o que foi feito neste dia."
              : "Toque no mapa onde o grupo parou. Toque no pino para remover."}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx vitest run src/screens/MarcarQuadras.test.tsx`
Expected: PASS (antigos + novos).

- [ ] **Step 5: Commit**

```bash
git add src/screens/MarcarQuadras.tsx src/screens/MarcarQuadras.test.tsx
git commit -m "feat(marcar): modo Paramos aqui — largar, mover e remover o pino de parada"
```

---

### Task 5: Exibir pinos no `Campo`

**Files:**
- Modify: `src/screens/Campo.tsx`
- Test: `src/screens/Campo.test.tsx`

**Interfaces:**
- Consumes: `listParadas`, `paradaAtualDe`, `Parada` (Task 2); `TerritorioPolygon` com `paradas` (Task 3).
- Produces: mapa de campo pinta quadras `andamento` e mostra os pinos (só leitura).

- [ ] **Step 1: Atualizar o teste**

Em `src/screens/Campo.test.tsx`, faça o mock de `TerritorioPolygon` capturar também `paradas`:

```ts
const bounds = vi.fn();
const estados = vi.fn();
const paradasProp = vi.fn();

vi.mock("../map/BaseMap", () => ({
  BaseMap: (props: { bounds?: unknown; children?: React.ReactNode }) => {
    bounds(props.bounds);
    return <div data-testid="map">{props.children}</div>;
  },
}));
vi.mock("../map/TerritorioPolygon", () => ({
  TerritorioPolygon: (props: { estados?: unknown; paradas?: unknown }) => {
    estados(props.estados);
    paradasProp(props.paradas);
    return <div data-testid="poly" />;
  },
}));
```

No mock de `../lib/quadras`, acrescente `listParadas` (default vazio):

```ts
vi.mock("../lib/quadras", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/quadras")>()),
  listMarcas: vi.fn().mockResolvedValue([
    {
      saida_id: "s1",
      territorio_id: "t1",
      quadra_id: "quadra-a",
      data: "2026-07-12",
      local: null,
      publicador_id: null,
    },
  ]),
  listParadas: vi.fn().mockResolvedValue([]),
}));
```

Acrescente o import e um teste novo:

```ts
import { Campo } from "./Campo";
// ...
  it("pinta as quadras em andamento e passa os pinos ao mapa", async () => {
    const { listParadas } = await import("../lib/quadras");
    vi.mocked(listParadas).mockResolvedValueOnce([
      {
        territorio_id: "t1",
        quadra_id: "quadra-b",
        saida_id: "s1",
        lng: -43.5,
        lat: -20.5,
        data: "2026-07-12",
        local: null,
        publicador_id: null,
      },
    ]);
    render(
      <MemoryRouter initialEntries={["/campo/t1"]}>
        <Routes>
          <Route path="/campo/:id" element={<Campo />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("poly")).toBeInTheDocument());
    expect(estados).toHaveBeenLastCalledWith({
      "quadra-a": "feita",
      "quadra-b": "andamento",
    });
    expect(paradasProp).toHaveBeenLastCalledWith([
      { quadraId: "quadra-b", lng: -43.5, lat: -20.5 },
    ]);
  });
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/screens/Campo.test.tsx`
Expected: FAIL — `Campo` ainda não carrega paradas nem passa `paradas` ao mapa.

- [ ] **Step 3: Implementar em `src/screens/Campo.tsx`**

Atualize o import de `quadras`:

```ts
import {
  historicoDaQuadra,
  listMarcas,
  listParadas,
  paradaAtualDe,
  quadrasFeitasDe,
} from "../lib/quadras";
import type { Marca, Parada } from "../lib/quadras";
```

Adicione o estado e carregue as paradas:

```ts
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    Promise.all([listTerritorios(), listMarcas(), listParadas(), listPublicadores()])
      .then(([todos, marcadas, paradasList, pubs]) => {
        setT(todos.find((x) => x.id === id) ?? null);
        setMarcas(marcadas);
        setParadas(paradasList);
        setPublicadores(pubs);
      })
      .finally(() => setCarregando(false));
  }, [id]);
```

Substitua o cálculo de `estados` e o `<TerritorioPolygon>`:

```ts
  const bounds = boundsDeTerritorios([t]);
  const paradaAtual = paradaAtualDe(t, marcas, paradas);
  const estados: Record<string, EstadoQuadra> = {};
  for (const quadraId of quadrasFeitasDe(t, marcas)) estados[quadraId] = "feita";
  for (const quadraId of paradaAtual.keys()) estados[quadraId] = "andamento";
  const pinos = [...paradaAtual.values()].map((p) => ({
    quadraId: p.quadra_id,
    lng: p.lng,
    lat: p.lat,
  }));
```

```tsx
        {t.limites && (
          <TerritorioPolygon
            limites={t.limites}
            estados={estados}
            paradas={pinos}
            historicoDe={(quadraId) =>
              historicoDaQuadra(t.id, quadraId, marcas, publicadores)
            }
          />
        )}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/screens/Campo.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Campo.tsx src/screens/Campo.test.tsx
git commit -m "feat(campo): mostrar quadras em andamento e pinos de parada no mapa ao vivo"
```

---

### Task 6: Contagem na Gestão e selo em andamento

**Files:**
- Modify: `src/screens/Gestao.tsx`
- Modify: `src/screens/TerritorioGlyph.tsx`
- Test: `src/screens/Gestao.test.tsx`

**Interfaces:**
- Consumes: `listParadas`, `progressoDe(t, marcas, paradas)`, `paradaAtualDe` (Task 2).
- Produces: badge `"5/8 quadras · 1 em andamento"` na Gestão; `TerritorioGlyph` aceita `andamento?: Set<string>` e pinta essas quadras em ocre.

- [ ] **Step 1: Atualizar o teste da Gestão**

Em `src/screens/Gestao.test.tsx`, no mock de `../lib/quadras`, acrescente `listParadas`:

```ts
vi.mock("../lib/quadras", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    listMarcas: vi.fn().mockResolvedValue([]),
    listParadas: vi.fn().mockResolvedValue([]),
    iniciarNovaRodada: vi.fn().mockResolvedValue(undefined),
  };
});
```

Estenda o helper `montar` para injetar paradas e adicione um helper `parada`:

```ts
const parada = (quadra_id: string): Parada => ({
  territorio_id: "t1",
  quadra_id,
  saida_id: "s1",
  lng: -46,
  lat: -23,
  data: "2026-07-12",
  local: null,
  publicador_id: null,
});

async function montar(
  marcas: Marca[] = [],
  t: Territorio = territorio,
  paradas: Parada[] = [],
) {
  const { listTerritorios } = await import("../lib/territorios");
  const { listMarcas, listParadas } = await import("../lib/quadras");
  vi.mocked(listTerritorios).mockResolvedValue([t]);
  vi.mocked(listMarcas).mockResolvedValue(marcas);
  vi.mocked(listParadas).mockResolvedValue(paradas);
  render(
    <MemoryRouter>
      <Gestao />
    </MemoryRouter>,
  );
```

Acrescente o import de `Parada` na linha de tipos que já traz `Marca`:

```ts
import type { Marca, Parada } from "../lib/quadras";
```

Adicione um teste usando o `territorio` fixo do arquivo (quadras `qa` e `qb`): `qa` feita, `qb` com pino → "1/2 quadras · 1 em andamento":

```ts
  it("mostra quantas quadras estão em andamento além das feitas", async () => {
    await montar([marca("qa")], territorio, [parada("qb")]);
    expect(await screen.findByText(/1 em andamento/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/screens/Gestao.test.tsx`
Expected: FAIL — a Gestão não carrega paradas nem renderiza "em andamento".

- [ ] **Step 3: Implementar `TerritorioGlyph`**

Em `src/screens/TerritorioGlyph.tsx`, adicione a prop `andamento` e pinte-a (feita tem prioridade):

```tsx
export function TerritorioGlyph({
  limites,
  feitas,
  andamento,
}: {
  limites: Limites | null;
  feitas?: Set<string>;
  andamento?: Set<string>;
}) {
```

Substitua a classe de `fill` no `<path>`:

```tsx
          className={cn(
            "stroke-current",
            feitas?.has(q.id)
              ? "fill-sage/60"
              : andamento?.has(q.id)
                ? "fill-ocre/60"
                : "fill-jwblue/12",
          )}
```

- [ ] **Step 4: Implementar a Gestão**

Em `src/screens/Gestao.tsx`, atualize o import de `quadras`:

```ts
import {
  iniciarNovaRodada,
  listMarcas,
  listParadas,
  paradaAtualDe,
  progressoDe,
  quadrasFeitasDe,
  type Marca,
  type Parada,
} from "../lib/quadras";
```

Adicione o estado e carregue as paradas em `carregar`:

```ts
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [paradas, setParadas] = useState<Parada[]>([]);
  // ...
  async function carregar() {
    const [t, p, d, m, pp] = await Promise.all([
      listTerritorios(),
      listPublicadores(),
      designacoesAbertas(),
      listMarcas(),
      listParadas(),
    ]);
    setTerritorios(t);
    setPublicadores(p);
    setAbertas(d);
    setMarcas(m);
    setParadas(pp);
  }
```

No `map` dos territórios, calcule progresso com paradas e o conjunto de andamento:

```ts
              const progresso = progressoDe(t, marcas, paradas);
              const emAndamento = paradaAtualDe(t, marcas, paradas);
```

Passe `andamento` ao selo:

```tsx
                    <TerritorioGlyph
                      limites={t.limites}
                      feitas={quadrasFeitasDe(t, marcas)}
                      andamento={new Set(emAndamento.keys())}
                    />
```

Substitua o bloco do badge de progresso (o `else` do `progresso.concluido`) para incluir o sufixo em ocre:

```tsx
                      ) : (
                        <span className="text-[0.76rem] tabular-nums text-ink-soft">
                          {progresso.feitas}/{progresso.total} quadras
                          {progresso.emAndamento > 0 && (
                            <span className="text-ocre">
                              {" · "}
                              {progresso.emAndamento} em andamento
                            </span>
                          )}
                        </span>
                      ))}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/screens/Gestao.test.tsx`
Expected: PASS.

- [ ] **Step 6: Suíte completa + typecheck + lint**

Run: `npm run test && npm run build && npm run lint`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Gestao.tsx src/screens/Gestao.test.tsx src/screens/TerritorioGlyph.tsx
git commit -m "feat(gestao): contagem de quadras em andamento e selo em ocre"
```

---

## Verificação manual (após aplicar o SQL no Supabase)

1. `npm run dev`; abra uma saída com território no Calendário → "Marcar quadras".
2. Modo **Paramos aqui** → toque numa quadra: aparece o pino ocre e a quadra fica ocre. Toque em outro ponto da mesma quadra: o pino se move. Toque no pino: some.
3. Volte pra modo **Feita**, marque essa quadra: o pino some e ela fica verde.
4. Abra o **Campo** do território: o pino e a cor ocre aparecem junto do "você está aqui".
5. Na **Gestão**: o card mostra "… quadras · 1 em andamento" e o selo pinta a quadra em ocre.
```
