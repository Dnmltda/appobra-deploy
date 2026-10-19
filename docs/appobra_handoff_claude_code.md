# APP OBRA — Retomada do projeto (Claude Code → Cowork)

> Versão atualizada pelo **Claude Code em 18/10/2026 e 19/10/2026 (seção 0)**, seguindo o protocolo de transição. A versão anterior
> (Cowork → Code) continua valendo no que não foi alterado aqui — as seções 4 a 7 dela foram mantidas
> resumidas no fim. Leia o TL;DR e a seção 2 antes de mexer em produção.

## TL;DR

- Repositório: **`Dnmltda/appobra-deploy`**, branch `main`. **Em produção (Fly v17)**: tudo até o PR #7 (Etapas 1 a 4,
  login, convite, limite de troca de senha). As telas também estão na **Hostinger**
  (`midnightblue-chamois-688707.hostingersite.com`), que é o endereço que o Diego usa; o Fly
  (`appobra-backend.fly.dev`) mostra o mesmo app.
- **A cada deploy com mudança de tela, reenviar `pb_public/` para a Hostinger** (ver seção 00).
- O código das telas fica em **`frontend/`** (GitHub), não no Hostinger Horizons.
- Próximo: PR "uso de material / Materiais por Obra / aceite na retirada" (seção 00) e depois estoque por obra.

## 00. Atualização 19/10/2026, noite (Claude Code)

**Feito em produção (com pedido do Diego)**
- Telas novas enviadas para a Hostinger (`pb_public/` da `main`, pela API da Hostinger; cópia das antigas guardada).
- Acesso `dn-moraes@hotmail.com` apagado para o Diego recriar do zero: estava **arquivado pela limpeza inicial**
  (por isso não aparecia em Gestão de Acessos) e havia 14 cadastros de funcionário com o mesmo e-mail. Mantido
  arquivado 1 cadastro com retirada de teste no histórico. Backup antes: `/data/backups/` no volume.

**PR desta etapa (não publicado até o Diego pedir)**
- **Saldo por Funcionário → "Registrar uso"**: a pessoa diz material, quantidade, obra e local (ex.: "3º andar");
  sai do saldo dela, **não volta ao estoque** e vira gasto da obra. Servidor: `pb_hooks/uso-material.pb.js`
  (confere o que está em posse, calcula o valor; funcionário só no próprio saldo; só a gestão lança
  retirada/devolução ou altera lançamentos).
- **Materiais por Obra** (`/materiais-por-obra`): por obra, material usado e valor gasto (Consumo de Obra +
  usos registrados).
- **Pedido de material com aceite na retirada**: estoque confirma que recebeu → separa → "Pronto para retirada"
  → **quem pediu aceita** (só aí baixa o estoque; se tem cadastro de funcionário, vai para o saldo dele) ou
  **recusa com o motivo** (volta para separação). Avisos no sininho em cada passo.
- **ID automático (01, 02...)**: o campo ID saiu do cadastro de funcionário e de acesso (aparece só para ler,
  na edição). O servidor dá o primeiro número livre da empresa; quem já foi da empresa continua dono do seu.
  **Quem volta** (mesmo e-mail ou CPF de um cadastro arquivado/inativo) **recupera o número antigo**; o acesso
  antigo solta o número (`ARQ-<id>`). Só fica livre o número de quem for **apagado de vez**, e isso só quando o
  Diego disser que a pessoa não volta mais (`pb_hooks/id-lib.js`).
- Testes: servidor 224/0 (`audit_tests.py`), navegador `fluxo-material.mjs` 15/0, `funcionario-acesso.mjs` 20/0.

- **Estoque geral + estoque por obra**: a compra entra no estoque geral (`materiais.quantity_in_stock`, como antes)
  e a tela **Estoque por Obra** (`/estoque-obras`) transfere para cada obra, registra consumo e devolve ao geral.
  Saldo de cada obra na coleção `estoque_obra` (só o servidor grava, `pb_hooks/estoque-obra.pb.js` +
  `estoque-lib.js`). Tipos novos: "Transferência para Obra" e "Devolução da Obra"; qualquer movimentação com
  `estoque_obra_id` mexe no estoque daquela obra. No pedido de material, quem separa escolhe "Separar de qual
  estoque" (vem marcado o da obra quando ela tem tudo). Alerta de estoque mínimo continua só no geral.
  Testes: servidor 236/0, `estoque-obra.mjs` 12/0.

- **Cor do material por lista** (`frontend/src/lib/coresMaterial.js`, campo `materiais.cor`): fio nas cores da
  norma, tubo pelas linhas, tinta pelas cores comuns, lista geral no resto. A cor vai no fim do nome ("Fio 2,5 mm
  Azul claro") e do código. Categoria virou lista; código / SKU é opcional (o sistema gera). Diego quer o máximo
  de "escolher" e o mínimo de "digitar".

**Feito em produção depois (com o sim do Diego, 19/10 22:58 UTC)**
- dn-moraes passou para **02** (acesso e funcionário). Apagados de vez os testes 08/09 e o acesso de teste 08; o
  cadastro antigo arquivado do dn-moraes ficou com `ARQ-w0o3c940sf1are9` (guarda histórico de teste) e soltou o 07.
  Backup: `/data/backups/antes-id02-20261019-225828.db`.
- 19/10 23:38 UTC: **app zerado** a pedido do Diego. Ficaram só o login dele (01), as empresas e os cargos.
  Backup: `/data/backups/antes-zerar-20261019-233829.db` e `storage-antes-zerar.tgz`.

**Pendente / ideias do Diego**
- Câmera no almoxarifado: foto ou vídeo curto na entrega do material (futuro).
- Hierarquia: já existe em todos os cargos, sem limite por nível; pergunta aberta se cargos de obra também usam
  Júnior/Pleno/Sênior.
- E-mails no spam: Diego aceita por enquanto (domínio próprio no futuro).

## 0. Atualização 19/10/2026 (Claude Code) — o que aconteceu depois da primeira versão deste documento

**Publicado em produção**
- Etapas 1 a 4 (PR #3) e as correções abaixo (PRs #4 e #5) estão no ar: **deploy v16** no Fly feito pela Cowork
  logo após o merge do PR #5 ("Released v16 ... Complete, took 71s"). Conferido de fora: as telas servidas pelo
  Fly são as da `main` e `/api/health` responde.
- **PR #4** — `pb_hooks/id-lib.js`: ao procurar "a mesma pessoa" pelo e-mail, ignora cadastros excluídos
  (`deleted_at` lido com `getString()`, `is_active = false`); antes reaproveitava o `id_unico` de um excluído e
  dava "Value must be unique" em `company_id`/`id_unico`. `.zip` regerado.
- **PR #5** — `pb_hooks/acesso-email-reuso.pb.js` (novo): criar acesso com e-mail que já esteve num acesso
  excluído/convite não aceito libera o e-mail do antigo (vira `arquivado.<id>@arquivado.invalid`) e, se era do
  mesmo funcionário, passa o número para o novo; mensagens claras para acesso ativo, outra empresa e outro
  funcionário com o mesmo e-mail. Tela Funcionários: na edição, "Criar acesso ao sistema e enviar convite (ou
  reenviar…)"; erro real na tela ("<campo> já está em uso").

**Login do Diego (`dn-moraes@hotmail.com`) — causa raiz encontrada (PR #6)**
- Sintoma: convite e "Esqueci minha senha" chegam (no spam do Hotmail), a senha é trocada, mas o login diz
  "Conta inativa".
- Causa: o convite cria o acesso como **Inativo**; quem ativa é o botão **"Criar minha senha"** do convite
  (`activate-invite.pb.js`). O "Esqueci minha senha" só trocava a senha — a conta continuava Inativa.
- Correção (PR #6): para convite pendente, "Esqueci minha senha" **reenvia o convite** (link novo de 7 dias; o
  anterior deixa de valer); excluir um acesso apaga o convite pendente (não reativa); a tela de login explica o
  que fazer; desligado o hook antigo `send-password-reset.pb.js` (mandaria um 2º e-mail errado). Teste
  `testes/navegador/convite-esqueci.mjs` 9/9.
- Para o Diego entrar **antes** do PR #6: abrir o e-mail "Seu acesso ao APP OBRA" (spam) e usar "Criar minha
  senha" (o link do convite continua valendo 7 dias; o "Esqueci minha senha" não o invalidou). Depois do PR #6
  publicado, basta usar "Esqueci minha senha" que chega o convite.

**Erro no boot do v16 — `[fix-funcionarios-id-unico] ... UNIQUE constraint failed` (explicado e corrigido no PR #6)**
- Dois hooks disputavam o mesmo índice, em ordem aleatória a cada boot: `seguranca-etapa1.pb.js` deixa
  `idx_funcionarios_id_unico` **parcial** (`WHERE deleted_at = ''`, de propósito: excluído não trava o número) e
  o hook antigo em `log-security-event.pb.js` tentava trocar pela versão sem o `WHERE`. Com um funcionário
  excluído e um ativo com o mesmo número, a troca falha e é desfeita — **a proteção (índice parcial) continua**;
  o erro era só barulho. Ele também mostra que existe em produção um funcionário **excluído** com ID "10"
  (a API esconde os excluídos; por isso a Cowork só via um).
- Correção: o hook antigo só age se o índice ainda não for por empresa. Reproduzido localmente: versão antiga
  6/6 boots com o erro; nova, 0/5, índice parcial mantido.
- Consulta só-leitura para conferir no banco (via `fly ssh console`): ver a mensagem do Code de 19/10 —
  `sqlite3 -readonly /data/data.db` com as seções users / funcionarios / IDs repetidos / índices.

**Pendente**
- Roteiro de testes manuais (9 itens, `docs/PUBLICAR-COWORK.md` passo 9) — fazer com o Diego, item por item.
- Remetente dos e-mails: `dnmltda@hotmail.com` cai no spam do Hotmail; o profissional é domínio próprio
  autenticado no Brevo e `SMTP_SENDER_EMAIL` nos Secrets do Fly.
- Hierarquia (Júnior/Pleno/Sênior) "sumiu" segundo o Diego: localmente aparece no cadastro e na lista de
  Funcionários; falta ele dizer em qual tela.
- O Code não tem acesso ao Fly nem à Brevo nesta sessão: diagnósticos em produção dependem do Diego/Cowork
  (ou de um `FLY_API_TOKEN` de leitura nas variáveis do ambiente do Claude Code).

## 1. Papéis (sem mudança)

- **Claude Code**: código (servidor `pb_hooks/` e telas `frontend/`), testes, documentação no repositório.
- **Cowork**: painéis — Fly.io (deploy, Secrets, snapshot), Brevo, Hostinger, navegador.
- Passos sensíveis (colar secret, apertar Merge/Deploy): **o Diego faz**; quem prepara deixa a tela pronta.
- Regra de ouro: **nada em produção ou no schema sem testar antes num ambiente local isolado.**

## 2. Como publicar (resumo — o completo está em `docs/PUBLICAR-COWORK.md`)

1. Snapshot do volume `appobra_data` (Fly.io → `appobra-backend` → Volumes).
2. Brevo: revogar a chave SMTP antiga (ficou exposta no histórico do GitHub, repositório público) e usar a nova.
3. Secrets do Fly: `BREVO_SMTP_LOGIN`, `BREVO_SMTP_KEY` (Diego cola), `LIMPEZA_INICIAL=sim` (confirmar com o
   Diego: deixa só o `dnmltda@hotmail.com`), opcionais `FRONT_URL`, `SMTP_SENDER_EMAIL`, `CONTATO_EMAIL`.
4. Merge da branch no `main` (link no roteiro) → deploy.
5. Conferir as linhas esperadas nos logs; depois tirar `LIMPEZA_INICIAL`.
6. Se o app é aberto pelo endereço da Hostinger: subir lá o conteúdo de `pb_public/` e pôr esse endereço em `FRONT_URL`.
7. Teste rápido em produção (9 itens no roteiro). Desfazer: Releases → versão anterior; snapshot → restore.

## 3. O que foi feito (Code, 18/10/2026)

Documentos: `docs/auditoria/2026-10-18-auditoria-completa.md` (relatório + "Andamento"),
`etapa1-seguranca.md`, `etapa2-estoque.md`, `etapa3-telas.md`, `etapa4-fluxos.md`, `anexo-frontend.md`.

**Etapa 1 — Segurança (servidor)**
- 29 tabelas não separavam empresas → agora separam (com preenchimento dos registros antigos).
- Funcionário conseguia virar administrador e apagar dados de outra empresa → corrigido.
- Logs de auditoria imutáveis; campos "únicos" passaram a ser por empresa; geradores de código por empresa
  (só o primeiro fornecedor/compra/EPI/veículo do sistema inteiro era salvo).
- Compras e Equipamentos não salvavam pela tela; EPIs perdiam ~24 campos → corrigido.

**Etapa 2 — Estoque confiável**
- Saldo calculado só pelo servidor, nunca negativo, em transação; movimentação lançada não se edita
  (cancelar estorna); compra recebida entra no estoque sozinha.

**Etapa 3 — Telas**
- Compras com listas funcionando; login por ID e por usuário; "Esqueci minha senha" com e-mail em português;
  troca de senha no perfil; "Fale conosco" real; excluir = arquivar; um mapa único de permissões
  (`frontend/src/lib/permissoes.js`); texto livre → listas em vários formulários.
- **Pedidos do Diego:** ID por ordem de chegada (01, 02… por empresa, nunca muda nem é reaproveitado);
  empresa nova começa com **estoque vazio** + sugestões de materiais; limpeza única deixando só o
  `dnmltda@hotmail.com` (`pb_hooks/limpeza-inicial.pb.js`, só com `LIMPEZA_INICIAL=sim`).

**Etapa 4 — Fluxos do documento mestre**
- 4.1 Material de consumo: pedido com itens → aprovar → separar → entregar (baixa no estoque) → confirmar recebimento.
- 4.2 Equipamento: emprestar → receber de volta conferindo o estado (bom / manutenção / quebrado / perdido).
- 4.3 Divergência: "Conferir estoque" com motivo; Administrador/Diretoria/Gerência/Engenheiro autorizam;
  o **servidor** agora decide quem aprova movimentação.
- 4.4 **Ocorrências** (módulo novo): registro com fotos, gravidade, e-mail para a chefia se for "Alta".
- 4.5 Alerta de estoque mínimo: sininho + e-mail, quadro "Materiais acabando" com "Pedir compra".
- E-mails: padrão único com botão e remetente "DNM&LTDA OBRAS"; **o convite de funcionário apontava para o
  endereço antigo da Hostinger (`midnightblue-chamois…`) e não abria** → corrigido (usa `FRONT_URL` ou o Fly).

**Testes** (rodar antes de cada publicação): `docs/auditoria/testes/audit_tests.py` (servidor) e
`docs/auditoria/testes/navegador/*.mjs` (14 roteiros clicando nas telas) — instruções nos `README.md` de lá.

## 4. Decisões novas (valem daqui para frente)

- Ajustes de schema e regras continuam em **hooks `onBootstrap` idempotentes** (`pb_hooks/`), não em migrations.
- Hooks JSVM: cada handler roda isolado — funções compartilhadas ficam em módulos `*-lib.js` carregados com
  `require()` dentro do handler. Campo de data vazio é objeto (truthy): usar `getString()`.
- Remetente `dnmltda@hotmail.com` tende a cair no spam: o profissional é um domínio próprio autenticado no
  Brevo (DKIM/SPF) e pôr o endereço em `SMTP_SENDER_EMAIL`.
- Mestre de Obras lança movimentação, mas **não autoriza diferença de estoque** (se o Diego quiser, é ajuste pequeno).
- O estoque é um só (almoxarifado central): "saldo de outras obras antes de comprar" não se aplica hoje.

## 5. Pendente

- **Publicar** (Cowork, `docs/PUBLICAR-COWORK.md`).
- Etapa 5 — limpeza: unificar tabelas duplicadas e campos inglês/português (com migração de dados); QR Code
  gerado no app; "superadmin" como campo em vez do e-mail fixo. Melhor fazer **depois** de publicar.
- Menores: estoque de EPI ainda calculado na tela; limite de tentativas de login no servidor; bug antigo do
  Diego editar o próprio cadastro de funcionário (separação `users` × `funcionarios`) não foi retomado;
  domínio próprio para os e-mails.
- Da lista do Easytool ainda não feitos: cautela/ficha de EPI com assinatura e PDF; QR pela câmera;
  compra com recebimento parcial.

## 6. Contexto mantido da versão anterior (resumo)

- Arquitetura: React + Vite (telas, hoje também servidas pelo próprio Fly em `pb_public/`) + PocketBase no
  Fly.io (`appobra-backend`, região `gru`, volume `appobra_data`). Hostinger antiga com PocketBase Node
  (`midnightblue-chamois-688707.hostingersite.com`) está **obsoleta**.
- Empresa principal `cjly25lkal4kq1a`; admin `dnmltda@hotmail.com` (ID 01, Administrador).
- Documentação mestre (16 módulos, 4 fluxos, regras de integridade), visão "APP GERAL FINAL", concorrentes
  (Easytool, ALVA, Mais Controle, InvenTree) e boas práticas de teste: ver a versão anterior deste documento
  e a memória da Cowork.

## Protocolo de transição Code ↔ Cowork (sem mudança)

Quem encerra atualiza este documento (o que foi feito, testado, pendente e decisões novas) e deixa o
prompt de retomada pronto. Objetivo: quem retoma nunca precisa perguntar "onde paramos".
