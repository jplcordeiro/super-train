# Quadras feitas — progresso do território — Design

**Data:** 2026-07-13
**Status:** aprovado no grilling, pré-implementação

## Problema

O servo de territórios não sabe **quanto de um território já foi trabalhado**. Ele
sabe com quem o território está (designação) e quando o grupo saiu (calendário), mas
não sabe se, das oito quadras do território 6, já foram feitas três ou sete. Falta o
registro do que a saída de campo **cobriu**.

O objetivo é marcar, depois da saída, **quais quadras foram feitas**, e ver o
território enchendo até ficar completo.

## Reversão explícita de uma decisão anterior

O design `2026-07-11-multiplas-quadras-design.md` decidiu, em letras grandes:

> Quadras **não têm identidade própria** — sem nome, sem id, sem contagem no domínio.

Este design **desfaz isso**, e essa é sua mudança estrutural central. Marcar uma
quadra como feita exige apontar para *uma* quadra; hoje uma quadra é só a posição N
num array dentro do `jsonb`, e essa posição não é estável — apagar uma quadra do meio
no Cadastro desloca todas as seguintes e faria as marcas apontarem para a quadra
errada, **em silêncio**.

Há ainda um segundo motivo, vindo do mapa: num `MultiPolygon` o território inteiro é
**uma única feature** para o Mapbox. Um toque nele não sabe dizer *qual* quadra foi
tocada. Marcar no mapa exige uma feature por quadra, com id — que é exatamente a mesma
coisa que a identidade estável exige. As duas necessidades convergem numa só mudança.

## Escopo

**Dentro:**
- Cada quadra ganha um **id estável**, guardado junto da geometria.
- Marcar/desmarcar quadras feitas, **a partir de uma saída**, tocando no mapa.
- Progresso do território (`5/8`) na Gestão, no selo, no mapa e no painel da saída.
- **Rodada**: uma linha de corte manual (`Começar nova rodada`) que zera a contagem
  sem apagar nada.

**Fora (YAGNI):**
- Marcar quadras **fora de uma saída**. O usuário confirmou que a escala é o registro
  completo do trabalho de campo: todo trabalho acontece em grupo e toda saída em grupo
  está (ou pode ser) cadastrada no Calendário. Não existe, portanto, marca sem saída —
  e por isso a marca **não tem coluna de data**: a data é a da saída.
- Marcar quadras **no campo, ao vivo**. O servo marca *depois*, a partir do relato de
  quem saiu. O mapa continua sendo a tela, mas o gesto é de escritório, não de rua.
- Tela de "última vez que esta quadra foi trabalhada" (o dado passa a existir; a tela
  não).
- Nomear quadras, relatório de progresso por publicador, progresso por designação.

## Modelo de dados

### `territorio.limites` — de `MultiPolygon` para `FeatureCollection`

```ts
export interface Quadra {
  id: string;
  coordinates: GeoJSON.Position[][];
}

export type Limites =
  | GeoJSON.Polygon                        // linhas antigas (legado)
  | GeoJSON.MultiPolygon                   // linhas antigas (legado)
  | GeoJSON.FeatureCollection<GeoJSON.Polygon>;  // forma nova
```

A forma nova é uma `FeatureCollection` em que cada `Feature` é um `Polygon` com
`properties.id` — o id da quadra. Esse id é o **mesmo id que o `mapbox-gl-draw` já
atribui** a cada polígono desenhado; hoje o `multiPolygonDe()` o joga fora ao achatar
tudo num `MultiPolygon`. Passamos a preservá-lo: o `draw.set()` devolve o id na
edição, então a quadra mantém identidade através de reformas de vértice, adições e
remoções.

A migração converte as linhas existentes, gerando um `gen_random_uuid()` por quadra.
Mantemos, ainda assim, a **leitura tolerante** ao legado — a mesma disciplina do
design anterior: `quadrasDe()` aceita `Polygon` e `MultiPolygon` e, para eles, deriva
o id do índice (`"0"`, `"1"`, …). Uma linha antiga restaurada de backup renderiza
certo em vez de virar lixo silencioso; ela só não tem identidade forte, e será
promovida na primeira edição.

### `territorio.progresso_desde date` — a linha de corte da rodada

Nula = conta tudo. Zerar o progresso **não apaga marca nenhuma**: grava a data de hoje
nessa coluna, e marcas de saídas anteriores param de contar. O histórico continua no
banco, e é ele que um dia dará "esta quadra foi trabalhada pela última vez em…".

### `quadra_feita` — a marca

```sql
create table quadra_feita (
  saida_id      uuid not null,
  territorio_id uuid not null,
  quadra_id     text not null,
  created_at    timestamptz not null default now(),
  primary key (saida_id, territorio_id, quadra_id),
  foreign key (saida_id, territorio_id)
    references saida_territorio (saida_id, territorio_id) on delete cascade
);
```

A FK **composta** para `saida_territorio` (cuja PK é exatamente esse par) é o coração
do modelo: ela garante, no banco, que só se marca quadra de um território que **está
naquela saída**, e faz a limpeza sozinha — apagar a saída, ou tirar o território dela,
leva junto as marcas. Nenhum código de limpeza no app.

**Não há coluna de data** (é a da saída), **não há FK para `designacao`** (a marca é do
território, não da custódia) e **não há coluna `feita boolean`**: a linha existe = a
quadra foi feita. Desmarcar é `delete`.

Não existe FK de `quadra_id` para a geometria — ela mora num `jsonb`. Marca órfã
(quadra apagada do desenho) simplesmente **não conta**, filtrada na leitura.

## Progresso é derivado

No espírito do `statusTerritorio()`: nada é armazenado.

```ts
export function quadrasFeitasDe(t: Territorio, marcas: Marca[]): Set<string>;
export function progressoDe(t: Territorio, marcas: Marca[]): {
  feitas: number;
  total: number;
  concluido: boolean;   // total > 0 && feitas === total
};
```

Conta os `quadra_id` **distintos** com marca em saídas cuja `data >= progresso_desde`,
descartando ids que não existem mais no desenho. `Marca` carrega a `data` da saída,
trazida no `select` por join (`saida(data)`).

**Progresso não é status.** O `statusTerritorio()` continua devolvendo
`disponivel | designado | inativo`: um território pode estar 8/8 **e** designado ao
Kleber ao mesmo tempo. São dois eixos, exibidos lado a lado.

## Bug pré-existente que este design obriga a consertar

`atualizarSaida()` hoje **apaga todos os `saida_territorio` da saída e reinsere**. Com
o `on delete cascade`, editar o **dirigente** de uma saída destruiria todas as marcas
dela. O `atualizarSaida` passa a fazer **diff**: remove só os territórios que saíram,
insere só os que entraram, não toca nos que ficaram. É pré-requisito, não extra.

## Telas

### Marcar — `/saida/:saidaId/territorio/:territorioId`

Tela nova, de mapa cheio (reusa `BaseMap`), aberta a partir do painel do dia. Faixa no
topo: *"Marcando: domingo, 12/07 · Território 6"* — a data é a da saída, nunca "hoje".

Cada quadra é uma feature própria, pintada por estado:

| Estado | Cor | Toque |
|---|---|---|
| Feita **nesta** saída | verde cheio | desmarca |
| Feita em **outra** saída da rodada | verde apagado | não muda nada; toast *"já feita na saída de 12/07"* |
| A fazer | azul (o de hoje) | marca |

Cada saída só mexe no que ela própria marcou. Para corrigir domingo, abre-se a saída de
domingo — o lugar onde aquele fato mora. Isso protege o registro de um dia de ser
apagado por um toque distraído em outro.

### `Calendario` — painel do dia

Na lista de territórios de cada saída, cada território vira alvo de toque para a tela de
marcar, com o resumo *"3 de 8 quadras"* (marcadas **nesta** saída / total).

### `Gestao`

- `5/8 quadras` ao lado do status, no card.
- O **selo (`TerritorioGlyph`) preenchido**: ele já desenha cada quadra como um subpath.
  Passa a pintar as feitas de verde — o contorno vira gráfico de progresso, e a lista
  inteira se lê de relance. É a maior entrega visual do design, e sai quase de graça.
- Em 100%: o card mostra **Concluído** e o botão **Começar nova rodada**.
- **Devolver** um território 100% feito oferece começar a nova rodada no mesmo gesto
  ("Território concluído. Começar nova rodada?"). Nada zera sozinho: a decisão é sempre
  do usuário, e ele pode recusar.

### `Campo`

O mapa do território passa a colorir as quadras feitas da rodada corrente (verde) e as
que faltam (azul). Somente leitura — não se marca aqui.

### `Cadastro`

Ao salvar um território que tem quadras marcadas na rodada corrente, confirma antes:
*"Este território tem 5 quadras marcadas nesta rodada; a edição pode afetar o
progresso."* Marca órfã deixa de contar; quadra nova entra como a fazer (5/8 vira 5/9)
— o território ficou maior, falta mais.

## Erros

- Marcar/desmarcar falha (rede): toast de "tente novamente", e o estado da quadra volta
  ao que era. Marcação é otimista na UI.
- Violação da FK composta (23503) só acontece em corrida (o território foi tirado da
  saída em outra aba): trata como falha genérica e recarrega.

## Testes

- **`territorios.test.ts`:** `quadrasDe` com `FeatureCollection` (ids preservados),
  `MultiPolygon` e `Polygon` (ids por índice) e `null`; `progressoDe` cobrindo rodada
  com corte (`progresso_desde`), marca órfã (quadra apagada), quadra feita em duas
  saídas contando uma vez só, e território sem limites.
- **`saidas.test.ts`:** `atualizarSaida` faz diff — não apaga o vínculo de um território
  que continua na saída (é o que salva as marcas).
- **`MarcarQuadras.test.tsx`:** toque marca; toque de novo desmarca; toque em quadra de
  outra saída não altera nada e explica.
- **`Gestao.test.tsx`:** mostra `5/8`; em 100% mostra concluído e o botão de nova rodada;
  nova rodada zera a contagem sem apagar marcas.
