# Histórico de passagens no card do relatório

Data: 2026-07-20

## Problema

O relatório mensal mostra, por território, quantas quadras foram feitas no mês (`5 de 8 quadras`) e se a rodada fechou ali. Não mostra **de onde esse número veio**: em quais dias a congregação esteve naquele território e quanto cada dia rendeu. Quem lê o relatório — na tela ou impresso — não consegue reconstruir o mês.

## O que vamos construir

Dentro do card de cada território, na tela de relatório, uma lista das saídas daquele mês que marcaram quadras nesse território:

```
◇  12                             5 de 8 quadras
   Vila Nova                          [Concluído]
 ▾ 3 saídas neste mês
   05/07 · Salão · 2 quadras
   12/07 · Praça da Matriz · 1 quadra
   19/07 · Salão · 2 quadras
```

## Decisões

**Recorte: só o mês exibido.** A tela inteira já é "relatório de julho"; o histórico explica a linha que está ali, não a rodada inteira nem a vida do território. As passagens de meses anteriores aparecem ao navegar para aqueles meses.

**Eixo: por data, não por quadra.** O pedido original era "quando cada quadra foi feita", mas uma quadra não tem nome nem número — seu id é o opaco que o `mapbox-gl-draw` atribui. "A quadra `f3a9…` foi feita em 12/07" não é legível. O eixo invertido — o dia, e quantas quadras ele rendeu — carrega a mesma informação de forma utilizável. O histórico *por quadra* já existe e já funciona onde faz sentido: `historicoDaQuadra()` em `src/lib/quadras.ts`, exibido no mapa quando o dedo toca uma quadra específica (`MarcarQuadras`, `Campo`) — lá o "qual quadra" vem do próprio toque.

**Conteúdo da linha: data · local · nº de quadras.** O ponto de encontro é a informação principal do dia, como já é na escala. O dirigente fica de fora: alongaria a linha o bastante para quebrar em tela estreita, e quem dirigiu está no calendário.

**Contagem por saída, não deduplicada no mês.** Se a mesma quadra for marcada em duas saídas do mesmo mês, as linhas somam mais que o cabeçalho — o total do mês conta quadras *distintas*, cada passagem conta o que aquele dia marcou. É raro e é aceito. A alternativa (contar a quadra só na primeira saída do mês) produziria uma linha `0 quadras` para a segunda saída, o que descreve pior o que aconteceu.

## Arquitetura

Nenhuma consulta nova. `Relatorio` já carrega todas as `marcas` via `listMarcas()`, e `Marca` já traz `data` e `local` copiados da saída. O trabalho é agrupar o que já está em memória.

### 1. `passagensDoMes()` em `src/lib/quadras.ts`

Função pura, ao lado de `relatorioDoMes` e `fechamentosDe`:

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

- filtra `marcas` por `territorio_id === t.id` e `mesmoMes(marca.data, m)`;
- descarta marcas cuja `quadra_id` não existe mais em `quadrasDe(t.limites)` — a mesma regra que `relatorioDoMes` já aplica, para que uma quadra apagada do desenho pare de contar nos dois lugares;
- agrupa por `saida_id`, contando quadras distintas dentro da saída;
- ordena por `data` crescente (o mês lido de cima para baixo).

### 2. O card vira `<details>` em `src/screens/Relatorio.tsx`

O `<summary>` é a linha atual — glifo, número, nome, `N de M quadras`, badge "Concluído" — acrescida do contador de passagens (`3 saídas neste mês` / `1 saída neste mês`). O corpo é a lista de `PassagemMes`, uma linha por saída, com `dataBR(p.data)`, `p.local ?? "Sem ponto de encontro"` (o mesmo texto que `Calendario` já usa para local nulo) e `1 quadra` / `N quadras`.

`<details>` nativo entrega teclado e leitor de tela sem estado em React nem componente de acordeão.

Território cujo mês não tem passagens (aparece na lista só por `concluidoNoMes`, com o fechamento vindo de marca de outro mês) não ganha `<details>`: renderiza a linha simples de hoje, sem disclosure vazio.

### 3. Impressão

Regra em `src/index.css`, dentro do `@media print` existente, abrindo os `<details>` fechados — o papel sai completo independentemente do que estava expandido na tela.

## Testes

Em `src/lib/quadras.test.ts`, para `passagensDoMes`:

- agrupa marcas de saídas diferentes em linhas distintas, ordenadas por data;
- conta quadras distintas dentro da mesma saída;
- ignora marcas de outro mês e de outro território;
- ignora marca cuja quadra não existe mais no desenho;
- território sem marcas no mês devolve lista vazia.

Em `src/screens/Relatorio.test.tsx` (arquivo novo — a tela ainda não tem teste): o card lista as passagens do mês e o território sem passagens não renderiza disclosure.

## Fora de escopo

Dirigente na linha, histórico além do mês exibido, navegação da passagem para a saída no calendário, e qualquer mudança no eixo por quadra (que já existe no mapa).
