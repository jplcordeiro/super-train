# polygon — Navegação persistente (AppShell)

**Data:** 2026-07-12
**Status:** aprovado no brainstorming, pré-implementação

## Problema

A navegação atual é "hub-and-spoke": a tela de Gestão (`/`) concentra três botões
("Calendário de saídas", "Mapa da congregação", "Cadastrar território") no cabeçalho
da seção Territórios, e as demais telas só têm um link "Voltar". Os botões de
navegação se disfarçam de ações e poluem a hierarquia da tela principal; trocar de
área (ex.: Calendário → Mapa) exige passar pela home.

Decisões do brainstorming:
- O incômodo principal é a **poluição visual** (nav disfarçada de ação no meio do conteúdo).
- O usuário quer **navegação persistente** entre as três áreas, não apenas realocar os botões.
- Formato escolhido: **adaptativo** — barra inferior no celular, abas no cabeçalho no desktop.

## Design

### 1. Rota de layout `AppShell`

Novo componente `src/components/AppShell.tsx`, usado como rota de layout no
`App.tsx` (com `<Outlet>`), envolvendo:

- `/` — Territórios (Gestao)
- `/mapa` — Mapa
- `/calendario` — Calendário

**Fora da shell** (telas de tarefa/imersivas, mantêm o "Voltar" atual):
- `/cadastro` e `/cadastro/:id`
- `/campo/:id`

### 2. A shell

- **Cabeçalho no topo (todas as larguras):** faixa fina com a marca (glifo hexagonal +
  "polygon") e o botão "Sair" (`supabase.auth.signOut()`), que sai do `Gestao` e passa a
  valer para todas as áreas. No desktop (≥768px), as três abas de navegação ficam nesse
  cabeçalho, com estado ativo via `NavLink` em jwblue.
- **Barra inferior (só mobile, <768px):** fixa, com 3 itens (ícone + rótulo):
  Territórios (hexágono do selo), Mapa, Calendário. Padding de safe-area
  (`env(safe-area-inset-bottom)`) para o PWA instalado. O conteúdo recebe padding
  inferior para não ficar encoberto pela barra.
- Mesmo componente, visibilidade por classes responsivas do Tailwind
  (`hidden md:flex` / `md:hidden`).

### 3. Limpeza nas telas

- **Gestao:** perde o cabeçalho próprio (marca + Sair) e os botões "Calendário de
  saídas" e "Mapa da congregação". **"Cadastrar território" permanece** — é ação, não
  navegação — sozinho no topo da lista de territórios.
- **Mapa:** perde o `BotaoVoltar` flutuante; o mapa preenche a altura restante sob o
  cabeçalho (shell em coluna flex, conteúdo `flex-1`).
- **Calendario:** perde o link "Voltar".
- **Campo** e **Cadastro:** sem mudança.

### 4. Identidade visual

- Item ativo na barra inferior: glifo preenchido em jwblue; inativo em `ink-soft`.
- Rótulos na tipografia utilitária já usada nos títulos de seção (uppercase, tracking).
- Barra branca, borda superior `line`, sem sombras pesadas — quieta, coerente com o
  restante do app.

## Fora de escopo

- Sem mudança de dados, schema ou camada `src/lib/`.
- Sem testes novos: é roteamento + apresentação; os testes existentes são da camada de lib.
- Campo e Cadastro ficam exatamente como estão.
