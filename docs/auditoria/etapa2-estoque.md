# Etapa 2 — Estoque calculado pelo servidor

Data: 18/10/2026 · Feita pelo Claude Code · Sobre a Etapa 1 (`etapa1-seguranca.md`)
Status: **testada localmente, ainda NÃO publicada no Fly.io** (publicar junto com a Etapa 1).

## Resultado dos testes

`resultado-depois-etapa2.json`: **108 aprovados, 0 falhas** (o script inteiro: segurança, telas e estoque).
Testado também com movimentações e compras **antigas** (criadas antes da mudança) e com dois
reinícios seguidos.

## Como o estoque funciona agora (para explicar a quem usa)

- **Quem calcula o saldo é o servidor**, não a tela. Todas as telas continuam iguais.
- O saldo muda quando a movimentação fica **Aprovada** (ou Finalizada). Pendente não mexe no saldo.
  - Somam: Entrada, Devolução, Retorno ao Almoxarifado, Devolução de Funcionário.
  - Subtraem: Saída, Consumo de Obra, Retirada por Funcionário, Perda.
  - Transferência: não muda o saldo.
  - **Inventário** e **Ajuste de Estoque**: a quantidade informada é **o que foi contado** — o saldo
    passa a ser esse número e a diferença fica registrada.
- **Saída maior que o saldo é recusada** com a mensagem "Saldo insuficiente: há X em estoque e a
  movimentação pede Y."
- **Movimentação aprovada não se edita nem se exclui.** Errou? **Cancela** (o servidor devolve o saldo)
  e registra outra. Tudo fica no histórico, com saldo anterior e posterior de cada lançamento.
- **Compra marcada como "Recebido"** lança a entrada de cada item no estoque automaticamente.
- O campo de saldo no cadastro do material **não altera mais o estoque** (as mudanças vão por
  movimentação). Ao cadastrar um material novo com saldo, o servidor registra uma Entrada "Saldo inicial".

## Movimentações e compras antigas

Na primeira vez que o servidor sobe com esta versão, tudo que já estava **Aprovado/Finalizado** é
marcado como histórico: não é lançado de novo, não pode ser editado, e cancelar não mexe no saldo
(não dá para saber se o jeito antigo descontou ou não). As **Pendentes** seguem normais e lançam no
saldo quando forem aprovadas. Compras já "Recebido" não lançam de novo.

**Recomendação depois de publicar:** fazer um **Inventário** (contagem) dos materiais principais. O
saldo atual pode estar errado por causa do jeito antigo (aprovações na tela Movimentações nunca
mexiam no saldo). Lançando a contagem como "Inventário", o saldo fica certo e o histórico registra a
diferença.

## Arquivos

| Arquivo | O quê |
|---|---|
| `pb_hooks/estoque-servidor.pb.js` (novo) | Campos de controle (`estoque_aplicado`, `quantidade_aplicada`, `saldo_anterior`, `saldo_posterior`, `compras.estoque_lancado`), transação em cada requisição de estoque, regras de lançamento/estorno/bloqueio, saldo inicial, entrada pela compra. |
| `pb_hooks/estoque-lib.js` (novo) | Cálculo do saldo (tipos que somam/subtraem, inventário, atualização atômica que nunca deixa negativo). |
| `pb_hooks/seguranca-etapa1.pb.js` | Mensagem de primeiro boot virou "Aviso" em vez de "Erro". |

Lições técnicas:
- Gravar outro registro de dentro de um hook **não** fica na mesma transação da requisição; é preciso
  envolver a requisição com `e.app.runInTransaction((txApp) => { e.app = txApp; e.next() })` — testado
  num PocketBase separado (a falha desfaz tudo).
- O saldo é alterado por `UPDATE ... WHERE saldo + delta >= 0` (atômico), então duas saídas ao mesmo
  tempo não deixam o estoque negativo.

## Fica para as próximas etapas

- **EPIs**: o saldo do EPI (`quantidade_estoque`) ainda é calculado pela tela na entrega/devolução.
- **Quem pode lançar**: hoje qualquer usuário da empresa (exceto "viewer") consegue registrar uma
  movimentação já aprovada pela API. Restringir aprovação a Almoxarife/gestão junto com o ajuste das
  telas (Etapa 3), para não travar ninguém no meio da obra.
- **Recebimento parcial** de compra não lança automaticamente (a tela só informa o total recebido, não
  por item). Lançar pela tela Estoque, ou ajustar a tela de recebimento para informar por item.
- Telas: tirar o campo de saldo do cadastro do material e mostrar a mensagem do servidor quando a
  saída for recusada (Etapa 3 — precisa do código-fonte).

## Como publicar

Junto com a Etapa 1 — ver o passo a passo em `etapa1-seguranca.md`. No log do Fly devem aparecer
também `[estoque-servidor] movimentacoes: 4 campo(s) de controle criado(s).` e
`[estoque-servidor] N movimentação(ões) antiga(s) marcada(s) como histórico.` (só no primeiro boot).
Teste rápido em produção: registrar uma entrada e uma saída na tela Estoque e conferir o saldo.
