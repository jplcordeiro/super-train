# Territórios existentes como referência ao cadastrar

## Problema

Ao abrir a tela de cadastro para desenhar um território novo, o mapa vem vazio:
não há sinal de quais territórios já estão cadastrados. Sem essa referência é
fácil desenhar por cima de um vizinho ou deixar buracos entre eles.

## Escopo

Mostrar os territórios já cadastrados como pano de fundo **apenas na tela
`Cadastro`, no modo de criação** (rota sem `id`). O modo de edição não muda.

Fora de escopo: territórios de referência clicáveis, mudança de enquadramento,
qualquer alteração no modo edição.

## Design

### Componente novo — `src/map/TerritoriosReferencia.tsx`

Camada não-interativa, só visual. Recebe `territorios: Territorio[]` e monta
duas fontes:

- **Contorno.** Uma `FeatureCollection` com as quadras de todos os territórios
  (via `featureCollectionDe`), renderizada como uma `line` fina e apagada, sem
  `fill` — não escurece o mapa nem compete com o desenho em andamento. Tom
  cinza/azulado discreto.
- **Número.** Um ponto por território, no centro do seu *bounds* (reaproveitando
  `boundsDeTerritorios` chamado por território), com um `symbol` cujo
  `text-field` é o `numero`, em tom suave.

Sem handlers de clique: os cliques passam direto para o `DrawControl`, então a
referência não atrapalha o desenho. Não se reaproveita o `TerritorioPolygon` de
propósito — ele registra clique, popup e usa ids fixos (`territorio`) que
colidiriam com a fonte/camadas do desenho.

### Mudança em `src/screens/Cadastro.tsx`

- No ramo de criação do efeito de inicialização (hoje só geolocalização), buscar
  também `listTerritorios()` e guardar num estado `referencia: Territorio[]`.
- Renderizar `<TerritoriosReferencia territorios={referencia} />` dentro do
  `BaseMap`, junto do `DrawControl`.
- O enquadramento permanece como hoje (centra no GPS do aparelho, zoom 16). Como
  o desenho é feito perto de onde a pessoa está, os territórios vizinhos
  aparecem naturalmente.

## Notas de implementação

- A referência só é montada quando não há `id` (criação).
- Se a busca de territórios falhar, o cadastro continua funcionando sem a
  referência — a falha não bloqueia desenhar.
