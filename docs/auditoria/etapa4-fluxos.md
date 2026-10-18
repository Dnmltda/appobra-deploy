# Etapa 4 — Fluxos do documento mestre

Data: 18/10/2026 · Feita pelo Claude Code · Sobre as Etapas 1 a 3
Status: **4.1 testada localmente (servidor + navegador), ainda NÃO publicada**.

## 4.1 — Material de consumo: pedir → aprovar → separar → entregar → confirmar

**Como fica para quem usa**
- Qualquer pessoa da obra (pedreiro, servente…) vê o botão **Nova Solicitação**. Ao criar um pedido de
  Material, o app abre direto a tela do pedido para escolher os materiais e as quantidades.
- No pedido aparece uma barra com os passos: **Pedido → Aprovado → Separando → Entregue → Recebido**.
- A gestão (Administrador, Gerência, Engenheiro, Mestre de Obras, Almoxarife, Comprador) vê os botões
  **Aprovar pedido / Recusar**, depois **Começar a separar**, depois **Entregar** (pede confirmação).
- Ao **Entregar**, o estoque baixa sozinho (uma saída por material, ligada ao pedido; com obra, conta como
  consumo da obra). Se faltar saldo, a entrega é recusada com o aviso "Saldo insuficiente…" e nada muda.
- Quem pediu toca em **Confirmar que recebi** e o pedido fica **Concluído**.
- Quem não é da gestão não vê o campo Status ao criar e não tem botão de aprovar; o servidor também
  garante: pedido novo dessas pessoas nasce sempre "Aberta", e elas só podem cancelar (antes da
  entrega) ou confirmar o recebimento.
- Materiais só entram ou saem do pedido antes da aprovação.
- Unidades de obra no cadastro de material: saco, caixa, peça, par, rolo, barra, lata, galão, tonelada
  (antes só un, kg, m, m², m³, litro — não dava para cadastrar cimento em saco).
- Pedidos sem materiais (RH, transporte…) continuam como antes.

**Arquivos**

| Onde | O quê |
|---|---|
| `pb_hooks/fluxo-material.pb.js` (novo) | tabela `solicitacoes_itens`, status "Em separação"/"Entregue", ordem dos passos, baixa no estoque ao entregar (transação) |
| `pb_hooks/seguranca-etapa1.pb.js` | quem pediu pode confirmar o recebimento ("Concluída") |
| `pb_hooks/fix-schema-telas.pb.js` | unidades de obra no material |
| `frontend/src/pages/SolicitacaoDetalhesPage.jsx` | barra de passos, lista de materiais, botões de cada passo |
| `frontend/src/pages/SolicitacoesPage.jsx`, `hooks/useSolicitacoes.js`, `lib/permissoes.js` | botão para todos, campo Status só para a gestão |
| `frontend/src/pages/MateriaisPage.jsx` | unidades novas com nome por extenso |

**Testes**
- Servidor: `testes/audit_tests.py` → **147/0** (`testes/resultado-etapa4.json`, rodado a partir do `.zip`).
- Navegador: `testes/navegador/fluxo-material.mjs` → 6/6 (pedreiro pede 8 sacos de cimento, gestão
  aprova/separa/entrega, estoque 20 → 12, pedreiro confirma e fica Concluído). Os outros 8 roteiros
  continuam todos OK.

**Publicação**: igual à Etapa 3 (`etapa3-telas.md`), o mesmo `.zip` leva tudo. Nada novo nos Secrets.

## Próximos passos da Etapa 4
- Empréstimo e devolução de equipamento (com inspeção na volta).
- Divergência de estoque com motivo e autorização.
- Ocorrências.
- Alerta de estoque mínimo.
