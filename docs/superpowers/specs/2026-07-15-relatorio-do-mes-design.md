# Relatório do mês — design

## Problema

A Gestão mostra o progresso de cada território (`5/8 quadras`, `em andamento`), mas
sempre no **estado atual** e **por território**. Falta uma visão **agregada por
tempo**: quanto de campo andou num mês e o que fechou. E, no fim do mês, o servo de
território precisa de uma folha do que foi feito — algo que dê para **imprimir ou
salvar como PDF**.

## Escopo

Uma página nova, `Relatório`, que:

1. Mostra na tela o **panorama de um mês** (navegável mês a mês).
2. Gera a **folha imprimível** do mesmo mês (via imprimir do navegador → PDF).

**Conteúdo do relatório:** quadras feitas por território no mês + territórios
concluídos no mês. **Fora de escopo** (deliberadamente): saídas do mês, designações e
devoluções. O foco é o avanço físico do trabalho de campo, que é justamente o que o
app deriva de `quadra_feita`.

Sem coluna nova, sem migração: tudo é derivado das marcas que já existem.

## Camada de dados — `relatorioDoMes()` (função pura)

Nova função pura em `src/lib/quadras.ts`, ao lado de `progressoDe`. Reusa `Marca`
(que já carrega `data`, `local`, `publicador_id` da saída) e `mesmoMes` de
`saidas.ts`.

```ts
interface LinhaRelatorio {
  territorio: Territorio;
  feitasNoMes: number;   // quadras distintas marcadas no mês (só as que ainda existem)
  total: number;         // quadras do território
  concluidoNoMes: boolean;
}

interface RelatorioMes {
  linhas: LinhaRelatorio[];      // só territórios com avanço no mês, ordenados por número
  totalQuadrasNoMes: number;     // soma de feitasNoMes
  totalConcluidos: number;       // quantas linhas com concluidoNoMes
}

relatorioDoMes(m: Mes, territorios: Territorio[], marcas: Marca[]): RelatorioMes
```

### Regras de derivação

- **feitasNoMes:** marcas do território com `mesmoMes(marca.data, m)`, distintas por
  `quadra_id`, filtradas às quadras que **ainda existem** em `limites`. Marca órfã
  (quadra apagada do desenho) não conta — mesma regra de domínio de `quadrasFeitasDe`.
- **concluidoNoMes:** todas as quadras da **rodada atual** estão feitas
  (`quadrasFeitasDe(t, marcas).size === total` e `total > 0`) **e** a data máxima das
  marcas da rodada (`marcasDaRodada(t, marcas)`) cai no mês M. Ou seja: o território
  fechou dentro daquele mês. Um território que fechou em outro mês, ou cuja rodada
  atual começou depois de M, não conta.
- **linhas:** só territórios com `feitasNoMes > 0` **ou** `concluidoNoMes`, ordenados
  por `numero` (mesma ordem da Gestão / `listTerritorios`).

## Tela `Relatorio` + rota + navegação

- Arquivo `src/screens/Relatorio.tsx`.
- Rota `/relatorio` dentro do `AppShell` (junto de `/`, `/mapa`, `/calendario`,
  `/publicadores`).
- 5º item na navegação (topo e barra inferior mobile): rótulo **"Relatório"**, ícone
  `FileText` (lucide). A barra inferior comporta 5 itens.
- Carrega `listTerritorios()` + `listMarcas()` uma vez, com o mesmo padrão de
  `carregando`/skeleton da Gestão.
- **Seletor de mês** ‹ Julho 2026 › usando `mesVizinho` e `MES_NOME` de `saidas.ts`.
  Começa no mês atual.
- **Panorama na tela:** três totais (quadras feitas no mês · territórios trabalhados ·
  concluídos) e a lista por território com `TerritorioGlyph`, `feitasNoMes/total` e um
  selo "Concluído" (mesmo estilo de selo da Gestão) nas linhas concluídas no mês.
- **Estado vazio:** mês sem avanço mostra uma linha discreta ("Nenhum trabalho
  registrado neste mês.").
- **Botão "Imprimir"** com classe `nao-imprime` → `window.print()`.

## Folha imprimível

Mesma página — **sem rota separada**. Um cabeçalho de impressão ("Relatório de campo
— Julho 2026") e a lista de territórios com as quadras feitas, com os concluídos
destacados. Regras `@media print` escondem o que tem `nao-imprime` (header e navs já
usam essa classe) e ajustam a folha para papel. Tela e papel saem da **mesma**
`RelatorioMes` — uma verdade só, nada duplicado.

## Testes

`relatorioDoMes` ganha testes unitários (Vitest, no padrão de
`src/lib/territorios.test.ts`):

- mês sem marcas → `linhas` vazia, totais zero;
- marca órfã (quadra fora de `limites`) é ignorada em `feitasNoMes`;
- a mesma quadra marcada em duas saídas do mês conta **uma vez** (distinção por
  `quadra_id`);
- território que fechou **dentro** do mês → `concluidoNoMes = true`;
- território 100% mas cuja última marca da rodada caiu em **outro** mês →
  `concluidoNoMes = false`;
- ordenação por `numero`.

## Fora de escopo

Saídas do mês, designações/devoluções, exportação em outros formatos além de
imprimir/PDF, escolha de intervalo arbitrário (só mês a mês). Nenhum desses entra sem
uma nova passada de design.
