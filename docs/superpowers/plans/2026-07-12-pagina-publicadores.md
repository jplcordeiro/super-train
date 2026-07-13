# Página de Publicadores — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar aos publicadores uma área própria (`/publicadores`), quarta aba da shell, que mostra por publicador as saídas que ele dirige no mês corrente — e tirar essa seção da tela de Gestão.

**Architecture:** Uma tela nova (`src/screens/Publicadores.tsx`) que compõe dados já existentes: `listPublicadores()`, `listTerritorios()` e `listSaidas(primeiro, último dia do mês)`. A `saida` já carrega `publicador_id` (o dirigente) e `territorio_ids`, então o agrupamento por dirigente é uma função pura na própria tela — testável sem rede. Nenhuma mudança de schema, RLS ou migração. A Gestão perde a seção de publicadores e `contagemPorPublicador()` sai da lib por ficar sem uso.

**Tech Stack:** React 19 + TypeScript, react-router-dom, Tailwind v4, shadcn/ui (`Button`, `Input`, `AlertDialog`), lucide-react, sonner, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-12-pagina-publicadores-design.md`

## Global Constraints

- **Sem comentários no código** (`CLAUDE.md`). Nomes claros no lugar de comentários.
- **A UI nunca chama `supabase` direto** — só através de `src/lib/*`.
- Português nos textos de interface; tokens de cor do `src/index.css` (`ink`, `ink-soft`, `ink-faint`, `line`, `jwblue`, `jwblue-deep`, `mist`, `paper`).
- Rodar `npm run build` (typecheck) e `npm run test` antes de cada commit.
- Mensagens de commit em português, no padrão do repositório (`feat:`, `refactor:`).

---

### Task 1: `MES_NOME` compartilhado

Hoje `MES_NOME` é um `const` local de `src/screens/Calendario.tsx:47`. A tela nova precisa do mesmo vocabulário; ele passa para `src/lib/saidas.ts`, que já é o módulo do calendário (`DIA_SEMANA`, `iso`, `mesDe`, …).

**Files:**
- Modify: `src/lib/saidas.ts` (adicionar export perto de `DIA_SEMANA`, linha ~9)
- Modify: `src/screens/Calendario.tsx:47-60` (remover o const local, importar da lib)

**Interfaces:**
- Produces: `MES_NOME: readonly string[]` em `src/lib/saidas.ts` — índice 0 = "Janeiro".

- [ ] **Step 1: Adicionar `MES_NOME` a `src/lib/saidas.ts`**

Logo abaixo do bloco `DIA_SEMANA`:

```ts
export const MES_NOME = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;
```

- [ ] **Step 2: Remover o const local do Calendário e importar da lib**

Apagar as linhas 47-60 de `src/screens/Calendario.tsx` (o `const MES_NOME = [...]`) e acrescentar `MES_NOME` à lista de imports que já vem de `../lib/saidas` nesse arquivo.

- [ ] **Step 3: Verificar typecheck e testes**

Run: `npm run build && npm run test`
Expected: build sem erros; 63 testes passando (nenhum a mais, nenhum a menos).

- [ ] **Step 4: Commit**

```bash
git add src/lib/saidas.ts src/screens/Calendario.tsx
git commit -m "refactor: MES_NOME compartilhado em lib/saidas"
```

---

### Task 2: `saidasPorDirigente` — o agrupamento (TDD)

A função pura que a tela usa. Agrupa as saídas do mês pelo dirigente (`publicador_id`), ordenadas por data e, no mesmo dia, manhã antes de tarde. Saídas sem dirigente ("a definir", `publicador_id: null`) são descartadas.

**Files:**
- Create: `src/screens/Publicadores.tsx` (só a função pura nesta task)
- Create: `src/screens/Publicadores.test.tsx`

**Interfaces:**
- Consumes: `Saida` de `src/lib/types.ts` — `{ id, data, periodo, local, publicador_id, observacao, created_at, territorio_ids }`.
- Produces: `saidasPorDirigente(saidas: Saida[]): Map<string, Saida[]>` — chave é `publicador_id`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/screens/Publicadores.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { saidasPorDirigente } from "./Publicadores";
import type { Saida } from "../lib/types";

function saida(over: Partial<Saida>): Saida {
  return {
    id: "s",
    data: "2026-07-05",
    periodo: "manha",
    local: null,
    publicador_id: null,
    observacao: null,
    created_at: "",
    territorio_ids: [],
    ...over,
  };
}

describe("saidasPorDirigente", () => {
  it("agrupa as saídas pelo dirigente", () => {
    const grupos = saidasPorDirigente([
      saida({ id: "a", publicador_id: "p1" }),
      saida({ id: "b", publicador_id: "p2" }),
      saida({ id: "c", publicador_id: "p1" }),
    ]);
    expect(grupos.get("p1")?.map((s) => s.id)).toEqual(["a", "c"]);
    expect(grupos.get("p2")?.map((s) => s.id)).toEqual(["b"]);
  });

  it("ordena por data e põe a manhã antes da tarde no mesmo dia", () => {
    const grupos = saidasPorDirigente([
      saida({ id: "tarde", data: "2026-07-05", periodo: "tarde", publicador_id: "p1" }),
      saida({ id: "depois", data: "2026-07-12", periodo: "manha", publicador_id: "p1" }),
      saida({ id: "manha", data: "2026-07-05", periodo: "manha", publicador_id: "p1" }),
    ]);
    expect(grupos.get("p1")?.map((s) => s.id)).toEqual(["manha", "tarde", "depois"]);
  });

  it("descarta saídas sem dirigente", () => {
    const grupos = saidasPorDirigente([saida({ id: "a", publicador_id: null })]);
    expect(grupos.size).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/screens/Publicadores.test.tsx`
Expected: FAIL — não resolve `./Publicadores` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar a função**

Criar `src/screens/Publicadores.tsx` com apenas:

```tsx
import type { Saida } from "../lib/types";

export function saidasPorDirigente(saidas: Saida[]): Map<string, Saida[]> {
  const grupos = new Map<string, Saida[]>();
  const ordenadas = [...saidas].sort((a, b) =>
    a.data === b.data
      ? Number(a.periodo === "tarde") - Number(b.periodo === "tarde")
      : a.data.localeCompare(b.data),
  );
  for (const s of ordenadas) {
    if (!s.publicador_id) continue;
    const grupo = grupos.get(s.publicador_id);
    if (grupo) grupo.push(s);
    else grupos.set(s.publicador_id, [s]);
  }
  return grupos;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/screens/Publicadores.test.tsx`
Expected: PASS — 3 testes.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Publicadores.tsx src/screens/Publicadores.test.tsx
git commit -m "feat: Agrupamento das saídas do mês por dirigente"
```

---

### Task 3: A tela de Publicadores (TDD)

A tela completa: cabeçalho com o mês corrente, formulário de adicionar, e um cartão por publicador com as saídas que ele dirige no mês.

**Files:**
- Modify: `src/screens/Publicadores.tsx` (acrescentar o componente abaixo da função pura)
- Modify: `src/screens/Publicadores.test.tsx` (acrescentar os testes de render)

**Interfaces:**
- Consumes:
  - `listPublicadores(): Promise<Publicador[]>`, `criarPublicador({ nome, telefone? }): Promise<Publicador>`, `excluirPublicador(id: string): Promise<void>` de `../lib/publicadores`
  - `listTerritorios(): Promise<Territorio[]>` de `../lib/territorios`
  - `listSaidas(de: string, ate: string): Promise<Saida[]>`, `iso(m: Mes, dia: number): string`, `diaDaSemana(data: string): number`, `DIA_SEMANA`, `MES_NOME` de `../lib/saidas`
  - `saidasPorDirigente` da Task 2
- Produces: `Publicadores` — componente default-less, export nomeado, usado pela rota `/publicadores` na Task 4.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao topo de `src/screens/Publicadores.test.tsx` (acima do `describe` existente) os mocks, e um novo `describe` no fim do arquivo:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { Publicadores } from "./Publicadores";

vi.mock("../lib/publicadores", () => ({
  listPublicadores: vi.fn().mockResolvedValue([
    { id: "p1", nome: "Kleber Souza", telefone: "11988771234", created_at: "" },
    { id: "p2", nome: "Ana Ribeiro", telefone: null, created_at: "" },
  ]),
  criarPublicador: vi.fn(),
  excluirPublicador: vi.fn(),
}));
vi.mock("../lib/territorios", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    listTerritorios: vi.fn().mockResolvedValue([
      { id: "t1", numero: "6", nome: null, limites: null, ativo: true, created_at: "" },
      { id: "t2", numero: "12", nome: null, limites: null, ativo: true, created_at: "" },
    ]),
  };
});
vi.mock("../lib/saidas", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    listSaidas: vi.fn().mockResolvedValue([
      {
        id: "s1",
        data: "2026-07-05",
        periodo: "manha",
        local: "Salão",
        publicador_id: "p1",
        observacao: null,
        created_at: "",
        territorio_ids: ["t1", "t2"],
      },
    ]),
  };
});
```

E, no fim do arquivo:

```tsx
describe("Publicadores", () => {
  it("mostra as saídas que o publicador dirige no mês", async () => {
    render(
      <MemoryRouter>
        <Publicadores />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByText("Kleber Souza")).toBeInTheDocument(),
    );
    expect(screen.getByText(/domingo, 05\/07/)).toBeInTheDocument();
    expect(screen.getByText("manhã")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("diz quando o publicador não dirige nada no mês", async () => {
    render(
      <MemoryRouter>
        <Publicadores />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Ana Ribeiro")).toBeInTheDocument());
    expect(screen.getByText("Sem saídas neste mês")).toBeInTheDocument();
  });
});
```

Nota: `listSaidas` é chamada com o mês corrente do relógio real, mas está mockada e ignora os argumentos — o teste não depende da data de hoje. Os textos das saídas vêm do mock, cujo `data` é fixo.

- [ ] **Step 2: Rodar os testes e ver falhar**

Run: `npx vitest run src/screens/Publicadores.test.tsx`
Expected: FAIL — `Publicadores` não é exportado de `./Publicadores`.

- [ ] **Step 3: Implementar a tela**

Substituir o conteúdo de `src/screens/Publicadores.tsx` por (a função pura da Task 2 continua igual, no topo):

```tsx
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { listPublicadores, criarPublicador, excluirPublicador } from "../lib/publicadores";
import { listTerritorios } from "../lib/territorios";
import { listSaidas, iso, diaDaSemana, DIA_SEMANA, MES_NOME } from "../lib/saidas";
import type { Publicador, Saida, Territorio } from "../lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function saidasPorDirigente(saidas: Saida[]): Map<string, Saida[]> {
  // …a implementação da Task 2, inalterada
}

function formatTelefone(tel: string) {
  const d = tel.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

function diaCurto(data: string) {
  const [, mes, dia] = data.split("-");
  return `${DIA_SEMANA[diaDaSemana(data)]}, ${dia}/${mes}`;
}

export function Publicadores() {
  const [publicadores, setPublicadores] = useState<Publicador[]>([]);
  const [territorios, setTerritorios] = useState<Territorio[]>([]);
  const [saidas, setSaidas] = useState<Saida[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoTel, setNovoTel] = useState("");
  const [carregando, setCarregando] = useState(true);

  const hoje = new Date();
  const mes = { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };

  async function carregar() {
    const [p, t, s] = await Promise.all([
      listPublicadores(),
      listTerritorios(),
      listSaidas(iso(mes, 1), iso({ ...mes, mes: mes.mes + 1 }, 0)),
    ]);
    setPublicadores(p);
    setTerritorios(t);
    setSaidas(s);
  }
  useEffect(() => {
    carregar().finally(() => setCarregando(false));
  }, []);

  const grupos = useMemo(() => saidasPorDirigente(saidas), [saidas]);
  const numeroDe = useMemo(
    () => new Map(territorios.map((t) => [t.id, t.numero])),
    [territorios],
  );

  async function adicionar() {
    if (!novoNome) return;
    await criarPublicador({ nome: novoNome, telefone: novoTel || undefined });
    setNovoNome("");
    setNovoTel("");
    carregar();
  }

  async function excluir(p: Publicador) {
    try {
      await excluirPublicador(p.id);
      toast.success(`Publicador ${p.nome} excluído.`);
      carregar();
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        toast.error(
          "Não é possível excluir: este publicador tem histórico de designações ou saídas no calendário.",
        );
      } else {
        toast.error("Não foi possível excluir o publicador. Tente novamente.");
      }
    }
  }

  return (
    <div className="mx-auto grid max-w-220 gap-[clamp(20px,4vw,32px)] px-[clamp(14px,4vw,32px)] pt-[clamp(16px,4vw,40px)] pb-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
        <h2 className="text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">
          Publicadores
        </h2>
        <p className="text-[0.9rem] text-ink-soft">
          {MES_NOME[mes.mes - 1]}{" "}
          <span className="tabular-nums text-ink-faint">{mes.ano}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="flex-1 basis-40"
          placeholder="Nome*"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
        />
        <Input
          className="flex-1 basis-40"
          placeholder="Telefone"
          value={novoTel}
          onChange={(e) => setNovoTel(e.target.value)}
        />
        <Button onClick={adicionar} disabled={!novoNome}>
          Adicionar
        </Button>
      </div>

      {carregando ? (
        <ul role="status" aria-label="Carregando publicadores" className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="grid gap-2 rounded-xl border border-line bg-white px-4 py-3.5 shadow-card">
              <div className="h-4 w-40 animate-pulse rounded bg-mist" />
              <div className="h-3 w-56 animate-pulse rounded bg-mist" />
            </li>
          ))}
        </ul>
      ) : publicadores.length === 0 ? (
        <p className="py-1 text-[0.88rem] text-ink-soft">
          Nenhum publicador cadastrado. Comece adicionando o primeiro.
        </p>
      ) : (
        <ul className="grid gap-3">
          {publicadores.map((p) => {
            const dele = grupos.get(p.id) ?? [];
            return (
              <li
                key={p.id}
                className="grid gap-3 rounded-xl border border-line bg-white px-4 py-3.5 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-ink">{p.nome}</span>
                  {p.telefone && (
                    <span className="font-mono text-[0.8rem] tabular-nums text-ink-soft">
                      {formatTelefone(p.telefone)}
                    </span>
                  )}
                  <span className="flex-1" />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Excluir ${p.nome}`}
                        className="grid size-6 flex-none place-items-center rounded-full text-ink-faint transition-colors hover:bg-danger/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir o publicador {p.nome}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={() => excluir(p)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {dele.length === 0 ? (
                  <p className="border-t border-line pt-3 text-[0.82rem] text-ink-faint">
                    Sem saídas neste mês
                  </p>
                ) : (
                  <ul className="grid gap-1.5 border-t border-line pt-3">
                    {dele.map((s) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.85rem]"
                      >
                        <span className="text-ink">{diaCurto(s.data)}</span>
                        <span className="text-ink-faint">·</span>
                        <span className="text-ink-soft">
                          {s.periodo === "manha" ? "manhã" : "tarde"}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {s.territorio_ids.map((tid) => (
                            <span
                              key={tid}
                              className="rounded-full bg-jwblue-wash px-2 py-0.5 font-mono text-[0.76rem] tabular-nums text-jwblue-deep"
                            >
                              {numeroDe.get(tid) ?? "?"}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `npx vitest run src/screens/Publicadores.test.tsx`
Expected: PASS — 5 testes (3 da função pura + 2 da tela).

- [ ] **Step 5: Typecheck e suíte completa**

Run: `npm run build && npm run test`
Expected: build sem erros; todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Publicadores.tsx src/screens/Publicadores.test.tsx
git commit -m "feat: Tela de publicadores com as saídas do mês"
```

---

### Task 4: Rota e quarta aba na shell

**Files:**
- Modify: `src/App.tsx` (acrescentar a rota dentro do `<Route element={<AppShell />}>`)
- Modify: `src/components/AppShell.tsx` (acrescentar a entrada em `AREAS`)

**Interfaces:**
- Consumes: `Publicadores` da Task 3.

- [ ] **Step 1: Registrar a rota**

Em `src/App.tsx`, importar `import { Publicadores } from "./screens/Publicadores";` e acrescentar dentro do grupo da shell, depois de `/calendario`:

```tsx
<Route path="/publicadores" element={<Publicadores />} />
```

- [ ] **Step 2: Acrescentar a aba**

Em `src/components/AppShell.tsx`, importar `Users` de `lucide-react` (junto de `CalendarDays`, `LogOut`, `Map`) e acrescentar a quarta entrada ao fim de `AREAS`:

```tsx
{ to: "/publicadores", rotulo: "Publicadores", Icone: Users },
```

Nada mais muda: os itens da barra inferior são `flex-1` e as abas do desktop são um `flex`, então quatro entradas acomodam sem ajuste de layout.

- [ ] **Step 3: Typecheck e testes**

Run: `npm run build && npm run test`
Expected: build sem erros; todos os testes passando.

- [ ] **Step 4: Verificar no navegador**

Run: `npm run dev` e abrir `http://localhost:3000/publicadores`.
Expected: a aba "Publicadores" aparece ativa (quarta posição) no cabeçalho em ≥768px e na barra inferior em <768px; a lista mostra os publicadores com as saídas do mês corrente.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/AppShell.tsx
git commit -m "feat: Publicadores como quarta área da navegação"
```

---

### Task 5: Limpeza da Gestão e da lib

A Gestão fica só com os territórios. `contagemPorPublicador()` some da lib por ficar sem uso.

**Files:**
- Modify: `src/screens/Gestao.tsx` (remover a seção "Publicadores", o estado e as chamadas)
- Modify: `src/screens/Gestao.test.tsx:21-26` (tirar `contagemPorPublicador` do mock)
- Modify: `src/lib/designacoes.ts:12-24` (remover a função)

**Interfaces:**
- A Gestão **continua** usando `listPublicadores()` — precisa do nome do publicador na designação aberta (`nomePub`). Só `criarPublicador`, `excluirPublicador` e `contagemPorPublicador` saem.

- [ ] **Step 1: Remover a seção de publicadores da Gestão**

Em `src/screens/Gestao.tsx`:
- Apagar a `<section>` inteira que começa com o `<h2>` "Publicadores" (a segunda `<section>`, até o fim do JSX).
- Apagar o estado `novoNome`, `novoTel`, `contagemPub` e a função `addPublicador`.
- Apagar `excluirPub`.
- Em `carregar()`, tirar `contagemPorPublicador()` do `Promise.all` e o `setContagemPub`.
- Nos imports: tirar `criarPublicador` e `excluirPublicador` (fica `listPublicadores`), tirar `contagemPorPublicador`, tirar `Input`, tirar `X` de `lucide-react` (fica `MapPin`), e tirar `formatTelefone`.
- Manter `AlertDialog` e o `toast`: ainda são usados na exclusão de território.

- [ ] **Step 2: Remover `contagemPorPublicador` da lib**

Apagar a função inteira de `src/lib/designacoes.ts` (linhas 12-24, entre `designacoesAbertas` e `designar`).

- [ ] **Step 3: Ajustar o mock do teste da Gestão**

Em `src/screens/Gestao.test.tsx`, remover a linha `contagemPorPublicador: vi.fn().mockResolvedValue({}),` do `vi.mock("../lib/designacoes", …)`.

- [ ] **Step 4: Typecheck, lint e testes**

Run: `npm run build && npm run lint && npm run test`
Expected: build sem erros; lint sem novos avisos de import não usado (`AlertDialog`, `toast`, `MapPin` seguem em uso); todos os testes passando, incluindo `Gestao > lista o território cadastrado`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Gestao.tsx src/screens/Gestao.test.tsx src/lib/designacoes.ts
git commit -m "refactor: Gestão fica só com os territórios"
```

---

## Verificação final

- [ ] `npm run build && npm run lint && npm run test` — tudo limpo.
- [ ] `npm run dev`: navegar entre as quatro áreas pela shell; adicionar um publicador; conferir que quem dirige uma saída no mês mostra data, período e os números dos territórios, e que quem não dirige mostra "Sem saídas neste mês".
- [ ] Gestão não tem mais nenhum vestígio de publicadores além do nome na designação aberta.
