# Múltiplas quadras por território (e edição do limite) — Design

**Data:** 2026-07-11
**Status:** aprovado no brainstorming, pré-implementação

## Problema

Um território real nem sempre é uma área contínua: com frequência ele é um punhado de **quadras separadas**, sem encostar uma na outra. Hoje o app só guarda **um** `Polygon` por território — o `Cadastro` desenha um polígono e descarta qualquer outro (`e.features?.[0]`). Territórios assim não têm como ser representados fielmente.

Some-se a isso: o limite de um território é definido **uma única vez**, no cadastro. Não existe `atualizarTerritorio`. Se o desenho sai errado, ou se o território ganha/perde uma quadra, a única saída é excluir e recriar — e a exclusão é **bloqueada** pela FK assim que existe qualquer designação (erro `23503`). Ou seja: sem edição, os territórios que você já cadastrou ficariam presos na forma errada para sempre. Por isso o escopo aqui é **quadras múltiplas + edição do limite**, juntos.

## Escopo

**Dentro:**
- Desenhar **N quadras** para um território, no cadastro.
- **Editar** um território existente: acrescentar, remover e reajustar quadras; corrigir número e nome.
- Fazer o mapa, o selo (glyph) e o enquadramento lidarem com geometrias de N quadras.

**Fora (YAGNI):**
- Quadras **não têm identidade própria** — sem nome, sem id, sem contagem no domínio. Uma quadra não é uma entidade; é um pedaço do formato do território. Designação, devolução e navegação continuam operando sobre o território **inteiro**.
- Nenhuma mudança em designação, publicador ou nos status derivados.

## Modelo de dados

A coluna `territorio.limites` (`jsonb`) **não muda** — não há SQL para rodar, nenhuma migração.

O que muda é o que cabe dentro dela. GeoJSON já tem o tipo exato para o caso: `MultiPolygon` — uma geometria com várias áreas disjuntas.

```ts
limites: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
```

**Convivência com o que já existe, sem migração:** as linhas antigas continuam `Polygon` e seguem válidas; tudo que for salvo ou editado daqui pra frente sai `MultiPolygon`, mesmo quando tem uma quadra só. Uma função pura nova em `src/lib/territorios.ts` é o **único** ponto do código que conhece essa dualidade:

```ts
export function quadrasDe(limites: Territorio["limites"]): GeoJSON.Position[][][]
```

Ela devolve a lista de quadras (cada quadra = a lista de anéis dela), `[]` para `null`. Todo consumidor que hoje faz `limites.coordinates[0]` passa a chamá-la.

**Por que não normalizar tudo para `MultiPolygon` com um `UPDATE`:** a economia de código seria pequena (a função acima tem umas quatro linhas), e ela sairia cara — uma migração manual no SQL Editor mais um modo de falha **silencioso**: qualquer linha `Polygon` que sobrevivesse (esquecimento, restore de backup) seria lida com a forma errada e renderizaria lixo, sem erro. Tolerar as duas formas na leitura elimina essa classe de bug de uma vez.

## Camada de dados (`src/lib/territorios.ts`)

- `quadrasDe(limites)` — nova, pura, descrita acima.
- `criarTerritorio` — passa a aceitar `MultiPolygon` em `limites`.
- `atualizarTerritorio(id, { numero, nome, limites })` — **nova**: `update` na linha do território. O `unique(numero)` do banco já cobre a colisão de número na edição, e o tratamento de erro `duplicate` que o Cadastro já tem funciona sem mudanças.
- `boundsDeTerritorios` — passa a iterar **todas** as quadras (via `quadrasDe`) em vez de só o primeiro anel do primeiro polígono.

## Telas

### `Cadastro` — vira criar **e** editar

O `Cadastro` já é, na prática, um editor de polígono sobre o mapa: `BaseMap` + `MapboxDraw` + campos + salvar. A edição reaproveita esse componente em vez de duplicá-lo numa tela nova; o fluxo é o mesmo nos dois casos ("desenhe N quadras e salve"), e manter um único caminho de desenho é o que garante que as quadras se comportem igual na criação e na correção.

- Rota nova `/cadastro/:id`, ao lado de `/cadastro`.
- **Sem `id`:** o cadastro de hoje (pede GPS para enquadrar o mapa, insere).
- **Com `id`:** carrega o território, injeta as quadras existentes no `MapboxDraw` via `draw.set(...)`, pré-preenche número e nome, **enquadra o mapa nos limites do território** (não pede GPS), e o botão vira "Salvar alterações", chamando `atualizarTerritorio`.
- **`DrawControl`:** deixa de ler `e.features?.[0]` e passa a ler `draw.getAll()` a cada `draw.create` / `draw.update` / `draw.delete`, montando um `MultiPolygon` com **todas** as quadras desenhadas. A lixeira do próprio `MapboxDraw` é como se remove uma quadra — não há UI própria para isso.
- **Painel inferior:** o indicador deixa de ser booleano ("Limite desenhado") e vira contagem ("2 quadras desenhadas").
- **Validação:** salvar exige número **e** pelo menos uma quadra.
- Território **designado pode ser editado**. Geometria não é status; travar isso obrigaria a devolver um território só para corrigir um desenho errado.

### `Gestao`

Botão "Editar" no card do território (junto de Ativo / Excluir), levando a `/cadastro/:id`.

### `Campo`

`centro()` sai; o enquadramento passa a ser por **bounds** do território (o `BaseMap` já aceita `bounds` — é o que o `Mapa` usa). Motivo: a média dos vértices com zoom fixo 15 pode, com quadras espalhadas, abrir o mapa numa região vazia *entre* elas e deixar metade do território fora da tela. Bounds garante que todas as quadras entrem no enquadramento.

### `TerritorioGlyph`

Normaliza sobre o **bbox de todas** as quadras e desenha N subpaths num único `<path>` (`M…Z M…Z`). O placeholder tracejado (território sem limite) continua igual. Um selo de três quadras soltas é justamente o que torna esse território reconhecível na lista.

### Sem mudança

`TerritorioPolygon` e `TerritoriosLayer` **não mudam uma linha**: o Mapbox GL renderiza `MultiPolygon` nas mesmas camadas `fill` / `line` / `symbol`, sem distinção.

## Erros

Nada de novo. Os dois caminhos de falha já existem e são reaproveitados: número duplicado (`duplicate` → "Já existe um território com esse número") e falha genérica de rede/servidor (toast de "tente novamente"). Editar um território que foi excluído em outra aba cai no caminho genérico.

## Testes

- **`territorios.test.ts`:** `quadrasDe` com `Polygon`, `MultiPolygon` e `null`; `boundsDeTerritorios` cobrindo uma lista **mista** (linha antiga `Polygon` + linha nova `MultiPolygon`) — é o cenário que a decisão de "sem migração" cria e o que garante que ela não quebre.
- **`Cadastro.test.tsx`:** desenhar duas quadras salva um `MultiPolygon` com dois polígonos; apagar todas desabilita o salvar; o modo edição (`/cadastro/:id`) carrega as quadras existentes no draw e salva via `atualizarTerritorio`.
- **`Campo.test.tsx`:** o enquadramento por bounds cobre todas as quadras.
