# Múltiplas quadras por território (e edição do limite) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um território passa a poder ter **N quadras não contíguas** (`GeoJSON.MultiPolygon`), e seu limite passa a ser **editável** depois de criado.

**Architecture:** A coluna `territorio.limites` (`jsonb`) não muda — nenhum SQL para rodar. Linhas antigas continuam `Polygon`; o que for salvo daqui pra frente sai `MultiPolygon`. Uma função pura `quadrasDe()` em `src/lib/territorios.ts` é o **único** ponto do código que conhece essa dualidade, e todo consumidor de geometria passa por ela. A tela `Cadastro` vira criar **e** editar (rota `/cadastro/:id`), porque o fluxo é o mesmo nos dois casos: desenhe N quadras e salve.

**Tech Stack:** React 19 + TypeScript + Vite, `react-map-gl/mapbox` v8, `@mapbox/mapbox-gl-draw`, Supabase (`supabase-js`), Vitest + Testing Library, Tailwind v4 + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-07-11-multiplas-quadras-design.md`

## Global Constraints

- **Não escreva comentários no código.** O código se explica pelos nomes. (Regra do `CLAUDE.md`.)
- **Nenhuma migração de banco.** Nada de SQL, nada em `supabase/migrations/`. A coluna `limites` já é `jsonb` e aceita `MultiPolygon` como está.
- **A UI nunca chama `supabase` direto** — só através de `src/lib/*`.
- **Quadras não têm identidade própria**: sem nome, sem id, sem contagem no domínio. Adicionar/remover quadra é feito pelo desenho e pela lixeira do `MapboxDraw`, não por uma lista na UI.
- Português nas strings de UI e nas mensagens de commit.
- Tudo verde em `npm run test`, `npm run lint` e `npm run build` ao fim de cada task.

---

### Task 1: `quadrasDe()` e o tipo `Limites`

O alicerce: um tipo que aceita as duas formas e a função pura que as achata numa lista de quadras. `boundsDeTerritorios` é o primeiro consumidor a ser convertido — e o teste de lista **mista** (`Polygon` antigo + `MultiPolygon` novo) é o que prova que a decisão de "sem migração" se sustenta.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/territorios.ts:15-37`
- Test: `src/lib/territorios.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type Limites = GeoJSON.Polygon | GeoJSON.MultiPolygon` (em `types.ts`)
  - `type Quadra = GeoJSON.Position[][]` (em `territorios.ts`)
  - `quadrasDe(limites: Limites | null): Quadra[]`
  - `boundsDeTerritorios(territorios: Territorio[]): Bounds | null` (assinatura inalterada, comportamento estendido)

- [ ] **Step 1: Escreva os testes que falham**

Em `src/lib/territorios.test.ts`, troque o import por
`import { statusTerritorio, boundsDeTerritorios, quadrasDe } from "./territorios";`
e acrescente, depois do helper `quadrado` já existente:

```ts
function multi(...quadrados: GeoJSON.Polygon[]): GeoJSON.MultiPolygon {
  return {
    type: "MultiPolygon",
    coordinates: quadrados.map((q) => q.coordinates),
  };
}

describe("quadrasDe", () => {
  it("retorna lista vazia quando não há limites", () => {
    expect(quadrasDe(null)).toEqual([]);
  });

  it("trata um Polygon como um território de uma quadra só", () => {
    const p = quadrado(-46, -23);
    expect(quadrasDe(p)).toEqual([p.coordinates]);
  });

  it("devolve uma entrada por quadra de um MultiPolygon", () => {
    const a = quadrado(-46, -23);
    const b = quadrado(-44, -21);
    expect(quadrasDe(multi(a, b))).toEqual([a.coordinates, b.coordinates]);
  });
});
```

E, dentro do `describe("boundsDeTerritorios")` que já existe:

```ts
it("envolve todas as quadras de um MultiPolygon", () => {
  const t = { ...base, limites: multi(quadrado(-46, -23), quadrado(-44, -21)) };
  expect(boundsDeTerritorios([t])).toEqual([
    [-46, -23],
    [-43, -20],
  ]);
});

it("envolve uma lista mista de Polygon (linha antiga) e MultiPolygon (linha nova)", () => {
  const ts: Territorio[] = [
    { ...base, id: "a", limites: quadrado(-46, -23) },
    { ...base, id: "b", limites: multi(quadrado(-40, -18), quadrado(-38, -16)) },
  ];
  expect(boundsDeTerritorios(ts)).toEqual([
    [-46, -23],
    [-37, -15],
  ]);
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npx vitest run src/lib/territorios.test.ts`
Expected: FAIL — `quadrasDe is not a function` nos três testes novos de `quadrasDe`, e os dois novos de `boundsDeTerritorios` falhando porque a implementação atual só olha `coordinates[0]` (o `MultiPolygon` produz bounds errados).

- [ ] **Step 3: Adicione o tipo `Limites` em `types.ts`**

Em `src/lib/types.ts`, acima da interface `Territorio`:

```ts
export type Limites = GeoJSON.Polygon | GeoJSON.MultiPolygon;
```

E troque o campo da interface:

```ts
export interface Territorio {
  id: string;
  numero: string;
  nome: string | null;
  limites: Limites | null;
  ativo: boolean;
  created_at: string;
}
```

- [ ] **Step 4: Implemente `quadrasDe` e converta `boundsDeTerritorios`**

Em `src/lib/territorios.ts`, troque o import de tipos por
`import type { Territorio, Designacao, Limites } from "./types";`
e substitua o bloco de `Bounds` / `boundsDeTerritorios` (linhas 15-37) por:

```ts
export type Bounds = [[number, number], [number, number]];

export type Quadra = GeoJSON.Position[][];

export function quadrasDe(limites: Limites | null): Quadra[] {
  if (!limites) return [];
  return limites.type === "MultiPolygon" ? limites.coordinates : [limites.coordinates];
}

export function boundsDeTerritorios(territorios: Territorio[]): Bounds | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const t of territorios) {
    for (const quadra of quadrasDe(t.limites)) {
      for (const anel of quadra) {
        for (const [lng, lat] of anel) {
          if (lng < minLng) minLng = lng;
          if (lat < minLat) minLat = lat;
          if (lng > maxLng) maxLng = lng;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }
  if (minLng === Infinity) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
```

- [ ] **Step 5: Rode os testes e confirme que passam**

Run: `npx vitest run src/lib/territorios.test.ts`
Expected: PASS — todos os testes de `statusTerritorio`, `quadrasDe` e `boundsDeTerritorios`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/territorios.ts src/lib/territorios.test.ts
git commit -m "feat(territorios): quadrasDe() e bounds cientes de MultiPolygon"
```

---

### Task 2: Camada de dados — converter desenho ↔ geometria, e `atualizarTerritorio`

Duas funções puras que fazem a ponte entre o `MapboxDraw` (que fala `Feature[]`) e o banco (que fala `MultiPolygon`), mais o `update` que hoje não existe. Elas são puras justamente para serem testáveis sem mapa nenhum — é onde a lógica de "N quadras" de fato vive, e a tela só a chama.

**Files:**
- Modify: `src/lib/territorios.ts`
- Test: `src/lib/territorios.test.ts`

**Interfaces:**
- Consumes: `quadrasDe`, `Limites` (Task 1).
- Produces:
  - `multiPolygonDe(features: GeoJSON.Feature[]): GeoJSON.MultiPolygon | null`
  - `featureCollectionDe(limites: Limites | null): GeoJSON.FeatureCollection`
  - `criarTerritorio(input: { numero: string; nome?: string; limites: GeoJSON.MultiPolygon }): Promise<Territorio>` (tipo de `limites` estreitado)
  - `atualizarTerritorio(id: string, input: { numero: string; nome?: string; limites: GeoJSON.MultiPolygon }): Promise<void>`

- [ ] **Step 1: Escreva os testes que falham**

Em `src/lib/territorios.test.ts`, estenda o import:
`import { statusTerritorio, boundsDeTerritorios, quadrasDe, multiPolygonDe, featureCollectionDe } from "./territorios";`
e acrescente ao fim do arquivo:

```ts
function feature(p: GeoJSON.Polygon): GeoJSON.Feature {
  return { type: "Feature", properties: {}, geometry: p };
}

describe("multiPolygonDe", () => {
  it("é null quando não há nenhuma quadra desenhada", () => {
    expect(multiPolygonDe([])).toBeNull();
  });

  it("junta todas as quadras desenhadas num MultiPolygon", () => {
    const a = quadrado(-46, -23);
    const b = quadrado(-44, -21);
    expect(multiPolygonDe([feature(a), feature(b)])).toEqual({
      type: "MultiPolygon",
      coordinates: [a.coordinates, b.coordinates],
    });
  });

  it("salva uma quadra só também como MultiPolygon", () => {
    const a = quadrado(-46, -23);
    expect(multiPolygonDe([feature(a)])).toEqual({
      type: "MultiPolygon",
      coordinates: [a.coordinates],
    });
  });

  it("ignora features que não são polígonos", () => {
    const ponto: GeoJSON.Feature = {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-46, -23] },
    };
    expect(multiPolygonDe([ponto])).toBeNull();
  });
});

describe("featureCollectionDe", () => {
  it("é uma coleção vazia quando o território não tem limites", () => {
    expect(featureCollectionDe(null)).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });

  it("devolve uma feature de polígono por quadra, pronta para o draw", () => {
    const a = quadrado(-46, -23);
    const b = quadrado(-44, -21);
    const fc = featureCollectionDe({
      type: "MultiPolygon",
      coordinates: [a.coordinates, b.coordinates],
    });
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry).toEqual(a);
    expect(fc.features[1].geometry).toEqual(b);
  });

  it("aceita um Polygon antigo e devolve uma feature só", () => {
    const a = quadrado(-46, -23);
    expect(featureCollectionDe(a).features).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npx vitest run src/lib/territorios.test.ts`
Expected: FAIL — `multiPolygonDe is not a function` e `featureCollectionDe is not a function`.

- [ ] **Step 3: Implemente as duas funções puras**

Em `src/lib/territorios.ts`, logo depois de `quadrasDe`:

```ts
export function multiPolygonDe(features: GeoJSON.Feature[]): GeoJSON.MultiPolygon | null {
  const coordinates = features
    .filter((f) => f.geometry?.type === "Polygon")
    .map((f) => (f.geometry as GeoJSON.Polygon).coordinates);
  return coordinates.length > 0 ? { type: "MultiPolygon", coordinates } : null;
}

export function featureCollectionDe(limites: Limites | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: quadrasDe(limites).map((coordinates) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates },
    })),
  };
}
```

- [ ] **Step 4: Rode os testes e confirme que passam**

Run: `npx vitest run src/lib/territorios.test.ts`
Expected: PASS.

- [ ] **Step 5: Estreite `criarTerritorio` e adicione `atualizarTerritorio`**

Em `src/lib/territorios.ts`, troque a assinatura de `criarTerritorio` (o campo `limites: GeoJSON.Polygon` vira `limites: GeoJSON.MultiPolygon`; o corpo não muda) e acrescente logo abaixo dela:

```ts
export async function atualizarTerritorio(
  id: string,
  input: { numero: string; nome?: string; limites: GeoJSON.MultiPolygon },
): Promise<void> {
  const { error } = await supabase
    .from("territorio")
    .update({
      numero: input.numero,
      nome: input.nome ?? null,
      limites: input.limites,
    })
    .eq("id", id);
  if (error) throw error;
}
```

Não há teste automatizado aqui: é uma chamada de rede fina, e o repositório não mocka o `supabase` nos testes de `lib`. O contrato dela é exercido pelo teste de tela na Task 6.

- [ ] **Step 6: Rode a suíte inteira e o typecheck**

Run: `npm run test && npm run build`
Expected: os testes passam; o `tsc` **falha** em `src/screens/Cadastro.tsx` (`GeoJSON.Polygon` não é atribuível a `GeoJSON.MultiPolygon`) — é esperado, e a Task 5 conserta. Se quiser um commit com o build verde, faça as Tasks 3-6 antes de rodar `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/territorios.ts src/lib/territorios.test.ts
git commit -m "feat(territorios): multiPolygonDe, featureCollectionDe e atualizarTerritorio"
```

---

### Task 3: `TerritorioGlyph` desenha N quadras

O selo é como o dirigente reconhece um território na lista. Um território de três quadras soltas tem que **parecer** três quadras soltas: normalizamos sobre o bbox da união e emitimos um subpath por quadra dentro de um `<path>` só.

**Files:**
- Modify: `src/screens/TerritorioGlyph.tsx`
- Modify: `src/screens/Gestao.tsx:252`
- Create: `src/screens/TerritorioGlyph.test.tsx`

**Interfaces:**
- Consumes: `quadrasDe` (Task 1), `Limites` (Task 1).
- Produces: `<TerritorioGlyph limites={...} />` — **atenção: a prop foi renomeada de `poligono` para `limites`**, porque não é mais um polígono só.

- [ ] **Step 1: Escreva os testes que falham**

Crie `src/screens/TerritorioGlyph.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TerritorioGlyph } from "./TerritorioGlyph";

function quadrado(lng: number, lat: number, lado = 1): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + lado, lat],
        [lng + lado, lat + lado],
        [lng, lat + lado],
        [lng, lat],
      ],
    ],
  };
}

describe("TerritorioGlyph", () => {
  it("mostra o placeholder tracejado quando não há limites", () => {
    const { container } = render(<TerritorioGlyph limites={null} />);
    expect(container.querySelector("path")).toBeNull();
    expect(container.querySelector("rect")).toBeInTheDocument();
  });

  it("desenha um subpath para um território de uma quadra", () => {
    const { container } = render(<TerritorioGlyph limites={quadrado(-46, -23)} />);
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(d.match(/M/g)).toHaveLength(1);
  });

  it("desenha um subpath por quadra de um MultiPolygon", () => {
    const limites: GeoJSON.MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        quadrado(-46, -23).coordinates,
        quadrado(-44, -21).coordinates,
        quadrado(-42, -19).coordinates,
      ],
    };
    const { container } = render(<TerritorioGlyph limites={limites} />);
    const d = container.querySelector("path")?.getAttribute("d") ?? "";
    expect(d.match(/M/g)).toHaveLength(3);
    expect(d.match(/Z/g)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npx vitest run src/screens/TerritorioGlyph.test.tsx`
Expected: FAIL — o componente ainda espera a prop `poligono` e só sabe desenhar um anel (o teste de três quadras encontra 1 `M`, não 3).

- [ ] **Step 3: Reescreva o componente**

Substitua o conteúdo de `src/screens/TerritorioGlyph.tsx` por:

```tsx
import { quadrasDe } from "../lib/territorios";
import type { Limites } from "../lib/types";

export function TerritorioGlyph({ limites }: { limites: Limites | null }) {
  const aneis = quadrasDe(limites)
    .map((quadra) => quadra[0])
    .filter((anel): anel is GeoJSON.Position[] => !!anel && anel.length >= 3);

  if (aneis.length === 0) {
    return (
      <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
        <rect
          x="14"
          y="14"
          width="72"
          height="72"
          rx="10"
          className="fill-none stroke-line-strong"
          strokeWidth="4"
          strokeDasharray="7 8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const pontos = aneis.flat();
  const xs = pontos.map((p) => p[0]);
  const ys = pontos.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = 72 / span;
  const offX = (100 - (maxX - minX) * scale) / 2;
  const offY = (100 - (maxY - minY) * scale) / 2;

  const d = aneis
    .map(
      (anel) =>
        "M" +
        anel
          .map(
            (p) =>
              `${(offX + (p[0] - minX) * scale).toFixed(1)},${(
                offY +
                (maxY - p[1]) * scale
              ).toFixed(1)}`,
          )
          .join("L") +
        "Z",
    )
    .join(" ");

  return (
    <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
      <path
        d={d}
        className="fill-jwblue/12 stroke-current"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Atualize o chamador na Gestão**

Em `src/screens/Gestao.tsx:252`, troque

```tsx
<TerritorioGlyph poligono={t.limites} />
```

por

```tsx
<TerritorioGlyph limites={t.limites} />
```

- [ ] **Step 5: Rode os testes e confirme que passam**

Run: `npx vitest run src/screens/TerritorioGlyph.test.tsx src/screens/Gestao.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/TerritorioGlyph.tsx src/screens/TerritorioGlyph.test.tsx src/screens/Gestao.tsx
git commit -m "feat(glyph): selo desenha uma forma por quadra do território"
```

---

### Task 4: `Campo` enquadra por bounds

Com quadras espalhadas, centralizar na média dos vértices com zoom fixo 15 pode abrir o mapa numa região vazia **entre** as quadras e deixar metade do território fora da tela. `BaseMap` já aceita `bounds` (é o que o `Mapa` usa), e `boundsDeTerritorios` já sabe lidar com N quadras desde a Task 1 — então isso é substituição, não código novo.

**Files:**
- Modify: `src/screens/Campo.tsx`
- Modify: `src/map/TerritorioPolygon.tsx`
- Modify: `src/map/TerritoriosLayer.tsx:42`
- Test: `src/screens/Campo.test.tsx`

**Interfaces:**
- Consumes: `boundsDeTerritorios` (Task 1), `Limites` (Task 1).
- Produces: `<TerritorioPolygon limites={...} />` — **prop renomeada de `polygon` para `limites`**, e o tipo passa a ser `Limites`.

- [ ] **Step 1: Escreva o teste que falha**

Em `src/screens/Campo.test.tsx`, substitua os mocks e acrescente o teste, deixando o arquivo assim:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Campo } from "./Campo";

const bounds = vi.fn();

vi.mock("../map/BaseMap", () => ({
  BaseMap: (props: { bounds?: unknown; children?: React.ReactNode }) => {
    bounds(props.bounds);
    return <div data-testid="map">{props.children}</div>;
  },
}));
vi.mock("../map/TerritorioPolygon", () => ({
  TerritorioPolygon: () => <div data-testid="poly" />,
}));
vi.mock("../lib/territorios", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/territorios")>()),
  listTerritorios: vi.fn().mockResolvedValue([
    {
      id: "t1",
      numero: "12",
      nome: "Centro",
      limites: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-46, -23],
              [-45, -23],
              [-45, -22],
              [-46, -22],
              [-46, -23],
            ],
          ],
          [
            [
              [-44, -21],
              [-43, -21],
              [-43, -20],
              [-44, -20],
              [-44, -21],
            ],
          ],
        ],
      },
      ativo: true,
      created_at: "",
    },
  ]),
}));

describe("Campo", () => {
  it("renderiza o polígono do território pedido", async () => {
    render(
      <MemoryRouter initialEntries={["/campo/t1"]}>
        <Routes>
          <Route path="/campo/:id" element={<Campo />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("poly")).toBeInTheDocument());
  });

  it("enquadra o mapa em todas as quadras do território", async () => {
    render(
      <MemoryRouter initialEntries={["/campo/t1"]}>
        <Routes>
          <Route path="/campo/:id" element={<Campo />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByTestId("poly")).toBeInTheDocument());
    expect(bounds).toHaveBeenLastCalledWith([
      [-46, -23],
      [-43, -20],
    ]);
  });
});
```

- [ ] **Step 2: Rode o teste e confirme que falha**

Run: `npx vitest run src/screens/Campo.test.tsx`
Expected: FAIL — o `Campo` passa `initialViewState`, não `bounds`; o mock recebe `undefined`.

- [ ] **Step 3: Aceite `Limites` no `TerritorioPolygon`**

Em `src/map/TerritorioPolygon.tsx`, troque as duas primeiras linhas do componente (o resto do arquivo, com as três `<Layer>`, não muda):

```tsx
import { Source, Layer } from "react-map-gl/mapbox";
import type { Limites } from "../lib/types";

export function TerritorioPolygon({ limites }: { limites: Limites }) {
  const feature: GeoJSON.Feature = {
    type: "Feature",
    geometry: limites,
    properties: {},
  };
```

O Mapbox GL renderiza `MultiPolygon` nas mesmas camadas `fill`/`line` — nenhuma `<Layer>` muda.

- [ ] **Step 4: Troque `centro()` por bounds no `Campo`**

Em `src/screens/Campo.tsx`: apague a função `centro` inteira (linhas 12-20), troque o import de `listTerritorios` por
`import { listTerritorios, boundsDeTerritorios } from "../lib/territorios";`
e remova o import agora órfão de `ViewState` (`import type { ViewState } from "../map/BaseMap";`).

Troque o bloco final (`const c = ...` e o `<BaseMap>`) por:

```tsx
  const bounds = boundsDeTerritorios([t]);

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <BaseMap showLocation bounds={bounds ?? undefined}>
        {t.limites && <TerritorioPolygon limites={t.limites} />}
      </BaseMap>
```

- [ ] **Step 5: Corrija o cast do `TerritoriosLayer`**

Nenhuma `<Layer>` muda — o Mapbox renderiza `MultiPolygon` igual. Mas o cast em `src/map/TerritoriosLayer.tsx:42` afirma `GeoJSON.Polygon`, o que passou a ser mentira. Troque:

```tsx
        geometry: t.limites as Limites,
```

e acrescente o tipo ao import já existente de `types`:

```tsx
import type { Territorio, Limites } from "../lib/types";
```

- [ ] **Step 6: Rode os testes e confirme que passam**

Run: `npx vitest run src/screens/Campo.test.tsx src/screens/Mapa.test.tsx`
Expected: PASS. (Se `src/screens/Mapa.test.tsx` não existir, rode só o do Campo.)

- [ ] **Step 7: Commit**

```bash
git add src/screens/Campo.tsx src/screens/Campo.test.tsx src/map/TerritorioPolygon.tsx src/map/TerritoriosLayer.tsx
git commit -m "feat(campo): enquadra o mapa em todas as quadras do território"
```

---

### Task 5: `Cadastro` desenha N quadras

O `DrawControl` para de jogar fora tudo menos o primeiro polígono. Em vez de reagir só à feature que mudou (`e.features[0]`), ele relê **todo** o desenho (`draw.getAll()`) a cada evento e converte com `multiPolygonDe`. A lixeira do próprio `MapboxDraw` é como se remove uma quadra — não há UI própria pra isso.

**Files:**
- Modify: `src/screens/Cadastro.tsx`
- Test: `src/screens/Cadastro.test.tsx`

**Interfaces:**
- Consumes: `multiPolygonDe`, `criarTerritorio` (Task 2).
- Produces: `Cadastro` no modo criação, salvando `MultiPolygon`. A Task 6 acrescenta o modo edição **neste mesmo componente**.

- [ ] **Step 1: Escreva os testes que falham**

Substitua `src/screens/Cadastro.test.tsx` por:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import { Cadastro } from "./Cadastro";

vi.mock("../map/BaseMap", () => ({ BaseMap: () => <div data-testid="map" /> }));
vi.mock("../lib/territorios", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/territorios")>()),
  criarTerritorio: vi.fn(),
  atualizarTerritorio: vi.fn(),
  listTerritorios: vi.fn().mockResolvedValue([]),
}));

describe("Cadastro", () => {
  it("desabilita salvar sem número e sem quadra", () => {
    render(
      <MemoryRouter>
        <Cadastro />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /salvar/i })).toBeDisabled();
  });

  it("pede as quadras enquanto nada foi desenhado", () => {
    render(
      <MemoryRouter>
        <Cadastro />
      </MemoryRouter>,
    );
    expect(screen.getByText(/desenhe as quadras/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rode os testes e confirme que falham**

Run: `npx vitest run src/screens/Cadastro.test.tsx`
Expected: FAIL no segundo teste — o texto atual é "Desenhe o limite do território no mapa", não "Desenhe as quadras…". (O primeiro já passa.)

- [ ] **Step 3: Reescreva o `DrawControl` para ler o desenho inteiro**

Em `src/screens/Cadastro.tsx`, troque os imports de topo por:

```tsx
import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useControl } from "react-map-gl/mapbox";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BaseMap } from "../map/BaseMap";
import type { ViewState } from "../map/BaseMap";
import { criarTerritorio, multiPolygonDe } from "../lib/territorios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
```

e substitua o `DrawControl` inteiro por:

```tsx
function DrawControl({
  onChange,
}: {
  onChange: (quadras: GeoJSON.MultiPolygon | null) => void;
}) {
  const draw = useRef<MapboxDraw | null>(null);

  useControl<MapboxDraw>(
    () => {
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });
      return draw.current;
    },
    (evt) => {
      const map = evt.map as unknown as {
        on: (ev: string, cb: () => void) => void;
      };
      const atualizar = () =>
        onChange(multiPolygonDe(draw.current?.getAll().features ?? []));
      map.on("draw.create", atualizar);
      map.on("draw.update", atualizar);
      map.on("draw.delete", atualizar);
    },
  );

  return null;
}
```

- [ ] **Step 4: Troque o estado de "um polígono" por "N quadras"**

No corpo de `Cadastro`, troque a linha do estado e o callback:

```tsx
  const [quadras, setQuadras] = useState<GeoJSON.MultiPolygon | null>(null);
```

```tsx
  const onChange = useCallback((q: GeoJSON.MultiPolygon | null) => setQuadras(q), []);
```

Em `salvar()`, troque `if (!numero || !polygon) return;` por `if (!numero || !quadras) return;`, a chamada por
`await criarTerritorio({ numero, nome: nome || undefined, limites: quadras });`
e o reset `setPolygon(null)` por `setQuadras(null)`.

- [ ] **Step 5: Mostre a contagem de quadras no painel**

Ainda em `src/screens/Cadastro.tsx`, logo antes do `return`, acrescente:

```tsx
  const total = quadras?.coordinates.length ?? 0;
  const rotuloQuadras =
    total === 0
      ? "Desenhe as quadras do território no mapa"
      : total === 1
        ? "1 quadra desenhada — pronto para salvar"
        : `${total} quadras desenhadas — pronto para salvar`;
```

No painel inferior, troque o bloco do indicador por:

```tsx
          <div className="flex items-center gap-2 text-[0.74rem] font-medium tracking-[0.01em]">
            <span
              className={cn(
                "size-2 flex-none rounded-full transition-colors",
                total > 0 ? "bg-sage" : "bg-ink-faint",
              )}
              aria-hidden="true"
            />
            <span className={total > 0 ? "text-sage-ink" : "text-ink-soft"}>
              {rotuloQuadras}
            </span>
          </div>
```

E no `<Button>` de salvar, troque `disabled={!numero || !polygon || salvando}` por `disabled={!numero || !quadras || salvando}`.

O `<DrawControl onChange={onChange} />` dentro do `<BaseMap>` não muda.

- [ ] **Step 6: Rode os testes, o lint e o build**

Run: `npm run test && npm run lint && npm run build`
Expected: PASS nos três — o `tsc` agora fecha, porque `criarTerritorio` recebe o `MultiPolygon` que a Task 2 passou a exigir.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Cadastro.tsx src/screens/Cadastro.test.tsx
git commit -m "feat(cadastro): desenhar várias quadras não contíguas por território"
```

---

### Task 6: `Cadastro` também edita (`/cadastro/:id`)

O mesmo componente passa a atender duas rotas. Sem `id`, é o cadastro da Task 5. Com `id`, carrega o território, injeta as quadras no `MapboxDraw`, enquadra o mapa nos limites (sem pedir GPS — o `GeolocateControl` daria um voo até a posição do usuário, que no sofá de casa não é o território) e salva com `atualizarTerritorio`.

**Files:**
- Modify: `src/screens/Cadastro.tsx`
- Modify: `src/App.tsx:44`
- Modify: `src/screens/Gestao.tsx` (botão "Editar" no card)
- Test: `src/screens/Cadastro.test.tsx`

**Interfaces:**
- Consumes: `atualizarTerritorio`, `featureCollectionDe`, `multiPolygonDe` (Task 2), `quadrasDe`, `boundsDeTerritorios` (Task 1), `listTerritorios`.
- Produces: rota `/cadastro/:id`; `Cadastro` completo (criar + editar).

- [ ] **Step 1: Escreva os testes que falham**

Acrescente ao `describe("Cadastro")` em `src/screens/Cadastro.test.tsx`:

```tsx
  it("no modo edição, carrega o território e salva com atualizarTerritorio", async () => {
    const { listTerritorios, atualizarTerritorio } = await import("../lib/territorios");
    const limites: GeoJSON.MultiPolygon = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [-46, -23],
            [-45, -23],
            [-45, -22],
            [-46, -22],
            [-46, -23],
          ],
        ],
      ],
    };
    vi.mocked(listTerritorios).mockResolvedValue([
      { id: "t1", numero: "12", nome: "Centro", limites, ativo: true, created_at: "" },
    ]);

    render(
      <MemoryRouter initialEntries={["/cadastro/t1"]}>
        <Routes>
          <Route path="/cadastro/:id" element={<Cadastro />} />
        </Routes>
      </MemoryRouter>,
    );

    const numero = await screen.findByLabelText(/número do território/i);
    expect(numero).toHaveValue("12");

    const salvar = await screen.findByRole("button", { name: /salvar alterações/i });
    expect(salvar).toBeEnabled();
    fireEvent.click(salvar);

    await waitFor(() =>
      expect(atualizarTerritorio).toHaveBeenCalledWith("t1", {
        numero: "12",
        nome: "Centro",
        limites,
      }),
    );
  });
```

E ajuste os imports do topo do arquivo de teste:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
```

- [ ] **Step 2: Rode o teste e confirme que falha**

Run: `npx vitest run src/screens/Cadastro.test.tsx`
Expected: FAIL — não existe botão "Salvar alterações"; o componente ignora o `:id` da rota.

- [ ] **Step 3: Carregue o território no modo edição**

Em `src/screens/Cadastro.tsx`, ajuste os imports:

```tsx
import { Link, useParams, useNavigate } from "react-router-dom";
import { BaseMap } from "../map/BaseMap";
import type { ViewState, Bounds } from "../map/BaseMap";
import {
  criarTerritorio,
  atualizarTerritorio,
  listTerritorios,
  multiPolygonDe,
  featureCollectionDe,
  boundsDeTerritorios,
  quadrasDe,
} from "../lib/territorios";
```

No corpo de `Cadastro`, logo no começo, acrescente:

```tsx
  const { id } = useParams();
  const navigate = useNavigate();
  const [inicial, setInicial] = useState<ViewState | undefined>(undefined);
  const [enquadramento, setEnquadramento] = useState<Bounds | undefined>(undefined);
  const [desenhoInicial, setDesenhoInicial] =
    useState<GeoJSON.FeatureCollection | null>(null);
```

(o `inicial` já existe — mantenha só uma declaração dele) e substitua o `useEffect` de geolocalização inteiro por:

```tsx
  useEffect(() => {
    if (id) {
      listTerritorios()
        .then((todos) => {
          const t = todos.find((x) => x.id === id);
          if (!t) {
            toast.error("Território não encontrado.");
            navigate("/");
            return;
          }
          setNumero(t.numero);
          setNome(t.nome ?? "");
          setQuadras(
            t.limites
              ? { type: "MultiPolygon", coordinates: quadrasDe(t.limites) }
              : null,
          );
          setDesenhoInicial(featureCollectionDe(t.limites));
          setEnquadramento(boundsDeTerritorios([t]) ?? undefined);
          setMapaPronto(true);
        })
        .catch(() => {
          toast.error("Não foi possível abrir o território.");
          navigate("/");
        });
      return;
    }

    if (!navigator.geolocation) {
      setMapaPronto(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setInicial({
          longitude: pos.coords.longitude,
          latitude: pos.coords.latitude,
          zoom: 16,
        });
        setMapaPronto(true);
      },
      () => setMapaPronto(true),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [id, navigate]);
```

- [ ] **Step 4: Injete as quadras existentes no `MapboxDraw`**

Ainda em `src/screens/Cadastro.tsx`, o `DrawControl` passa a receber o desenho inicial. Troque a assinatura e acrescente o efeito (o `useControl` do passo anterior fica igual):

```tsx
function DrawControl({
  desenhoInicial,
  onChange,
}: {
  desenhoInicial: GeoJSON.FeatureCollection | null;
  onChange: (quadras: GeoJSON.MultiPolygon | null) => void;
}) {
  const draw = useRef<MapboxDraw | null>(null);
  const { current: map } = useMap();

  useControl<MapboxDraw>(
    () => {
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });
      return draw.current;
    },
    (evt) => {
      const m = evt.map as unknown as {
        on: (ev: string, cb: () => void) => void;
      };
      const atualizar = () =>
        onChange(multiPolygonDe(draw.current?.getAll().features ?? []));
      m.on("draw.create", atualizar);
      m.on("draw.update", atualizar);
      m.on("draw.delete", atualizar);
    },
  );

  useEffect(() => {
    if (!map || !desenhoInicial?.features.length) return;
    const aplicar = () => draw.current?.set(desenhoInicial);
    if (map.isStyleLoaded()) aplicar();
    else map.once("load", aplicar);
  }, [map, desenhoInicial]);

  return null;
}
```

Acrescente `useMap` ao import do `react-map-gl/mapbox`:

```tsx
import { useControl, useMap } from "react-map-gl/mapbox";
```

O `draw.set()` precisa do estilo do mapa carregado — por isso o `isStyleLoaded()` com fallback no evento `load`. O mesmo padrão de `useMap()` já é usado em `src/map/TerritoriosLayer.tsx`.

- [ ] **Step 5: Salve como update, e ajuste o `BaseMap` e os rótulos**

Em `salvar()`, substitua o corpo do `try` por:

```tsx
      if (id) {
        await atualizarTerritorio(id, {
          numero,
          nome: nome || undefined,
          limites: quadras,
        });
        toast.success(`Território Nº ${numero} atualizado.`);
        navigate("/");
      } else {
        await criarTerritorio({ numero, nome: nome || undefined, limites: quadras });
        setNumero("");
        setNome("");
        setQuadras(null);
        toast.success(`Território Nº ${numero} salvo.`);
      }
```

Troque o `<BaseMap>` (o `<DrawControl>` agora recebe o desenho inicial; `showLocation` sai no modo edição para o `GeolocateControl` não voar até a sua casa):

```tsx
          <BaseMap
            showLocation={!id}
            initialViewState={inicial}
            bounds={enquadramento}
          >
            <DrawControl desenhoInicial={desenhoInicial} onChange={onChange} />
          </BaseMap>
```

E no botão de salvar:

```tsx
            {salvando
              ? "Salvando…"
              : id
                ? "Salvar alterações"
                : "Salvar território"}
```

- [ ] **Step 6: Registre a rota**

Em `src/App.tsx`, logo abaixo da rota `/cadastro`:

```tsx
      <Route path="/cadastro/:id" element={<Cadastro />} />
```

- [ ] **Step 7: Botão "Editar" na Gestão**

Em `src/screens/Gestao.tsx`, dentro da barra de ações do card (a `<div className="col-span-full flex flex-wrap items-center gap-2 border-t border-line pt-3">`), logo **antes** do `<span className="flex-1" />`:

```tsx
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/cadastro/${t.id}`}>Editar</Link>
                    </Button>
```

- [ ] **Step 8: Rode a suíte inteira, o lint e o build**

Run: `npm run test && npm run lint && npm run build`
Expected: PASS nos três.

- [ ] **Step 9: Commit**

```bash
git add src/screens/Cadastro.tsx src/screens/Cadastro.test.tsx src/screens/Gestao.tsx src/App.tsx
git commit -m "feat(cadastro): editar o limite de um território existente"
```

---

### Task 7: Verificação no navegador

Os testes não exercem o `MapboxDraw` de verdade (o `BaseMap` é mockado). O acoplamento com o draw — em especial o `draw.set()` do modo edição, que depende do estilo do mapa estar carregado — só se prova no navegador. **Esta task não é opcional.**

**Files:** nenhum (só correções, se aparecerem).

- [ ] **Step 1: Suba o dev server**

Run: `npm run dev`
Abra `http://localhost:3000` e faça login.

- [ ] **Step 2: Criar um território de duas quadras**

Vá em "Cadastrar território", desenhe **duas** quadras separadas, dê um número e salve.
Esperado: o painel mostra "2 quadras desenhadas — pronto para salvar"; o toast confirma; na Gestão o selo do território mostra **duas formas soltas**.

- [ ] **Step 3: Ver no mapa e no campo**

Abra "Mapa da congregação": as duas quadras aparecem preenchidas, com a cor do status.
Abra o território (clique no selo): o mapa **enquadra as duas quadras** — nenhuma fica fora da tela.

- [ ] **Step 4: Editar**

Na Gestão, clique em "Editar" no card desse território.
Esperado: o mapa abre **já enquadrado** nas quadras existentes e elas aparecem **desenhadas e editáveis** no draw (é aqui que o `draw.set()` se prova). Acrescente uma terceira quadra, salve, e confirme que o selo passou a mostrar três formas.
Selecione uma quadra e use a **lixeira** do draw para removê-la; salve; confirme que voltou a duas.

- [ ] **Step 5: Território antigo (linha `Polygon`, sem migração)**

Abra um território **cadastrado antes desta mudança** (uma linha que ainda é `Polygon` no banco). Ele deve aparecer normalmente na lista, no mapa e no campo; ao clicar em "Editar", o polígono existente deve carregar no draw. Salve — ele passa a ser `MultiPolygon`, sem que nada mude visualmente.
Este é o passo que valida a decisão de **não** migrar o banco.

- [ ] **Step 6: Commit de qualquer correção**

Se algum passo acima exigiu conserto, corrija, rode `npm run test && npm run lint && npm run build`, e commite. Se nada quebrou, não há o que commitar.
