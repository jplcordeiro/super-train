# super-train — Design do MVP

**Data:** 2026-07-02
**Status:** aprovado no brainstorming, pré-implementação

## Objetivo

App para **uma congregação** (single-tenant) que ajuda o **dirigente de territórios** a:
1. **Localizar-se** dentro de um território no campo (dor principal do usuário — "sou ruim de mapa").
2. **Gerir designações**: registrar qual território está com qual irmão, saída e devolução.

Ambos os objetivos são parte do MVP.

## Usuários e acesso

- Apenas o **dirigente** faz login (Auth trivial, um usuário).
- **Publicadores** são um cadastro de nomes, **não** usuários do sistema.
- **RLS:** usuário autenticado tem acesso total; anônimo não acessa nada.

## Stack

- **Frontend:** React + Vite, **PWA mobile-first**.
  - Mapa: **Mapbox GL JS** via `react-map-gl`, com `mapbox-gl-draw` (desenho de polígono) e o controle de geolocalização (posição ao vivo).
  - PWA via `vite-plugin-pwa`.
- **Backend:** **Supabase** — Postgres + Auth + RLS. **Sem Storage, sem PostGIS.**
  - Cliente: `@supabase/supabase-js`.
- **Conectividade:** assume sinal decente (territórios urbanos). Tiles carregam online; sem offline de tiles no MVP. O GPS funciona offline (Geolocation API), mas o fundo do mapa depende de rede.

## Modelo de dados

Três tabelas.

### `territorio`
| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `numero` | text | **único, obrigatório** — identificador oficial |
| `nome` | text | opcional — rótulo de referência |
| `limites` | jsonb | polígono **GeoJSON** desenhado no Mapbox |
| `ativo` | bool | default `true` — `false` = "não designar por enquanto" |
| `created_at` | timestamptz | default `now()` |

### `publicador`
| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `nome` | text | **obrigatório** |
| `telefone` | text | opcional |
| `created_at` | timestamptz | default `now()` |

### `designacao`
| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid | PK |
| `territorio_id` | uuid | FK → `territorio.id`, obrigatório |
| `publicador_id` | uuid | FK → `publicador.id`, obrigatório |
| `data_saida` | date | **obrigatório**, default hoje |
| `data_devolucao` | date | nullable — vazio = designação **em aberto** |
| `created_at` | timestamptz | default `now()` |

### Regras de integridade
- **Índice único parcial:** no máximo **uma designação aberta por território**
  `create unique index on designacao (territorio_id) where data_devolucao is null;`
- Um irmão **pode** ter vários territórios ao mesmo tempo (sem restrição do lado do publicador).

### Estados derivados (sem coluna guardada)
- **Disponível** = `territorio.ativo = true` **e** sem `designacao` aberta.
- **Designado** = existe `designacao` aberta (→ com quem, desde `data_saida`).
- **Há quanto tempo não é trabalhado** = maior `data_devolucao` das designações do território.
- **Designação em aberto** = `data_devolucao IS NULL`.

## Telas

1. **Cadastro (desktop):** criar território — desenhar o polígono sobre o Mapbox (`mapbox-gl-draw`), definir `numero` e `nome`, salvar `limites` como GeoJSON. Marcar `ativo`.
2. **Gestão (desktop):** listar territórios com status (disponível / designado a quem / há quanto tempo não trabalhado); CRUD de publicadores; **designar** um território a um irmão e **registrar devolução**.
3. **Campo (celular):** abrir um território → renderizar o contorno + **posição GPS ao vivo** (controle de geolocalização do Mapbox).

## Pré-requisitos de setup (a fornecer)

- **Supabase:** personal access token (para o MCP configurar/gerir o schema); project ref/URL + `publishable key` (`sb_publishable_...`, antiga `anon key`) para o app.
- **Mapbox:** access token público (de preferência restrito por URL de origem).

## Fora do escopo (fases seguintes)

- Endereços/quadras individuais + lista de "não bater".
- Grupos de serviço e designação por grupo.
- Login de publicadores / uso do app por eles no campo.
- Offline real de tiles.
- `tipo` de território; `observacao` na designação.
- Supabase Storage (fotos/anexos).

## Referência visual

Diagrama editável em `docs/design/super-train.excalidraw` (abrir em excalidraw.com ou na extensão do VS Code).
