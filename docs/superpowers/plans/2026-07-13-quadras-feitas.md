# Quadras feitas — progresso do território — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcar, a partir de uma saída, **quais quadras de um território foram feitas**, e ver o progresso (`5/8`) do território até ele ficar completo.

**Architecture:** A quadra ganha **identidade estável**: `territorio.limites` deixa de ser um `MultiPolygon` (uma feature só, quadras sem id) e passa a ser uma `FeatureCollection` de `Polygon`s com `properties.id` — o próprio id que o `mapbox-gl-draw` já cria e que hoje é descartado. Isso resolve de uma vez as duas necessidades: uma marca pode apontar para uma quadra específica, e o Mapbox pode dizer *qual* quadra o dedo tocou. A marca é `quadra_feita(saida_id, territorio_id, quadra_id)`, sem data (é a da saída) e com FK **composta** para `saida_territorio` em `on delete cascade`. O progresso é **derivado** (nunca armazenado), cortado por `territorio.progresso_desde`.

**Tech Stack:** React 19 + TypeScript + Vite, `react-map-gl/mapbox` v8, `@mapbox/mapbox-gl-draw`, Supabase (`supabase-js`), Vitest + Testing Library, Tailwind v4 + shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-07-13-quadras-feitas-design.md`

## Global Constraints

- **Não escreva comentários no código.** O código se explica pelos nomes. (Regra do `CLAUDE.md`.)
- **A UI nunca chama `supabase` direto** — só através de `src/lib/*`.
- A migração `0003` é aplicada **por um humano** no SQL Editor do Supabase (o MCP é read-only). O arquivo entra no repo; nenhuma task de código depende de rodá-la localmente, mas **nada funciona em produção antes disso**.
- **Progresso é derivado, nunca armazenado.** O único estado novo é a linha de corte (`progresso_desde`) e as marcas.
- **Progresso não é status:** `statusTerritorio()` não ganha um quarto valor.
- Português nas strings de UI e nas mensagens de commit.
- Tudo verde em `npm run test`, `npm run lint` e `npm run build` ao fim de cada task.

---

### Task 1: Migração `0003_quadras_feitas.sql`

O SQL inteiro, de uma vez: a coluna de corte, a tabela de marcas com a FK composta, o RLS, e a conversão das linhas existentes de `limites` para `FeatureCollection` com um id por quadra.

**Files:**
- Create: `supabase/migrations/0003_quadras_feitas.sql`

- [ ] **Step 1: Escreva a migração**

```sql
-- super-train — quadras feitas (progresso do território)
-- Rode este arquivo em Supabase → SQL Editor (uma vez).

-- 1) Linha de corte da rodada. Nula = conta tudo.
alter table territorio add column if not exists progresso_desde date;

-- 2) A marca. Sem data (é a da saída) e sem flag: a linha existir É a quadra feita.
--    A FK composta para saida_territorio garante que só se marca quadra de um
--    território que está naquela saída, e limpa as marcas sozinha quando a saída
--    é apagada ou o território sai dela.
create table if not exists quadra_feita (
  saida_id      uuid not null,
  territorio_id uuid not null,
  quadra_id     text not null,
  created_at    timestamptz not null default now(),
  primary key (saida_id, territorio_id, quadra_id),
  foreign key (saida_id, territorio_id)
    references saida_territorio (saida_id, territorio_id) on delete cascade
);

create index if not exists quadra_feita_territorio_idx on quadra_feita (territorio_id);

alter table quadra_feita enable row level security;
create policy "auth_full_quadra_feita" on quadra_feita
  for all to authenticated using (true) with check (true);

-- 3) limites: MultiPolygon/Polygon -> FeatureCollection com um id por quadra.
update territorio t
set limites = jsonb_build_object('type', 'FeatureCollection', 'features', f.features)
from (
  select t2.id,
         jsonb_agg(jsonb_build_object(
           'type', 'Feature',
           'properties', jsonb_build_object('id', gen_random_uuid()::text),
           'geometry', jsonb_build_object('type', 'Polygon', 'coordinates', c.coords)
         )) as features
  from territorio t2,
       lateral jsonb_array_elements(t2.limites->'coordinates') as c(coords)
  where t2.limites->>'type' = 'MultiPolygon'
  group by t2.id
) f
where t.id = f.id;

update territorio
set limites = jsonb_build_object(
  'type', 'FeatureCollection',
  'features', jsonb_build_array(jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object('id', gen_random_uuid()::text),
    'geometry', jsonb_build_object('type', 'Polygon', 'coordinates', limites->'coordinates')
  ))
)
where limites->>'type' = 'Polygon';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0003_quadras_feitas.sql
git commit -m "feat(schema): quadra_feita, progresso_desde e limites com id por quadra"
```

- [ ] **Step 3: Peça ao humano para rodar a migração**

Avise: *"Rode `supabase/migrations/0003_quadras_feitas.sql` no SQL Editor do Supabase antes de testar no app."* Não siga para a Task 6 sem isso (as tasks 2–5 são testáveis com mocks).

---

### Task 2: Quadra com id — `quadrasDe`, `limitesDe`, `featureCollectionDe`

O alicerce. `quadrasDe()` deixa de devolver coordenadas soltas e passa a devolver **quadras com id**, tolerando as duas formas legadas. É o único ponto do código que conhece a dualidade.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/territorios.ts`
- Test: `src/lib/territorios.test.ts`

**Interfaces:**
- Produces:
  - `type Limites = GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.FeatureCollection<GeoJSON.Polygon>`
  - `interface Quadra { id: string; coordinates: GeoJSON.Position[][] }`
  - `quadrasDe(limites: Limites | null): Quadra[]`
  - `limitesDe(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> | null` (substitui `multiPolygonDe`)
  - `featureCollectionDe(limites: Limites | null): GeoJSON.FeatureCollection` (mantém o nome; agora carrega os ids)

- [ ] **Step 1: Escreva os testes que falham**

Em `src/lib/territorios.test.ts`, acrescente:

```ts
function fc(...ids: string[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: ids.map((id, i) => ({
      type: "Feature",
      properties: { id },
      geometry: quadrado(-46 + i * 2, -23 + i * 2),
    })),
  };
}

describe("quadrasDe", () => {
  it("preserva o id de cada quadra numa FeatureCollection", () => {
    expect(quadrasDe(fc("a", "b")).map((q) => q.id)).toEqual(["a", "b"]);
  });

  it("dá id por índice a um MultiPolygon legado", () => {
    const m = multi(quadrado(-46, -23), quadrado(-44, -21));
    expect(quadrasDe(m).map((q) => q.id)).toEqual(["0", "1"]);
  });

  it("trata um Polygon legado como uma quadra só", () => {
    expect(quadrasDe(quadrado(-46, -23))).toHaveLength(1);
  });

  it("devolve lista vazia sem limites", () => {
    expect(quadrasDe(null)).toEqual([]);
  });
});

describe("limitesDe", () => {
  it("mantém o id que o draw deu à feature", () => {
    const f: GeoJSON.Feature = {
      type: "Feature",
      id: "draw-1",
      properties: {},
      geometry: quadrado(-46, -23),
    };
    expect(limitesDe([f])?.features[0].properties?.id).toBe("draw-1");
  });

  it("devolve null quando não há polígono", () => {
    expect(limitesDe([])).toBeNull();
  });
});
```

Ajuste os testes existentes de `boundsDeTerritorios` que usem `quadrasDe` indiretamente — os cenários (`Polygon`, `MultiPolygon`, lista mista) continuam válidos e devem continuar passando; acrescente um com `FeatureCollection`.

- [ ] **Step 2: Rode e confirme que falham**

Run: `npx vitest run src/lib/territorios.test.ts` → FAIL (`limitesDe is not a function`; `quadrasDe` devolve coordenadas sem `id`).

- [ ] **Step 3: Implemente**

Em `types.ts`, troque o tipo `Limites`:

```ts
export type Limites =
  | GeoJSON.Polygon
  | GeoJSON.MultiPolygon
  | GeoJSON.FeatureCollection<GeoJSON.Polygon>;
```

Em `territorios.ts`:

```ts
export interface Quadra {
  id: string;
  coordinates: GeoJSON.Position[][];
}

export function quadrasDe(limites: Limites | null): Quadra[] {
  if (!limites) return [];
  if (limites.type === "FeatureCollection") {
    return limites.features.map((f, i) => ({
      id: String(f.properties?.id ?? f.id ?? i),
      coordinates: f.geometry.coordinates,
    }));
  }
  const coords =
    limites.type === "MultiPolygon" ? limites.coordinates : [limites.coordinates];
  return coords.map((coordinates, i) => ({ id: String(i), coordinates }));
}

export function limitesDe(
  features: GeoJSON.Feature[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon> | null {
  const poligonos = features.filter((f) => f.geometry?.type === "Polygon");
  if (poligonos.length === 0) return null;
  return {
    type: "FeatureCollection",
    features: poligonos.map((f) => ({
      type: "Feature",
      properties: { id: String(f.properties?.id ?? f.id ?? crypto.randomUUID()) },
      geometry: f.geometry as GeoJSON.Polygon,
    })),
  };
}

export function featureCollectionDe(limites: Limites | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: quadrasDe(limites).map((q) => ({
      type: "Feature",
      id: q.id,
      properties: { id: q.id },
      geometry: { type: "Polygon", coordinates: q.coordinates },
    })),
  };
}
```

Converta `boundsDeTerritorios` para iterar `quadra.coordinates`. Apague `multiPolygonDe`. Troque a assinatura de `criarTerritorio`/`atualizarTerritorio` para receber `limites: GeoJSON.FeatureCollection<GeoJSON.Polygon>`.

- [ ] **Step 4: Conserte os consumidores de geometria**

- `src/screens/TerritorioGlyph.tsx`: `quadrasDe(...).map((quadra) => quadra.coordinates[0])`.
- `src/map/TerritorioPolygon.tsx`: passa a montar a fonte com `featureCollectionDe(limites)` em vez de usar `limites` como `geometry` (uma `FeatureCollection` não é uma geometria válida para `Source`).
- `src/screens/Cadastro.tsx`: `multiPolygonDe` → `limitesDe`; o `desenhoInicial` continua vindo de `featureCollectionDe` (que agora carrega `id`, e o `MapboxDraw` o preserva no `draw.set`).

- [ ] **Step 5: Rode a suíte inteira**

Run: `npm run test && npm run lint && npm run build` → tudo verde.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(territorios): quadra com id estável (limites como FeatureCollection)"
```

---

### Task 3: `atualizarSaida` faz diff (pré-requisito do cascade)

Hoje ele apaga **todos** os `saida_territorio` e reinsere. Com o `on delete cascade` da Task 1, editar o dirigente de uma saída apagaria todas as marcas dela. Passa a remover só quem saiu e inserir só quem entrou.

**Files:**
- Modify: `src/lib/saidas.ts`
- Test: `src/lib/saidas.test.ts`

- [ ] **Step 1: Escreva o teste que falha**

Um teste com o mock do supabase provando que, ao atualizar uma saída mantendo o mesmo território, **nenhum `delete` é emitido** para aquele `territorio_id` — e que um território removido gera `delete` só dele. Siga o padrão de mock já usado em `saidas.test.ts`.

- [ ] **Step 2: Rode e confirme que falha**

Run: `npx vitest run src/lib/saidas.test.ts` → FAIL (o delete atual é irrestrito).

- [ ] **Step 3: Implemente o diff**

```ts
export async function atualizarSaida(id: string, entrada: EntradaSaida): Promise<void> {
  const { territorio_ids, ...campos } = entrada;
  const { error } = await supabase.from("saida").update(campos).eq("id", id);
  if (error) throw error;

  const { data, error: erroAtuais } = await supabase
    .from("saida_territorio")
    .select("territorio_id")
    .eq("saida_id", id);
  if (erroAtuais) throw erroAtuais;

  const atuais = (data as { territorio_id: string }[]).map((v) => v.territorio_id);
  const removidos = atuais.filter((t) => !territorio_ids.includes(t));
  const novos = territorio_ids.filter((t) => !atuais.includes(t));

  if (removidos.length > 0) {
    const { error: erroRemocao } = await supabase
      .from("saida_territorio")
      .delete()
      .eq("saida_id", id)
      .in("territorio_id", removidos);
    if (erroRemocao) throw erroRemocao;
  }

  await vincularTerritorios(id, novos);
}
```

- [ ] **Step 4: Rode e confirme que passa** — `npx vitest run src/lib/saidas.test.ts`

- [ ] **Step 5: Commit**

```bash
git commit -am "fix(saidas): atualizarSaida faz diff dos territórios em vez de recriar"
```

---

### Task 4: Camada de dados das marcas — `src/lib/quadras.ts`

O novo módulo, no padrão fino dos outros: as quatro chamadas ao Supabase e as **funções puras** de progresso (que é onde a regra da rodada mora).

**Files:**
- Create: `src/lib/quadras.ts`
- Create: `src/lib/quadras.test.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces:
  - `interface Marca { saida_id: string; territorio_id: string; quadra_id: string; data: string }`
  - `listMarcas(): Promise<Marca[]>` (join com `saida(data)`)
  - `marcarQuadra(saida_id, territorio_id, quadra_id): Promise<void>`
  - `desmarcarQuadra(saida_id, territorio_id, quadra_id): Promise<void>`
  - `iniciarNovaRodada(territorio_id: string): Promise<void>` (grava `progresso_desde = hoje`)
  - `marcasDaRodada(t: Territorio, marcas: Marca[]): Marca[]` — pura
  - `quadrasFeitasDe(t: Territorio, marcas: Marca[]): Set<string>` — pura
  - `progressoDe(t, marcas): { feitas: number; total: number; concluido: boolean }` — pura
- `Territorio` ganha `progresso_desde: string | null`.

- [ ] **Step 1: Escreva os testes das funções puras (que falham)**

Cubra, em `quadras.test.ts`:
- marca de saída **anterior** a `progresso_desde` não conta; de saída na mesma data ou depois, conta;
- `progresso_desde` nulo conta tudo;
- a mesma quadra marcada em **duas saídas** conta **uma vez só**;
- marca **órfã** (quadra que não existe mais no desenho) não conta e não infla o total;
- território sem limites: `total: 0`, `concluido: false`;
- `concluido` só com `total > 0 && feitas === total`.

- [ ] **Step 2: Rode e confirme que falham** — `npx vitest run src/lib/quadras.test.ts`

- [ ] **Step 3: Implemente `src/lib/quadras.ts`**

As puras:

```ts
export function marcasDaRodada(t: Territorio, marcas: Marca[]): Marca[] {
  return marcas.filter(
    (m) =>
      m.territorio_id === t.id &&
      (!t.progresso_desde || m.data >= t.progresso_desde),
  );
}

export function quadrasFeitasDe(t: Territorio, marcas: Marca[]): Set<string> {
  const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
  return new Set(
    marcasDaRodada(t, marcas)
      .map((m) => m.quadra_id)
      .filter((id) => existentes.has(id)),
  );
}

export function progressoDe(t: Territorio, marcas: Marca[]) {
  const total = quadrasDe(t.limites).length;
  const feitas = quadrasFeitasDe(t, marcas).size;
  return { feitas, total, concluido: total > 0 && feitas === total };
}
```

As de banco seguem o padrão de `saidas.ts` (`listMarcas` faz `select("saida_id, territorio_id, quadra_id, saida(data)")` e achata o `data`).

- [ ] **Step 4: Rode e confirme que passam** — `npx vitest run src/lib/quadras.test.ts`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(quadras): marcas de quadra feita e progresso derivado do território"
```

---

### Task 5: Mapa por quadra — `TerritorioPolygon` com estados

O mapa passa a desenhar **uma feature por quadra**, pintada por estado, e a avisar qual quadra foi tocada. É a peça compartilhada pelo `Campo` (só leitura) e pela tela de marcar.

**Files:**
- Modify: `src/map/TerritorioPolygon.tsx`
- Modify: `src/screens/Campo.tsx`
- Test: `src/screens/Campo.test.tsx`

**Interfaces:**
- Produces: `type EstadoQuadra = "feita" | "outra" | "falta"` e
  `<TerritorioPolygon limites estados?: Record<string, EstadoQuadra> onQuadraClick?: (id: string) => void />`

- [ ] **Step 1: Implemente a pintura por estado**

A fonte vira `featureCollectionDe(limites)`, com `properties.estado` injetado a partir do mapa `estados` (padrão `"falta"`). O `fill` usa uma expressão data-driven:

```ts
"fill-color": [
  "match", ["get", "estado"],
  "feita", "#5b8c5a",
  "outra", "#a8c3a7",
  "#486492",
]
```

`onQuadraClick` vem de um `onClick` na `Layer` (o `react-map-gl` entrega `features[0].properties.id`). Sem `onQuadraClick`, o mapa é só leitura. As camadas `casing`/`line` continuam como estão.

- [ ] **Step 2: Ligue o `Campo`**

`Campo` carrega as marcas (`listMarcas`) e passa `estados` com `"feita"` para as quadras da rodada. Sem `onQuadraClick` — não se marca no Campo.

- [ ] **Step 3: Teste** — `Campo.test.tsx`: um território com uma quadra feita renderiza o polígono com o estado correto.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(mapa): quadras como features próprias, pintadas por estado"
```

---

### Task 6: Tela de marcar — `/saida/:saidaId/territorio/:territorioId`

A porta única de marcação, aberta do painel do dia. A data que aparece é **a da saída**, nunca "hoje".

**Files:**
- Create: `src/screens/MarcarQuadras.tsx`
- Create: `src/screens/MarcarQuadras.test.tsx`
- Modify: `src/App.tsx` (rota)
- Modify: `src/screens/Calendario.tsx` (entrada)

- [ ] **Step 1: Escreva os testes que falham**

- toque numa quadra "falta" chama `marcarQuadra` e ela fica verde;
- toque numa quadra feita **nesta** saída chama `desmarcarQuadra`;
- toque numa quadra feita em **outra** saída da rodada **não chama nada** e mostra o toast *"já feita na saída de 12/07"*;
- a faixa do topo mostra a data da **saída**, não a de hoje.

- [ ] **Step 2: Implemente a tela**

`BaseMap` + `TerritorioPolygon` (com `estados` e `onQuadraClick`), enquadrado por `boundsDeTerritorios([t])`. Faixa no topo com voltar, `Marcando: {dia}, {dataBR(saida.data)}` e `Território Nº {t.numero}`, no mesmo estilo do link flutuante que `Campo` já usa. Rodapé com o resumo `{feitas} de {total} quadras nesta rodada`.

Estado de cada quadra: `feita` (marca desta saída) · `outra` (marca da rodada, de outra saída) · `falta`. A marcação é **otimista**: pinta na hora, e em caso de erro volta ao estado anterior com toast de "tente novamente".

- [ ] **Step 3: Entrada no Calendário**

No painel do dia, cada território de uma saída vira `Link` para `/saida/:saidaId/territorio/:territorioId`, com o resumo *"3 de 8 quadras"* (feitas **nesta** saída / total do território).

- [ ] **Step 4: Rode e confirme que passam** — `npm run test`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(saidas): marcar as quadras feitas de um território na saída"
```

---

### Task 7: Progresso e rodada na `Gestao`

A tela de controle. O selo preenchido é a entrega visual principal do design.

**Files:**
- Modify: `src/screens/Gestao.tsx`
- Modify: `src/screens/TerritorioGlyph.tsx`
- Test: `src/screens/Gestao.test.tsx`, `src/screens/TerritorioGlyph.test.tsx`

- [ ] **Step 1: Escreva os testes que falham**

- `TerritorioGlyph` com `feitas={new Set(["a"])}` pinta **só** aquela quadra;
- `Gestao` mostra `5/8 quadras`;
- em 100%, mostra **Concluído** e o botão **Começar nova rodada**;
- clicar em "Começar nova rodada" chama `iniciarNovaRodada` e a contagem volta a `0/8`;
- devolver um território 100% feito abre o diálogo *"Território concluído. Começar nova rodada?"*, e recusar **não** zera.

- [ ] **Step 2: `TerritorioGlyph` ganha `feitas?: Set<string>`**

Deixa de desenhar um `<path>` único com N subpaths e passa a desenhar **um `<path>` por quadra** (o id já vem do `quadrasDe`), com `fill` verde quando a quadra está em `feitas`. O placeholder tracejado (território sem limite) não muda.

- [ ] **Step 3: `Gestao`**

Carrega `listMarcas()` junto do resto. Cada card mostra `{feitas}/{total} quadras` ao lado do status e passa `feitas` para o selo. Em `concluido`, badge **Concluído** e o botão de nova rodada. O `Devolver` de um território concluído encadeia o `AlertDialog` de nova rodada (recusar apenas devolve).

- [ ] **Step 4: Rode e confirme que passam** — `npm run test`

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(gestao): progresso do território, selo preenchido e nova rodada"
```

---

### Task 8: `Cadastro` avisa antes de mexer num território com rodada em andamento

**Files:**
- Modify: `src/screens/Cadastro.tsx`
- Test: `src/screens/Cadastro.test.tsx`

- [ ] **Step 1: Teste que falha** — salvar um território com quadras marcadas na rodada abre a confirmação; confirmar salva; cancelar não salva. Território sem marcas salva direto, sem diálogo.

- [ ] **Step 2: Implemente** — no modo edição, carrega as marcas junto do território; se `progressoDe().feitas > 0`, `salvar()` passa por um `AlertDialog`: *"Este território tem {n} quadras marcadas nesta rodada. A edição pode afetar o progresso."* Reusa o padrão de `AlertDialog` que a tela já tem para "sair sem salvar".

- [ ] **Step 3: Rode a suíte inteira** — `npm run test && npm run lint && npm run build`

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(cadastro): avisa ao editar território com quadras marcadas na rodada"
```

---

## Verificação final

- [ ] A migração `0003` foi rodada no Supabase pelo humano.
- [ ] Criar uma saída com um território, marcar 2 de 3 quadras, e ver `2/3` na Gestão e o selo pela metade.
- [ ] **Editar o dirigente** dessa saída e confirmar que as marcas **continuam lá** (é o bug que a Task 3 conserta).
- [ ] Tirar o território da saída e confirmar que as marcas dele somem (cascade).
- [ ] Marcar a 3ª quadra: o território aparece como **Concluído** com o botão de nova rodada. Zerar e conferir que volta a `0/3` — e que as marcas antigas continuam no banco.
