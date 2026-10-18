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

## E-mails do app no padrão profissional (pedido do Diego, 18/10/2026)

**Defeito encontrado:** o e-mail de **convite de funcionário** (e o de boas-vindas e um de senha antigo)
mandava o link para o endereço antigo da Hostinger (`midnightblue-chamois…`), que não funciona mais. A
pessoa recebia o convite e o link não abria o app. Corrigido.

**Como fica (ver `email-convite.png`)**
- Remetente aparece como **DNM&LTDA OBRAS** (nome, não o endereço de e-mail).
- No lugar do endereço comprido, um **botão com uma frase**: "Criar minha senha" (convite), "Criar nova
  senha" (esqueci a senha), "Entrar no APP OBRA" (boas-vindas). O endereço só fica na versão "texto puro"
  do e-mail, que aparece apenas em programas de e-mail muito antigos.
- O convite mostra o usuário e o **ID** da pessoa.
- Os links vão para `FRONT_URL` se existir nos Secrets do Fly; **sem ela, vão para
  `https://appobra-backend.fly.dev`, que já serve as telas** — funciona sem configurar nada.
  `FRONT_URL` só é necessário se um dia o app ganhar um endereço próprio (ex.: `app.dnmltda.com.br`).
- Arquivos: `pb_hooks/email-lib.js` (padrão único), `send-welcome-email.pb.js`, `send-password-reset.pb.js`,
  `login-e-senha.pb.js`, `smtp-from-env.pb.js`.
- Teste: `testes/navegador/convite.mjs` → 8/8 (e-mail chega, remetente com nome, botão com frase, sem
  endereço comprido, link certo, pessoa cria a senha e entra). `login.mjs` agora confere o botão do
  "Esqueci minha senha" (13/13).

**Recomendação para depois (painel do Brevo, não é código):** o remetente hoje é
`dnmltda@hotmail.com`. Hotmail/Outlook não autoriza o Brevo a enviar em nome dele, então parte dos
e-mails pode cair no spam ou nem chegar. O profissional é enviar de um endereço do domínio próprio (ex.:
`nao-responda@dnmltda.com.br`) autenticado no Brevo (DKIM/SPF). Quando tiver, basta pôr
`SMTP_SENDER_EMAIL` nos Secrets do Fly.

## Próximos passos da Etapa 4
- Empréstimo e devolução de equipamento (com inspeção na volta).
- Divergência de estoque com motivo e autorização.
- Ocorrências.
- Alerta de estoque mínimo.
