# polygon — Página de Publicadores

**Data:** 2026-07-12
**Status:** aprovado no brainstorming, pré-implementação

## Problema

A tela de Gestão (`/`) acumula duas listas: territórios e publicadores. Os publicadores
aparecem como "chips" (nome, telefone, contador de territórios designados) no rodapé da
tela, espremidos abaixo do conteúdo principal. Além de poluir a Gestão, o formato não
responde à pergunta que o servo de territórios realmente faz sobre um publicador:
**o que ele vai dirigir neste mês?**

Decisões do brainstorming:
- Publicadores vira uma **área de primeiro nível**, quarta aba da shell.
- A informação útil por publicador é a **agenda do mês** (saídas que ele dirige), não a
  custódia de territórios (`designacao`).
- Mês corrente **fixo**: para outros meses existe o Calendário.

## Design

### 1. Rota e navegação

- Nova rota `/publicadores`, dentro do `AppShell` (`src/components/AppShell.tsx`).
- Entra em `AREAS` como quarta entrada, depois de Calendário, com o ícone `Users`
  (lucide). No desktop é a quarta aba do cabeçalho; no celular, o quarto item da barra
  inferior — os itens são `flex-1`, então acomodam quatro sem mudança de layout.

### 2. A tela `src/screens/Publicadores.tsx`

- **Cabeçalho:** título "Publicadores" (tipografia utilitária das seções: uppercase,
  tracking) e o mês corrente por extenso à direita ("julho 2026"). Sem setas de
  navegação de mês.
- **Adicionar:** o formulário atual da Gestão (Input nome\* + Input telefone + botão
  "Adicionar"), movido sem alteração de comportamento (`criarPublicador`).
- **Lista:** um cartão por publicador — nome e telefone no topo; abaixo, uma linha por
  saída que ele dirige no mês: dia da semana + data curta (`dom 05/07`), período
  (manhã/tarde) e os **números** dos territórios daquela saída. Publicador sem saídas no
  mês mostra "Sem saídas neste mês" em `ink-soft`.
- **Excluir:** botão "✕" em todos os publicadores, com `AlertDialog` de confirmação. A
  trava é do banco: `excluirPublicador` recebe `23503` quando há histórico de designação
  ou saída, e a UI mostra o toast que já existe ("Não é possível excluir: este publicador
  tem histórico de designações ou saídas no calendário."). O contador de territórios
  designados, que hoje serve de trava visual no chip, deixa de existir.

### 3. Dados

Nenhuma consulta nova e nenhuma mudança de schema. A tela carrega em paralelo:

- `listPublicadores()`
- `listTerritorios()` — só para traduzir `territorio_id` → número
- `listSaidas(iso(mes, 1), iso(mes, últimoDia))` — a `saida` já traz `publicador_id`
  (o dirigente) e `territorio_ids`

O agrupamento das saídas por dirigente é uma **função pura** exportada da tela,
`saidasPorDirigente(saidas)`, com teste unitário próprio (sem rede).

A constante `MES_NOME`, hoje local do `Calendario.tsx`, passa para `src/lib/saidas.ts`
— é o vocabulário do calendário, e as duas telas agora precisam dele.

### 4. Limpeza na Gestão

`src/screens/Gestao.tsx` perde a seção "Publicadores" inteira: estado
(`publicadores`, `novoNome`, `novoTel`, `contagemPub`), as chamadas
`listPublicadores` / `criarPublicador` / `excluirPublicador` / `contagemPorPublicador`, e
o markup dos chips. Continua usando `listPublicadores` apenas para mostrar o **nome** do
publicador na designação aberta de cada território.

`contagemPorPublicador()` em `src/lib/designacoes.ts` fica sem uso e é removida junto com
seu teste, se houver.

## Fora de escopo

- Designar e devolver território seguem só na tela de Territórios.
- Editar publicador (nome/telefone) — não existe hoje, não entra agora.
- Meses anteriores/futuros na página de publicadores.
- Nenhuma mudança de schema, RLS ou migração.
