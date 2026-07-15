# Relatório do mês — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma página "Relatório" que mostra na tela o panorama de campo de um mês (quadras feitas por território + concluídos) e gera a folha imprimível/PDF desse mês.

**Architecture:** Uma função pura `relatorioDoMes()` na camada de dados (`src/lib/quadras.ts`) deriva tudo das marcas que já existem — sem coluna nova, sem migração. Uma tela `Relatorio` (rota `/relatorio` dentro do `AppShell`, 5º item de nav) consome essa função, navega mês a mês reusando os helpers do Calendário, e imprime via `window.print()` reusando as classes `folha`/`nao-imprime` que já existem.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest, Tailwind v4, shadcn/ui, lucide-react, react-router-dom.

## Global Constraints

- **Sem comentários no código** (regra do CLAUDE.md) — nomes claros bastam.
- **UI nunca chama `supabase` direto** — só via a camada `src/lib/`.
- **Estado/progresso é derivado, nunca armazenado.**
- **Path alias `@` → `./src`**; componentes shadcn em `@/components/ui`.
- **Testes:** Vitest, no padrão de `src/lib/territorios.test.ts`.
- **Português** em toda a UI e nomes de domínio.

---

### Task 1: `relatorioDoMes()` — derivação do panorama do mês

**Files:**
- Modify: `src/lib/quadras.ts` (adicionar tipos + função, no fim do arquivo antes das funções `async`, junto de `progressoDe`)
- Test: `src/lib/relatorio.test.ts` (criar)

**Interfaces:**
- Consumes (já existentes em `src/lib/quadras.ts`): `Marca`, `marcasDaRodada(t, marcas)`, `quadrasFeitasDe(t, marcas)`; de `src/lib/territorios.ts`: `quadrasDe(limites)`; de `src/lib/saidas.ts`: `mesmoMes(data, m)` e o tipo `Mes`; de `src/lib/types.ts`: `Territorio`.
- Produces (a Task 2 depende disto):
  - `interface LinhaRelatorio { territorio: Territorio; feitasNoMes: number; total: number; concluidoNoMes: boolean }`
  - `interface RelatorioMes { linhas: LinhaRelatorio[]; totalQuadrasNoMes: number; totalConcluidos: number }`
  - `relatorioDoMes(m: Mes, territorios: Territorio[], marcas: Marca[]): RelatorioMes`
  - Regras: `linhas` só inclui territórios com `feitasNoMes > 0` ou `concluidoNoMes`, e **preserva a ordem do array `territorios` de entrada** (que já vem ordenado por `listTerritorios`). Nenhum sort próprio.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/relatorio.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { relatorioDoMes, type Marca } from "./quadras";
import type { Territorio } from "./types";

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

function colecao(
  ...quadras: [string, GeoJSON.Polygon][]
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: quadras.map(([id, geometry]) => ({
      type: "Feature",
      properties: { id },
      geometry,
    })),
  };
}

function territorio(numero: string, ...ids: string[]): Territorio {
  return {
    id: `t${numero}`,
    numero,
    nome: null,
    limites: colecao(...ids.map((id, i): [string, GeoJSON.Polygon] => [id, quadrado(-46 - i, -23)])),
    ativo: true,
    progresso_desde: null,
    created_at: "",
  };
}

function marca(territorio_id: string, quadra_id: string, data: string): Marca {
  return {
    saida_id: `s-${territorio_id}-${quadra_id}-${data}`,
    territorio_id,
    quadra_id,
    data,
    local: null,
    publicador_id: null,
  };
}

const julho = { ano: 2026, mes: 7 };

describe("relatorioDoMes", () => {
  it("mês sem marcas: linhas vazia e totais zero", () => {
    const t = territorio("12", "qa", "qb");
    expect(relatorioDoMes(julho, [t], [])).toEqual({
      linhas: [],
      totalQuadrasNoMes: 0,
      totalConcluidos: 0,
    });
  });

  it("ignora marca órfã (quadra que não existe mais no desenho)", () => {
    const t = territorio("12", "qa");
    const r = relatorioDoMes(julho, [t], [marca("t12", "qZ", "2026-07-05")]);
    expect(r.linhas).toEqual([]);
    expect(r.totalQuadrasNoMes).toBe(0);
  });

  it("conta a mesma quadra marcada em duas saídas do mês uma vez só", () => {
    const t = territorio("12", "qa", "qb");
    const r = relatorioDoMes(julho, [t], [
      marca("t12", "qa", "2026-07-03"),
      marca("t12", "qa", "2026-07-20"),
    ]);
    expect(r.linhas[0].feitasNoMes).toBe(1);
    expect(r.totalQuadrasNoMes).toBe(1);
  });

  it("marca concluidoNoMes quando a rodada fecha dentro do mês", () => {
    const t = territorio("12", "qa", "qb");
    const r = relatorioDoMes(julho, [t], [
      marca("t12", "qa", "2026-07-03"),
      marca("t12", "qb", "2026-07-10"),
    ]);
    expect(r.linhas[0]).toMatchObject({ feitasNoMes: 2, total: 2, concluidoNoMes: true });
    expect(r.totalConcluidos).toBe(1);
  });

  it("não conta como concluído no mês quando a última quadra fechou em outro mês", () => {
    const t = territorio("12", "qa", "qb");
    const marcas = [marca("t12", "qa", "2026-07-03"), marca("t12", "qb", "2026-08-02")];
    const r = relatorioDoMes(julho, [t], marcas);
    expect(r.linhas[0]).toMatchObject({ feitasNoMes: 1, concluidoNoMes: false });
    expect(r.totalConcluidos).toBe(0);
  });

  it("preserva a ordem de entrada e omite territórios sem avanço no mês", () => {
    const t5 = territorio("5", "qa");
    const t6 = territorio("6", "qa");
    const t7 = territorio("7", "qa");
    const r = relatorioDoMes(julho, [t5, t6, t7], [
      marca("t5", "qa", "2026-07-01"),
      marca("t7", "qa", "2026-07-09"),
    ]);
    expect(r.linhas.map((l) => l.territorio.numero)).toEqual(["5", "7"]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/lib/relatorio.test.ts`
Expected: FAIL — `relatorioDoMes is not exported` / não é função.

- [ ] **Step 3: Implementar `relatorioDoMes`**

Em `src/lib/quadras.ts`, adicionar o import de `saidas` no topo (junto dos outros imports):

```ts
import { mesmoMes, type Mes } from "./saidas";
```

E adicionar, logo depois de `progressoDe` (por volta da linha 99, antes dos `type MarcaRow`):

```ts
export interface LinhaRelatorio {
  territorio: Territorio;
  feitasNoMes: number;
  total: number;
  concluidoNoMes: boolean;
}

export interface RelatorioMes {
  linhas: LinhaRelatorio[];
  totalQuadrasNoMes: number;
  totalConcluidos: number;
}

export function relatorioDoMes(
  m: Mes,
  territorios: Territorio[],
  marcas: Marca[],
): RelatorioMes {
  const linhas: LinhaRelatorio[] = [];
  for (const t of territorios) {
    const existentes = new Set(quadrasDe(t.limites).map((q) => q.id));
    const total = existentes.size;

    const feitasNoMes = new Set(
      marcas
        .filter(
          (mk) =>
            mk.territorio_id === t.id &&
            existentes.has(mk.quadra_id) &&
            mesmoMes(mk.data, m),
        )
        .map((mk) => mk.quadra_id),
    ).size;

    const daRodada = marcasDaRodada(t, marcas).filter((mk) =>
      existentes.has(mk.quadra_id),
    );
    const feitasRodada = quadrasFeitasDe(t, marcas).size;
    const ultimaData = daRodada.reduce<string | null>(
      (max, mk) => (max === null || mk.data > max ? mk.data : max),
      null,
    );
    const concluidoNoMes =
      total > 0 &&
      feitasRodada === total &&
      ultimaData !== null &&
      mesmoMes(ultimaData, m);

    if (feitasNoMes > 0 || concluidoNoMes) {
      linhas.push({ territorio: t, feitasNoMes, total, concluidoNoMes });
    }
  }
  return {
    linhas,
    totalQuadrasNoMes: linhas.reduce((soma, l) => soma + l.feitasNoMes, 0),
    totalConcluidos: linhas.filter((l) => l.concluidoNoMes).length,
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/lib/relatorio.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: `tsc -b` sem erros; bundle gerado.

- [ ] **Step 6: Commit**

```bash
git add src/lib/quadras.ts src/lib/relatorio.test.ts
git commit -m "feat(relatorio): relatorioDoMes deriva o panorama de campo do mês"
```

---

### Task 2: Tela `Relatorio` + rota + navegação

**Files:**
- Create: `src/screens/Relatorio.tsx`
- Modify: `src/App.tsx` (importar `Relatorio`, adicionar `<Route path="/relatorio" element={<Relatorio />} />` dentro do bloco `<Route element={<AppShell />}>`)
- Modify: `src/components/AppShell.tsx` (adicionar o item de nav)

**Interfaces:**
- Consumes: `relatorioDoMes`, `listMarcas`, `quadrasFeitasDe`, tipo `Marca` (de `src/lib/quadras.ts`); `listTerritorios` (de `src/lib/territorios.ts`); `Mes`, `MES_NOME`, `mesVizinho` (de `src/lib/saidas.ts`); `TerritorioGlyph` (de `src/screens/TerritorioGlyph`); `Button` (de `@/components/ui/button`); `Territorio` (de `src/lib/types.ts`).
- Produces: componente `Relatorio` exportado; rota `/relatorio`.

- [ ] **Step 1: Criar a tela `src/screens/Relatorio.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { listTerritorios } from "../lib/territorios";
import {
  listMarcas,
  quadrasFeitasDe,
  relatorioDoMes,
  type Marca,
} from "../lib/quadras";
import { MES_NOME, mesVizinho, type Mes } from "../lib/saidas";
import type { Territorio } from "../lib/types";
import { TerritorioGlyph } from "./TerritorioGlyph";
import { Button } from "@/components/ui/button";

export function Relatorio() {
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mes, setMes] = useState<Mes>(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  });

  useEffect(() => {
    Promise.all([listTerritorios(), listMarcas()])
      .then(([t, m]) => {
        setTerritorios(t);
        setMarcas(m);
      })
      .finally(() => setCarregando(false));
  }, []);

  const relatorio = relatorioDoMes(mes, territorios, marcas);

  return (
    <div className="folha mx-auto grid max-w-220 gap-[clamp(16px,3vw,26px)] px-[clamp(14px,4vw,32px)] pt-[clamp(16px,4vw,40px)] pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div className="nao-imprime flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            Imprimir
          </Button>
          <div className="flex items-center rounded-lg border border-line bg-white">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Mês anterior"
              onClick={() => setMes(mesVizinho(mes, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="border-x border-line text-ink-soft"
              onClick={() => {
                const d = new Date();
                setMes({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
              }}
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Próximo mês"
              onClick={() => setMes(mesVizinho(mes, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="ml-auto text-right">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
            Relatório de campo
          </p>
          <h1 className="mt-1 font-escala text-[clamp(1.6rem,4vw,2.2rem)] font-bold leading-none tracking-[-0.02em] text-jwblue-deep">
            {MES_NOME[mes.mes - 1]}{" "}
            <span className="font-escala-mono tabular-nums text-ink-faint">
              {mes.ano}
            </span>
          </h1>
        </div>
      </header>

      {carregando ? (
        <div
          role="status"
          aria-label="Carregando relatório"
          className="grid h-64 animate-pulse rounded-xl bg-mist"
        />
      ) : relatorio.linhas.length === 0 ? (
        <p className="py-6 text-[0.9rem] text-ink-soft">
          Nenhum trabalho registrado neste mês.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {[
              { rotulo: "Quadras feitas", valor: relatorio.totalQuadrasNoMes },
              { rotulo: "Territórios", valor: relatorio.linhas.length },
              { rotulo: "Concluídos", valor: relatorio.totalConcluidos },
            ].map(({ rotulo, valor }) => (
              <div
                key={rotulo}
                className="rounded-xl border border-line bg-white px-4 py-3 text-center shadow-card"
              >
                <dd className="font-mono text-[1.6rem] font-medium tabular-nums text-jwblue-deep">
                  {valor}
                </dd>
                <dt className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-ink-soft">
                  {rotulo}
                </dt>
              </div>
            ))}
          </dl>

          <ul className="grid gap-2.5">
            {relatorio.linhas.map((l) => (
              <li
                key={l.territorio.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-xl border border-line bg-white px-4 py-3 shadow-card"
              >
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
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Registrar a rota em `src/App.tsx`**

Adicionar o import junto dos outros de `./screens/...`:

```tsx
import { Relatorio } from "./screens/Relatorio";
```

E, dentro do bloco `<Route element={<AppShell />}>`, depois da rota `/publicadores`:

```tsx
        <Route path="/relatorio" element={<Relatorio />} />
```

- [ ] **Step 3: Adicionar o item de navegação em `src/components/AppShell.tsx`**

Adicionar `FileText` ao import de `lucide-react`:

```tsx
import { CalendarDays, FileText, LogOut, Map, Users } from "lucide-react";
```

E adicionar a entrada ao array `AREAS` (depois de Publicadores):

```tsx
  { to: "/publicadores", rotulo: "Publicadores", Icone: Users },
  { to: "/relatorio", rotulo: "Relatório", Icone: FileText },
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: `tsc -b` sem erros; bundle gerado.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 6: Verificação manual no app**

Run: `npm run dev` e abrir `http://localhost:3000/relatorio`.
Conferir:
- O item "Relatório" aparece na nav (topo no desktop, barra inferior no mobile) e leva à página.
- Navegar entre meses com ‹ › e "Hoje" muda o mês no título e a lista.
- Um mês com marcas mostra os três totais e a lista por território com `feitasNoMes/total`; um território que fechou a rodada naquele mês mostra o selo "Concluído".
- Um mês sem marcas mostra "Nenhum trabalho registrado neste mês.".
- Clicar em "Imprimir" abre o diálogo do navegador e a prévia esconde a nav e os controles (só título + totais + lista aparecem).

- [ ] **Step 7: Commit**

```bash
git add src/screens/Relatorio.tsx src/App.tsx src/components/AppShell.tsx
git commit -m "feat(relatorio): página do panorama do mês com folha imprimível"
```

---

## Self-Review

**Spec coverage:**
- `relatorioDoMes` pura + regras (órfã, distinção por quadra, concluído-no-mês, ordem de entrada) → Task 1. ✅
- Tela `/relatorio` + 5º item de nav + seletor de mês + panorama (3 totais + lista) + estado vazio → Task 2. ✅
- Folha imprimível reusando `folha`/`nao-imprime` + `window.print()` → Task 2 (container `folha`, controles `nao-imprime`). ✅
- Testes unitários de todos os casos do spec → Task 1 Step 1. ✅
- Sem migração/coluna nova → nenhuma tarefa toca `supabase/migrations`. ✅

**Placeholder scan:** nenhum TBD/TODO; todo código está completo nos steps.

**Type consistency:** `LinhaRelatorio`/`RelatorioMes`/`relatorioDoMes` definidos na Task 1 e consumidos com os mesmos nomes/campos (`linhas`, `feitasNoMes`, `total`, `concluidoNoMes`, `totalQuadrasNoMes`, `totalConcluidos`, `territorio`) na Task 2. `TerritorioGlyph` recebe `limites` + `feitas` (props reais, verificadas). `Mes`/`MES_NOME`/`mesVizinho` importados de `saidas.ts` (existentes). ✅
