# Ponto de parada ("paramos aqui")

**Data:** 2026-07-15
**Status:** aprovado (design)

## Problema

O grupo nem sempre completa uma quadra inteira numa saída — às vezes deixa
pela metade ou para logo no começo de uma. Hoje a marcação é **tudo ou nada**
(`quadra_feita` existe = quadra inteira feita), então uma quadra pela metade
fica indistinguível de uma que ninguém tocou: aparece como "falta". A próxima
saída não tem como saber que ali houve trabalho, nem por onde continuar.

## Objetivo

Registrar **onde o grupo parou** numa quadra, para a próxima saída continuar
dali. O uso central é navegação em campo ("não me perco no território"): um
pino de "comece por aqui".

## Conceito

Cada quadra passa a ter **três** estados derivados dentro de uma rodada,
mutuamente exclusivos:

- **feita** — tem `quadra_feita` na rodada (verde, como hoje).
- **em andamento** — tem um *ponto de parada* na rodada (cor âmbar, nova).
- **falta** — nenhum dos dois.

O **ponto de parada** é **um pino mutável por quadra**: uma coordenada
(`lng`, `lat`) que diz "continue por aqui". Ele não guarda histórico — a
próxima saída ou **move** o pino (parou mais adiante) ou **marca a quadra como
feita** (e o pino some). Sempre existe no máximo um "comece por aqui" por
quadra.

Decisões de produto que moldam isto (todas confirmadas com o servo de
territórios):

- Precisão desejada = **o ponto onde parou** (não "lado da quadra", nem
  percentual, nem texto livre).
- Ciclo de vida = **um ponto atual por quadra** (sobrescrito), não um
  histórico por saída.
- Aparece em: **tela de marcar**, **Campo** (mapa ao vivo), **cor própria da
  quadra em todos os mapas** e **contagem na Gestão**.

## Schema — nova migration `supabase/migrations/0004_ponto_parada.sql`

```sql
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

Notas:

- **`primary key (territorio_id, quadra_id)`** garante *um pino por quadra*.
  Colocar/mover o pino é um **upsert** nessa chave.
- **`saida_id`** registra qual saída deixou o pino. Data, local e dirigente do
  pino são **derivados dessa saída** (nunca copiados), exatamente como
  `Marca` faz hoje em `listMarcas`.
- **FK composta `(saida_id, territorio_id)` → `saida_territorio`**, igual à de
  `quadra_feita`: só se coloca pino num território que está naquela saída, e o
  `on delete cascade` limpa o pino sozinho quando a saída é apagada ou o
  território sai dela.
- Como as outras tabelas: aplicada à mão no Supabase SQL Editor e commitada
  aqui (o MCP é read-only).

### Regra da rodada

Um pino só conta como "em andamento" se a **data da sua saída ≥
`territorio.progresso_desde`** — a mesma linha de corte que já filtra as marcas
(`marcasDaRodada`). Começar uma nova rodada (`iniciarNovaRodada` seta
`progresso_desde = hoje`) **não apaga** pinos; a derivação simplesmente ignora
os de saídas anteriores. É simétrico ao comportamento das marcas, que nunca são
apagadas ao zerar.

### Exclusão mútua feita × em andamento

Uma quadra nunca deve ser as duas coisas. Regras:

- Ao **marcar feita**, a tela também chama `limparParada` (remove o pino, se
  houver).
- Ao **colocar/mover um pino** numa quadra que estava feita **na mesma saída**,
  a tela também chama `desmarcarQuadra` (a quadra deixa de ser feita e passa a
  "em andamento").
- Como defesa na derivação, `paradaAtualDe` **exclui quadras já feitas na
  rodada** — feita sempre vence na exibição, mesmo que um pino residual exista.

## Camada de dados (`src/lib/quadras.ts`)

Novo tipo (data/local/publicador derivados da saída, como `Marca`):

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

Funções:

- `listParadas(): Promise<Parada[]>` — lê `ponto_parada` + `saida` e faz o
  join em memória para preencher `data/local/publicador_id`, no mesmo molde de
  `listMarcas`. Pinos cuja saída sumiu são descartados.
- `pararEm(saida_id, territorio_id, quadra_id, lng, lat): Promise<void>` —
  `upsert` na pk `(territorio_id, quadra_id)`, gravando também `saida_id`,
  `lng`, `lat`.
- `limparParada(territorio_id, quadra_id): Promise<void>` — delete pela pk.
- `paradasDaRodada(t, paradas)` — filtra por território e por
  `data >= progresso_desde` (espelha `marcasDaRodada`).
- `paradaAtualDe(t, marcas, paradas): Map<string, Parada>` — pinos da rodada
  cuja quadra **existe** em `limites` e **não está** em `quadrasFeitasDe`.
- `progressoDe(t, marcas, paradas)` ganha `emAndamento: number` no retorno
  (`feitas`/`total`/`concluido` inalterados). Assinatura passa a receber
  `paradas`; os chamadores (Gestão) passam a lista.

## Mapa (`src/map/TerritorioPolygon.tsx`)

- `EstadoQuadra` ganha `"andamento"`. Nova cor no `CORES`:
  `{ fill: "#8a6636", opacidade: 0.30 }` — **reusa o token `--color-ocre`**
  (`#8a6636`) que já existe na paleta jw (par de `sage`, usado por `feita`); lê
  como "atenção, incompleto". O `match` de `porEstado` inclui o novo estado.
- Fora do mapa reusam-se os utilitários Tailwind já existentes `ocre` /
  `ocre-wash` (selo, badge da Gestão). Nenhum token novo é criado.
- Nova prop opcional `paradas?: { quadraId: string; lng: number; lat: number }[]`
  → renderiza um `Marker` (pino) por ponto, na cor âmbar. No modo de edição, o
  `Marker` recebe `onClick` para **remover** o pino (tocar no pino o apaga).
- `onQuadraClick` passa a assinatura `(quadraId: string, lngLat: {lng, lat})` —
  o handler de clique já tem `e.lngLat` disponível; só repassa. Isso permite à
  tela de marcar largar o pino exatamente no ponto tocado.

## Tela de marcar (`src/screens/MarcarQuadras.tsx`)

- Estado local `modo: "feita" | "parada"`, com botão de alternância no cabeçalho:
  **`[✓ Feita] [📍 Paramos aqui]`**.
- Carrega e mantém também `paradas` (via `listParadas`), com atualização
  otimista como já é feito com as marcas.
- Modo **feita** (comportamento atual + limpeza do pino): toque na quadra
  alterna `quadra_feita`; ao **marcar** feita, chama `limparParada` para aquela
  quadra.
- Modo **paramos**: toque numa quadra faz `pararEm` no `lngLat` tocado e, se a
  quadra estava feita nesta saída, `desmarcarQuadra`. Tocar de novo dentro da
  mesma quadra **move** o pino (novo upsert). Tocar **no pino** (`Marker`
  `onClick`) o **remove** (`limparParada`).
- Quadra feita **em outro dia** (`deOutroDia`): bloqueia com o mesmo aviso já
  usado hoje ("Esta quadra já foi feita na saída de …"), tanto para marcar
  quanto para largar pino — não se sobrescreve o trabalho de outra saída.
- Estados do mapa: quadra com pino da rodada → `"andamento"`; quadra feita →
  `"feita"`/`"outra"` como hoje.
- Rodapé: a contagem continua "X de N quadras feitas nesta rodada"; a instrução
  muda conforme o modo ("Toque numa quadra para marcar o que foi feito" /
  "Toque no mapa para marcar onde o grupo parou").

## Campo (`src/screens/Campo.tsx`)

- Carrega também `paradas` (via `listParadas`).
- Calcula `paradaAtualDe`; pinta as quadras em andamento (`estados[...] =
  "andamento"`) e passa `paradas` ao `TerritorioPolygon` para exibir os pinos
  junto do "você está aqui". **Só leitura** (sem `onQuadraClick`, sem remover).

## Gestão (`src/screens/Gestao.tsx`)

- Carrega `paradas`; chama `progressoDe(t, marcas, paradas)`.
- Badge de progresso: quando `emAndamento > 0`, mostra
  **"5/8 quadras · 1 em andamento"** (o sufixo em âmbar). "Concluído" e o caso
  simples permanecem.
- `TerritorioGlyph` recebe também o conjunto de quadras em andamento e as pinta
  na cor âmbar, para o selo bater com os mapas.

## Fora de escopo

- Histórico de pontos de parada (foi decidido: um ponto atual por quadra).
- "Lado da quadra"/subdivisão da geometria, percentual, ou anotação em texto.
- Direção/sentido do trecho já feito — o pino é só "comece por aqui".

## Testes

Testes puros em `src/lib/quadras.test.ts` (Vitest), no espírito dos já
existentes:

- `paradaAtualDe`: retorna o pino de uma quadra; **exclui** quadra já feita;
  **exclui** pino de saída anterior a `progresso_desde`; **exclui** pino de
  quadra que não existe mais em `limites`.
- `progressoDe`: `emAndamento` conta só pinos da rodada de quadras não feitas;
  `feitas`/`total`/`concluido` seguem corretos com pinos presentes.
- `paradasDaRodada`: espelha o corte de `marcasDaRodada`.
```
