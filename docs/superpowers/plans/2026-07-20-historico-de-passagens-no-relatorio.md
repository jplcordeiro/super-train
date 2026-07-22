# Histórico de passagens no relatório — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No relatório mensal, cada card de território abre e mostra as saídas daquele mês que marcaram quadras nele — data, ponto de encontro e quantas quadras cada dia rendeu.

**Architecture:** Nenhuma consulta nova ao Supabase. `Relatorio` já carrega todas as `marcas` via `listMarcas()`, e cada `Marca` já traz `data` e `local` copiados da saída. Uma função pura nova em `src/lib/quadras.ts` agrupa essas marcas por saída dentro do mês exibido; o card do relatório vira um `<details>` nativo cujo `<summary>` é a linha de hoje; uma regra em `@media print` abre os fechados para o papel sair completo.

**Tech Stack:** React 19 + TypeScript, Vitest + @testing-library/react (jsdom), Tailwind CSS v4 (config em `src/index.css`).

## Global Constraints

- **Não escrever comentários no código.** O código se explica por nomes claros. (`CLAUDE.md`)
- **UI nunca chama `supabase` direto** — só `src/lib/` toca no Supabase.
- **Estado derivado, nunca armazenado.** Progresso e histórico são calculados a partir das marcas.
- Nomes de domínio em português, como o resto do código (`passagensDoMes`, `PassagemMes`).
- Tokens de cor do design system: `text-ink`, `text-ink-soft`, `text-ink-faint`, `border-line`, `bg-white`. Não introduzir cores cruas.
- Texto de local nulo: `"Sem ponto de encontro"` (mesma string que `Calendario.tsx:538` usa).
- Rodar `npm run test` e `npm run build` antes de considerar qualquer tarefa pronta.

---

### Task 1: `passagensDoMes()` na camada de dados

**Files:**
- Modify: `src/lib/quadras.ts` (adicionar interface e função perto de `relatorioDoMes`)
- Test: `src/lib/quadras.test.ts` (novo bloco `describe`, no fim do arquivo)

**Interfaces:**
- Consumes: `Marca` (já existe em `src/lib/quadras.ts`), `quadrasDe` (de `./territorios`), `mesmoMes` e `Mes` (de `./saidas`) — os três já importados no topo de `quadras.ts`. `Territorio` já vem de `./types`.
- Produces:
  ```ts
  export interface PassagemMes {
    saida_id: string;
    data: string;
    local: string | null;
    quadras: number;
  }

  export function passagensDoMes(
    t: Territorio,
    m: Mes,
    marcas: Marca[],
  ): PassagemMes[]
  ```
  A Task 2 consome exatamente esses nomes.

- [ ] **Step 1: Escrever os testes que falham**

No fim de `src/lib/quadras.test.ts`, acrescentar o bloco abaixo. Ele reusa os helpers `territorio(ids)` e `marca(quadra_id, data, saida_id)` já definidos no topo do arquivo — `territorio` cria um território de id `"t1"` com uma quadra por id passado, e `marca` cria uma marca de `territorio_id: "t1"` com `local: null`.

```ts
describe("passagensDoMes", () => {
  const julho = { ano: 2026, mes: 7 };

  it("agrupa as marcas por saída, em ordem de data", () => {
    const marcas: Marca[] = [
      { ...marca("qb", "2026-07-19", "s3"), local: "Salão" },
      { ...marca("qa", "2026-07-05", "s1"), local: "Salão" },
      { ...marca("qc", "2026-07-12", "s2"), local: "Praça da Matriz" },
    ];

    expect(passagensDoMes(territorio(["qa", "qb", "qc"]), julho, marcas)).toEqual([
      { saida_id: "s1", data: "2026-07-05", local: "Salão", quadras: 1 },
      { saida_id: "s2", data: "2026-07-12", local: "Praça da Matriz", quadras: 1 },
      { saida_id: "s3", data: "2026-07-19", local: "Salão", quadras: 1 },
    ]);
  });

  it("conta quadras distintas dentro da mesma saída", () => {
    const marcas = [
      marca("qa", "2026-07-05"),
      marca("qb", "2026-07-05"),
      marca("qa", "2026-07-05"),
    ];

    expect(passagensDoMes(territorio(["qa", "qb"]), julho, marcas)).toEqual([
      { saida_id: "s1", data: "2026-07-05", local: null, quadras: 2 },
    ]);
  });

  it("ignora marcas de outro mês", () => {
    const marcas = [marca("qa", "2026-06-28"), marca("qb", "2026-07-05", "s2")];

    expect(passagensDoMes(territorio(["qa", "qb"]), julho, marcas)).toEqual([
      { saida_id: "s2", data: "2026-07-05", local: null, quadras: 1 },
    ]);
  });

  it("ignora marcas de outro território", () => {
    const marcas: Marca[] = [
      { ...marca("qa", "2026-07-05"), territorio_id: "outro" },
    ];

    expect(passagensDoMes(territorio(["qa"]), julho, marcas)).toEqual([]);
  });

  it("ignora marca cuja quadra sumiu do desenho", () => {
    const marcas = [marca("qa", "2026-07-05"), marca("apagada", "2026-07-05")];

    expect(passagensDoMes(territorio(["qa"]), julho, marcas)).toEqual([
      { saida_id: "s1", data: "2026-07-05", local: null, quadras: 1 },
    ]);
  });

  it("devolve lista vazia quando o mês não teve passagem", () => {
    expect(passagensDoMes(territorio(["qa"]), julho, [])).toEqual([]);
  });
});
```

Acrescentar `passagensDoMes` à lista de imports de `./quadras` no topo do arquivo de teste.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run -t "passagensDoMes"`
Expected: FAIL — `passagensDoMes is not a function` (ou erro de typecheck do import).

- [ ] **Step 3: Implementar**

Em `src/lib/quadras.ts`, logo depois de `export interface LinhaRelatorio { … }` e antes de `fechamentosDe`:

```ts
export interface PassagemMes {
  saida_id: string;
  data: string;
  local: string | null;
  quadras: number;
}

export function passagensDoMes(
  t: Territorio,
  m: Mes,
  marcas: Marca[],
): PassagemMes[] {
  const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
  const porSaida = new Map<string, PassagemMes & { vistas: Set<string> }>();

  for (const mk of marcas) {
    if (mk.territorio_id !== t.id) continue;
    if (!existentes.has(mk.quadra_id)) continue;
    if (!mesmoMes(mk.data, m)) continue;

    const atual = porSaida.get(mk.saida_id) ?? {
      saida_id: mk.saida_id,
      data: mk.data,
      local: mk.local,
      quadras: 0,
      vistas: new Set<string>(),
    };
    atual.vistas.add(mk.quadra_id);
    atual.quadras = atual.vistas.size;
    porSaida.set(mk.saida_id, atual);
  }

  return [...porSaida.values()]
    .map(({ vistas: _vistas, ...passagem }) => passagem)
    .sort((a, b) => a.data.localeCompare(b.data));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run -t "passagensDoMes"`
Expected: PASS, 6 testes.

- [ ] **Step 5: Suíte inteira e build**

Run: `npm run test && npm run build`
Expected: tudo verde; `tsc -b` sem erro. Se o `oxlint` reclamar de `_vistas` não usado, rodar `npm run lint` e ajustar o nome conforme a regra do projeto.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quadras.ts src/lib/quadras.test.ts
git commit -m "feat(relatorio): passagensDoMes agrupa as marcas do mês por saída"
```

---

### Task 2: O card vira `<details>` com a lista de passagens

**Files:**
- Modify: `src/screens/Relatorio.tsx` (o `<li>` dentro de `relatorio.linhas.map`, hoje nas linhas ~123-160)
- Test: `src/screens/Relatorio.test.tsx` (criar)

**Interfaces:**
- Consumes: `passagensDoMes` e `PassagemMes` da Task 1; `dataBR` de `../lib/saidas` (já importado em `Relatorio.tsx`); `ChevronRight` de `lucide-react` (já importado).
- Produces: nada que outra tarefa consuma. A Task 3 depende apenas de o card ser um `<details>`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/screens/Relatorio.test.tsx`. O padrão de mock segue `src/screens/Gestao.test.tsx`: mocka só as funções de rede de cada módulo de `lib`, mantendo as puras reais via `importOriginal`.

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Relatorio } from "./Relatorio";
import type { Marca } from "../lib/quadras";
import type { Territorio } from "../lib/types";

const quadra = (id: string, lng: number): GeoJSON.Feature<GeoJSON.Polygon> => ({
  type: "Feature",
  properties: { id },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [lng, -23],
        [lng + 1, -23],
        [lng + 1, -22],
        [lng, -23],
      ],
    ],
  },
});

const territorio: Territorio = {
  id: "t1",
  numero: "12",
  nome: "Vila Nova",
  limites: {
    type: "FeatureCollection",
    features: [quadra("qa", -46), quadra("qb", -44)],
  },
  ativo: true,
  created_at: "",
};

vi.mock("../lib/territorios", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, listTerritorios: vi.fn() };
});
vi.mock("../lib/quadras", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, listMarcas: vi.fn() };
});
vi.mock("../lib/rodadas", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, listRodadas: vi.fn().mockResolvedValue([]) };
});

async function montar(marcas: Marca[], t: Territorio = territorio) {
  const { listTerritorios } = await import("../lib/territorios");
  const { listMarcas } = await import("../lib/quadras");
  vi.mocked(listTerritorios).mockResolvedValue([t]);
  vi.mocked(listMarcas).mockResolvedValue(marcas);
  render(<Relatorio />);
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
}

describe("Relatorio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date(2026, 6, 20));
  });

  it("lista as passagens do mês dentro do card do território", async () => {
    await montar([
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qa",
        data: "2026-07-05",
        local: "Salão",
        publicador_id: null,
      },
      {
        saida_id: "s2",
        territorio_id: "t1",
        quadra_id: "qb",
        data: "2026-07-12",
        local: null,
        publicador_id: null,
      },
    ]);

    expect(screen.getByText("2 saídas neste mês")).toBeInTheDocument();
    expect(screen.getByText("05/07/2026").closest("li")).toHaveTextContent(
      "05/07/2026 · Salão · 1 quadra",
    );
    expect(screen.getByText("12/07/2026").closest("li")).toHaveTextContent(
      "12/07/2026 · Sem ponto de encontro · 1 quadra",
    );
  });

  it("diz 1 saída no singular", async () => {
    await montar([
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qa",
        data: "2026-07-05",
        local: "Salão",
        publicador_id: null,
      },
    ]);

    expect(screen.getByText("1 saída neste mês")).toBeInTheDocument();
  });

  it("soma as quadras da mesma saída numa linha só", async () => {
    await montar([
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qa",
        data: "2026-07-05",
        local: "Salão",
        publicador_id: null,
      },
      {
        saida_id: "s1",
        territorio_id: "t1",
        quadra_id: "qb",
        data: "2026-07-05",
        local: "Salão",
        publicador_id: null,
      },
    ]);

    expect(screen.getByText("05/07/2026").closest("li")).toHaveTextContent(
      "2 quadras",
    );
  });
});
```

O `.closest("li")` é necessário: `getByText` casa um elemento pelos seus nós de texto **diretos**, então buscar pela data resolve para o `<span>` interno, cujo `textContent` é só a data. Ancorar no `<li>` é o que faz a asserção provar a linha inteira — data, local e contagem juntos.

Se `vi.setSystemTime` exigir fake timers no setup do projeto, trocar por `vi.useFakeTimers({ shouldAdvanceTime: true })` no `beforeEach` e `vi.useRealTimers()` num `afterEach`. O objetivo é apenas garantir que o mês inicial da tela seja julho/2026.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/screens/Relatorio.test.tsx`
Expected: FAIL — `Unable to find an element with the text: 2 saídas neste mês`.

- [ ] **Step 3: Implementar o card**

Em `src/screens/Relatorio.tsx`:

**3a.** Acrescentar `passagensDoMes` ao import de `../lib/quadras`:

```tsx
import {
  listMarcas,
  passagensDoMes,
  quadrasFeitasDe,
  relatorioDoMes,
  type Marca,
} from "../lib/quadras";
```

**3b.** Substituir o `<li>` inteiro dentro de `relatorio.linhas.map((l) => …)` por:

Todo território que chega em `relatorio.linhas` tem pelo menos uma passagem no mês — `relatorioDoMes` só o inclui se `feitasNoMes > 0 || concluidoNoMes`, o filtro de `feitasNoMes` é o mesmo de `passagensDoMes`, e um fechamento sempre data de uma marca. Por isso o card é sempre um `<details>`, sem branch para lista vazia.

```tsx
{relatorio.linhas.map((l) => {
  const passagens = passagensDoMes(l.territorio, mes, marcas);

  return (
    <li
      key={l.territorio.id}
      className="rounded-xl border border-line bg-white shadow-card"
    >
      <details className="group">
        <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-3.5 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="h-10 w-10 flex-none text-jwblue">
            <TerritorioGlyph
              limites={l.territorio.limites}
              feitas={quadrasFeitasDe(l.territorio, marcas)}
            />
          </div>
          <div className="grid min-w-0 gap-0.5">
            <span className="font-mono text-[1.1rem] font-medium tabular-nums text-ink">
              {l.territorio.numero}
            </span>
            <span className="truncate text-[0.9rem] text-ink-soft">
              {l.territorio.nome ?? "Sem nome"}
            </span>
            <span className="flex items-center gap-1 text-[0.78rem] text-ink-faint">
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 transition-transform group-open:rotate-90"
              />
              {passagens.length === 1
                ? "1 saída neste mês"
                : `${passagens.length} saídas neste mês`}
            </span>
          </div>
          <div className="grid justify-items-end gap-0.75 text-right">
            <span className="text-[0.8rem] tabular-nums text-ink-soft">
              <b className="font-medium text-ink">{l.feitasNoMes}</b>
              {l.total > 0 && ` de ${l.total}`} quadras
            </span>
            {l.concluidoNoMes && (
              <span className="rounded-full bg-sage-wash px-2 py-0.5 text-[0.72rem] font-medium text-sage-ink">
                Concluído
              </span>
            )}
          </div>
        </summary>
        <ul className="grid gap-1 border-t border-line px-4 py-2.5">
          {passagens.map((p) => (
            <li
              key={p.saida_id}
              className="text-[0.82rem] leading-snug text-ink-soft"
            >
              <span className="font-medium tabular-nums text-ink">
                {dataBR(p.data)}
              </span>
              {" · "}
              {p.local ?? "Sem ponto de encontro"}
              {" · "}
              {p.quadras === 1 ? "1 quadra" : `${p.quadras} quadras`}
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
})}
```

Atenção: o `map` passa de corpo-de-expressão (`(l) => (`) para corpo-de-bloco (`(l) => {` … `return`). O `key` continua no `<li>` externo; o `<li>` perde as classes de grid (elas foram para o `<summary>`) e mantém borda, fundo e sombra.

`dataBR` já está importado no arquivo (usado na seção "Rodadas"); `ChevronRight` também (usado no navegador de mês).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/screens/Relatorio.test.tsx`
Expected: PASS, 3 testes.

- [ ] **Step 5: Suíte inteira, lint e build**

Run: `npm run test && npm run lint && npm run build`
Expected: tudo verde.

- [ ] **Step 6: Conferir na tela**

Run: `npm run dev` e abrir o relatório em `http://localhost:3000`.
Expected: card com "N saídas neste mês"; clicar expande a lista; a seta gira ao abrir; navegar para outro mês troca as passagens junto com os números do cabeçalho.

- [ ] **Step 7: Commit**

```bash
git add src/screens/Relatorio.tsx src/screens/Relatorio.test.tsx
git commit -m "feat(relatorio): card do território abre as saídas do mês"
```

---

### Task 3: Impressão sai com todos os cards abertos

**Files:**
- Modify: `src/index.css` (dentro do `@media print` que começa na linha 182)

**Interfaces:**
- Consumes: o `<details>` do card, da Task 2.
- Produces: nada.

- [ ] **Step 1: Acrescentar a regra**

Dentro do bloco `@media print { … }` de `src/index.css`, depois da regra `.folha-agenda`:

```css
  details > summary ~ * {
    display: revert !important;
  }
  details::details-content {
    content-visibility: visible !important;
  }
```

As duas regras cobrem as duas implementações de `<details>` fechado: os navegadores antigos escondem o conteúdo com `display: none`, e o Chrome moderno o esconde via `content-visibility` no pseudo-elemento `::details-content`. Sem as duas, o papel sai com cards fechados em um dos dois casos.

- [ ] **Step 2: Conferir no navegador**

Run: `npm run dev`, abrir o relatório, deixar **todos** os cards fechados e apertar "Imprimir".
Expected: na pré-visualização de impressão, todos os cards aparecem com a lista de passagens visível.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: sem erro.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(relatorio): impressão abre as passagens de todos os cards"
```

---

## Fora do escopo deste plano

Dirigente na linha de passagem, histórico além do mês exibido, link da passagem para a saída no calendário, e qualquer mudança no histórico por quadra que já existe no mapa (`historicoDaQuadra`, `HistoricoQuadra`).
