# Etapa 4 — Fluxos do documento mestre

Data: 18/10/2026 · Feita pelo Claude Code · Sobre as Etapas 1 a 3
Status: **Etapa 4 completa (4.1 a 4.5), testada localmente (servidor + navegador), ainda NÃO publicada**.

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

## 4.2 — Equipamento: emprestar → receber de volta conferindo o estado

**Como fica para quem usa (tela Equipamentos)**
- Equipamento disponível tem o botão **Emprestar**: escolhe **com quem fica** (lista de funcionários), a obra
  (opcional) e até quando devolver (opcional).
- No alto da lista aparece **Emprestados agora**: o quê, com quem, em qual obra, desde quando. Passou da
  data combinada → etiqueta vermelha **Atrasado**.
- **Receber de volta** pergunta como o equipamento voltou, com 4 botões grandes: **Voltou bom** (volta a ficar
  disponível no almoxarifado), **Precisa de manutenção** (vai para manutenção e já abre uma manutenção
  corretiva com o que aconteceu), **Voltou quebrado** (fica "Danificado"), **Não voltou (perdido)** (fica
  "Extraviado").
- Tudo fica no **Histórico** do equipamento (quem emprestou, para quem, quem recebeu, em que estado).
- Quem empresta e recebe: Administrador, Diretoria, Gerência, Engenheiro, Mestre de Obras, Almoxarife.
- O servidor garante: não empresta o que não está disponível, não empresta duas vezes, a devolução registrada
  não muda depois, e equipamento emprestado só sai dessa situação pela devolução. Empresa A não vê nem
  empresta equipamento da B.
- Usa a tabela `emprestimos`, que já existia e nenhuma tela usava (não foi criada tabela nova).

**Arquivos**: `pb_hooks/emprestimo-equipamento.pb.js` + `emprestimo-lib.js` (novos);
`frontend/src/pages/EquipamentosPage.jsx`.

**Testes**: servidor `audit_tests.py` → **162/0** (15 verificações novas de equipamento e isolamento),
rodado a partir do `.zip`. Navegador `testes/navegador/equipamento.mjs` → 9/9; os outros 10 roteiros
continuam OK (91 verificações no total).

## 4.3 — Diferença de estoque com motivo e autorização (ver `conferir-estoque.png`)

**Como fica para quem usa (tela Estoque)**
- Cada material tem o botão **Conferir**. A pessoa digita **quanto contou** e o app responde na hora:
  "Bate certinho", "Faltam 3 sc" ou "Sobram 2 sc".
- Se deu diferença, o app pergunta **por quê** (lista: contagem diferente do sistema, quebra ou dano, sumiço
  ou furto, vencido ou estragado, uso sem registro, erro de lançamento, outro) e aceita uma observação.
- **Administrador, Diretoria, Gerência ou Engenheiro**: o estoque passa a ser o que foi contado na hora.
- **Almoxarife, Mestre de Obras, Comprador**: a diferença fica num quadro amarelo **"Diferenças aguardando
  autorização"** (mostra sistema × contado, motivo e quem contou); quem autoriza aperta **Autorizar** ou
  **Recusar**. Só depois de autorizada o estoque muda.
- **Perda** (no "Registrar Saída") também pede o motivo e passa pela mesma autorização.
- Fica gravado: saldo do sistema na hora da contagem, diferença, motivo, quem autorizou e quando.

**Também resolvido (pendente da Etapa 3):** o **servidor** agora decide quem aprova movimentação. Antes só a
tela escondia o botão; qualquer pessoa da empresa conseguia aprovar por fora. Agora, movimentação lançada como
"Aprovado" por quem não é da gestão do estoque (ex.: pedreiro, faxina) fica "Pendente", e essas pessoas não
conseguem aprovar.

**Arquivos**: `pb_hooks/divergencia-estoque.pb.js` + `divergencia-lib.js` (novos);
`frontend/src/pages/EstoqueAlmoxarifadoPage.jsx`, `MovimentacoesPage.jsx` (motivo no formulário),
`lib/divergencia.js`, `lib/permissoes.js` (`podeAutorizarAjuste`).

**Testes**: servidor **174/0** (12 verificações novas); navegador `divergencia.mjs` → 8/8 (almoxarife conta
17 de 20, fica aguardando, administrador autoriza, estoque vai a 17; contagem igual não pede motivo).
Todos os 12 roteiros OK (99 verificações). `estoque.mjs` passou a mandar o motivo no inventário de teste.

## 4.4 — Ocorrências (módulo novo; ver `ocorrencia-registrar.png`)

**Como fica para quem usa (menu "Ocorrências", para todos os cargos menos Cliente)**
- Botão grande **Registrar ocorrência**: o que aconteceu (acidente, quase acidente, dano a equipamento ou
  material, problema na obra, falta de material, atraso, clima, furto ou sumiço, outro), **gravidade** (Baixa,
  Média, Alta — botões coloridos), descrição, obra, onde, pessoa envolvida, equipamento e **até 5 fotos**
  (no celular abre a câmera).
- Número **OCO-0001, OCO-0002…** por empresa, dado pelo servidor.
- **Gravidade Alta** → e-mail na hora para Administrador, Diretoria, Gerência e Engenheiro da empresa (com
  botão "Ver a ocorrência").
- Quem registrou vê as próprias; a gestão (Administrador, Diretoria, Gerência, Engenheiro, Mestre de Obras,
  Almoxarife) vê todas e trata: **Começar a resolver** → **Marcar como resolvida** (obrigatório dizer o que
  foi feito) ou **Cancelar** (obrigatório dizer por quê); **Reabrir** se voltar a acontecer.
- Abas **Em aberto / Resolvidas / Todas**. Fica gravado quem registrou, quem resolveu e quando.
- Ninguém apaga ocorrência (nem o administrador) — é histórico. Quem registrou pode corrigir o texto só
  enquanto está "Aberta".

**Arquivos**: `pb_hooks/ocorrencias.pb.js` (tabela nova `ocorrencias`, regras e aviso por e-mail);
`frontend/src/pages/OcorrenciasPage.jsx` (nova), `App.jsx` (rota `/ocorrencias`), `components/Sidebar.jsx`,
`lib/permissoes.js` (`podeGerirOcorrencias` e módulo nos cargos).

**Testes**: servidor **189/0** (15 verificações novas: numeração, quem vê, quem fecha, não apaga, isolamento
entre empresas, sem login), rodado a partir do `.zip`. Navegador `ocorrencias.mjs` → 10/10 (pedreiro registra
com foto e gravidade Alta, e-mail chega ao administrador, administrador resolve). Todos os 13 roteiros OK
(109 verificações). `permissoes.mjs` passou a conferir "Ocorrências" no menu do pedreiro.

## 4.5 — Alerta de estoque mínimo (ver `estoque-minimo.png`)

**Como fica para quem usa**
- Vale para material com **estoque mínimo** cadastrado (campo que já existia no cadastro de Materiais).
- Quando o saldo **chega no mínimo** (por saída, entrega de pedido, perda, cancelamento de entrada ou porque o
  mínimo foi aumentado), o servidor avisa **uma vez**:
  - no **sininho** de Administrador, Diretoria, Gerência, Engenheiro, Mestre de Obras, Almoxarife e Comprador
    ("Estoque baixo: Cal hidratada 20kg — restam 4 sc (mínimo 5 sc)" ou "Acabou: …");
  - por **e-mail** para Administrador, Almoxarife e Comprador (botão "Ver o estoque").
  Enquanto continuar baixo não repete; depois de repor acima do mínimo, volta a avisar na próxima descida.
- Na tela **Estoque**, quadro vermelho **"Materiais acabando"**: quanto resta, o mínimo e uma sugestão de compra
  (o dobro do mínimo menos o que tem). Botão **Pedir compra** cria uma Solicitação de compra (prioridade Alta;
  Urgente se acabou) com a sugestão escrita; o botão vira **"Pedido de compra já feito"** para não pedir duas vezes.
- O número "Alertas" do topo passou a contar só materiais com mínimo cadastrado (com o estoque começando vazio,
  antes todo material novo contava como alerta).
- "Saldo de outras obras antes de comprar" (item 17 do plano) não se aplica hoje: o estoque é um só
  (almoxarifado central); as obras recebem por entrega/consumo e não guardam saldo próprio. O quadro já mostra o
  saldo central antes de pedir.

**Arquivos**: `pb_hooks/estoque-minimo.pb.js` + `estoque-minimo-lib.js` (novos; campo interno escondido
`alerta_minimo_enviado` no material); `frontend/src/pages/EstoqueAlmoxarifadoPage.jsx`.

**Testes**: servidor **199/0** (10 verificações novas: avisa ao chegar no mínimo, não repete, avisa de novo
depois de repor, quem recebe, material sem mínimo, mínimo aumentado), rodado a partir do `.zip`. Navegador
`estoque-minimo.mjs` → 9/9 (painel, sininho, e-mail, pedir compra sem duplicar). Todos os 14 roteiros OK
(118 verificações).

## Correção 19/10/2026 — convite de funcionário com e-mail já usado

**Problema (produção):** "Funcionário salvo, mas o acesso ao sistema não pôde ser criado: Failed to create record."
e o convite não saía. Excluir um acesso só o inativa (para manter o histórico) e ele continuava com o e-mail;
o PocketBase não aceita dois acessos com o mesmo e-mail. Acontecia ao recadastrar quem foi excluído e ao tentar
de novo quando o convite não chegou. No reenvio, o número da pessoa (`id_unico`) também colidia
("Value must be unique" em `company_id`/`id_unico`).

**Correção:**
- `pb_hooks/acesso-email-reuso.pb.js` (novo): acesso inativo da mesma empresa libera o e-mail (o histórico fica);
  se era do mesmo funcionário, o número passa para o acesso novo; acesso ativo / outra empresa / outro funcionário
  com o mesmo e-mail → mensagem clara. Tudo em transação.
- Tela Funcionários: na edição, quem não tem acesso ativo ganha **"Criar acesso ao sistema e enviar convite (ou
  reenviar, se o convite não chegou)"**; a mensagem de erro real aparece (antes "Failed to create record.").
- `lib/erros.js`: "Value must be unique" vira "<campo> já está em uso".
- Removidas as checagens de e-mail feitas na tela (o servidor decide).

**Testes:** servidor 204/0 (5 novos em `[acesso]`); navegador `funcionario-acesso.mjs` 14/14; todos os 15 roteiros OK.

## Etapa 4 concluída — o que vem depois

Pelo plano da auditoria, a próxima é a **Etapa 5 — Limpeza**: unificar tabelas duplicadas e campos
inglês/português (com migração de dados), QR Code gerado no próprio app e "superadmin" como campo em vez do
e-mail fixo. Pendentes menores anotados: estoque de EPI ainda calculado na tela; limite de tentativas de
login no servidor; remetente de e-mail com domínio próprio (painel do Brevo).
