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

- **Código do material sempre automático** (`pb_hooks/materiais-cor.pb.js`): o servidor dá prefixo da categoria +
  sequência na empresa (ELE-001, ELE-002...); cada cor é um material com código próprio; editar não muda o código.
- **Marca por lista** (`frontend/src/lib/marcasMaterial.js`): a lista muda pelo nome/categoria do material (tintas,
  fios, cimento...); "Outra marca" deixa digitar.
- **Página da obra** (`/obras/:id`, e **Minha Obra** `/minha-obra` para o funcionário): fotos da obra (`obras.fotos`)
  e **mural da equipe** (coleção `obra_mensagens`, `pb_hooks/obra-mural.pb.js`): assunto e andar por lista, recado,
  até 4 fotos. Só quem está na obra (funcionário com `obraId`) e a gestão leem e escrevem; novo recado avisa a
  equipe no sininho. Na obra e em "Ver Equipe": **Tirar da obra** e **Colocar na obra**.
- **Painel inicial novo** (`DashboardPage.jsx` + `components/dashboard/`): só dados reais da empresa (nada de
  exemplo). Gestão: números do dia, "Precisa da sua atenção", obras, gasto por obra, movimentações dos últimos
  30 dias, pedidos por status. Funcionário de obra: minha obra, botões grandes, meus pedidos, material comigo.
  Empresa vazia mostra "Vamos começar". Cada bloco só aparece se o cargo pode abrir aquela tela.
- Câmera que lê código de barras do material: ideia para o futuro (não feito).
- **Quem vê o estoque** (`pb_hooks/acesso-estoque.pb.js`, pedido do Diego 20/10): estoque geral, estoque das obras,
  movimentações e saldo de todos só para Administrador, Diretoria, Gerência, Engenheiro, Mestre de Obras, Almoxarife,
  Comprador e Financeiro (Financeiro só lê). Pedreiro, servente, encanador, eletricista, faxina e funcionário veem só o
  próprio material (menu **Meu Material**), pedem material e registram uso; não cadastram nem alteram material e
  recebem a lista de materiais sem quantidade e mínimo.
- **Material pronto no cadastro**: busca no topo de "Adicionar Material" (catálogo padrão + materiais da empresa),
  igual no computador e no celular.

**Feito em produção depois (com o sim do Diego, 19/10 22:58 UTC)**
- dn-moraes passou para **02** (acesso e funcionário). Apagados de vez os testes 08/09 e o acesso de teste 08; o
  cadastro antigo arquivado do dn-moraes ficou com `ARQ-w0o3c940sf1are9` (guarda histórico de teste) e soltou o 07.
  Backup: `/data/backups/antes-id02-20261019-225828.db`.
- 19/10 23:38 UTC: **app zerado** a pedido do Diego. Ficaram só o login dele (01), as empresas e os cargos.
  Backup: `/data/backups/antes-zerar-20261019-233829.db` e `storage-antes-zerar.tgz`.

**Publicado em 20/10/2026 (Claude Code, pedido do Diego)**
- PR #8 no `main` (merge a2ef34c). Snapshot antes: `vs_yxxDyQ9jVajSKV5zkj9j` (volume vol_re1q22xm5ye2j0o4).
- Fly: release **v20** (imagem `registry.fly.io/appobra-backend:pr8-a2ef34c`, montada no Claude Code com o
  mesmo Dockerfile; o builder remoto do Fly não passa pelo proxy da nuvem). Boot sem `Erro` nem
  `failed to execute`; `/api/health` ok. Voltar atrás: `fly releases` → v19.
- Hostinger (`midnightblue-chamois-688707.hostingersite.com`): enviados `assets/index-BDqvJKn8.js`,
  `assets/index.es-ippwZO-t.js` e por último `index.html`. Login abre sem erro no Fly e na Hostinger.
- Falta: os 9 testes do passo 9 de docs/PUBLICAR-COWORK.md com o Diego; a chave do Fly que o Diego colou
  no chat fica por enquanto (decisão do Diego); trocar na checagem de segurança antes de vender/passar o app.

**Pendências da auditoria fechadas em 20/10/2026 (Claude Code, no PR #8)**
- **Limite de tentativas de login** (`pb_hooks/login-limite.pb.js` + `login-limite-lib.js`): 5 senhas erradas
  seguidas na mesma conta travam por 15 minutos (vale para as abas E-mail, Usuário e ID); senha certa zera o
  contador; conta "Bloqueado" pelo administrador não é mexida. A tela mostra "Muitas tentativas… use Esqueci minha
  senha". Além disso o PocketBase já limita 20 logins a cada 5 minutos por IP (as abas ID e Usuário não passam
  por esse limite do PocketBase — por isso o limite por conta).
- **Estoque de EPI pelo servidor** (`pb_hooks/estoque-epi.pb.js` + `estoque-epi-lib.js`): entrega e reposição
  tiram do estoque e devolução aprovada para reutilizar devolve, numa transação, recusando sem saldo; a entrega
  não é devolvida duas vezes; EPI de outra empresa é recusado; só a gestão (incluindo RH) ajusta a quantidade
  direto. A tela de EPIs não grava mais o saldo (antes fazia a conta e gravava) e relê o EPI depois de cada
  operação.
- Testes: servidor `audit_tests.py` 254/0; navegador `login-limite.mjs` 2/2, `epi-estoque.mjs` 3/3.

**Titular, limpeza dos testes, empresa de teste e limites (21–22/10/2026, Claude Code)**
- **Publicado e executado em 22/10/2026:** PR #12 (Fly v24); `LIMPEZA_TESTES` e `SENHA_SUPERUSUARIO_TITULAR` colocados
  pelo Claude Code com `flyctl secrets set` a pedido do Diego (v25) e retirados depois (v26). Limpeza feita (backup
  `antes-limpeza-testes-2026-10-22.zip` em pb_data/backups; snapshot `vs_mppD3jlAKVAty1X4aY9D`): saíram o login
  Dn-moraes, a obra "Teste 1", o funcionário de teste, a "Empresa Principal" e os registros de auditoria de teste.
  Ficaram o titular (ID 00) na "DNM&LTDA OBRAS" e a "Construtora Teste DNM (não apagar)" com 15 logins
  (`docs/logins-teste.md`). Login do superusuário do titular conferido (200).
- **Publicado em 22/10/2026:** PR #13 (merge a950d0c), Fly **v27** (snapshot `vs_x88DxQRjgajtkaMZa28w`), boot sem `Erro`;
  Hostinger atualizada (`assets/index-te5nZPSz.js`).
- **G1 (segurança) corrigido em 22/10/2026, aprovado pelo Diego** (`pb_hooks/acesso-dados.pb.js` + `-lib.js`): antes,
  dentro da mesma empresa, qualquer cargo (até Pedreiro e Cliente) lia pela API CPF e salário, contas a pagar/receber,
  compras, clientes, propostas e custos. Agora o servidor filtra no pedido (lista vazia / "não encontrado") as
  tabelas de financeiro, compras, fornecedores, comercial, frota, documentos e perdas/ganhos para quem não é do grupo
  (mesmos cargos que abrem a tela), e esconde na resposta CPF/salário/endereço dos funcionários (só Administrador,
  Diretoria, Gerência, RH e Mestre de Obras), CPF dos acessos (Administrador e RH) e custos/valores de materiais,
  equipamentos, EPIs, obras e saldo do funcionário (gestão). Filtro no pedido, não nas regras, porque outros arquivos
  regravam regras ao ligar. Proteção total do titular ficou presa ao e-mail `dnmltda@hotmail.com` (outra conta marcada
  como dona pode ser desmarcada pelo superusuário).

- **Estado real (levantamento em produção, v23):** um superusuário só (`dnmltda@hotmail.com`, desde 16/10); 2
  empresas ("Default Company" = a do Diego, e "Empresa Principal", vazia); 2 logins (o titular e
  `Dn-moraes@hotmail.com`, Servente de teste); 1 obra e 1 funcionário de teste. Nenhuma variável cria o
  superusuário (Secrets do Fly: só `BREVO_SMTP_LOGIN`, `BREVO_SMTP_KEY`, `FRONT_URL`).
- **Titular protegido** (`pb_hooks/titular.pb.js`): a conta dona do sistema não pode ser apagada, arquivada,
  inativada, bloqueada nem perder cargo/empresa/marca de dono, nem pelo superusuário; a empresa dele não pode
  ser apagada nem arquivada; o ID dele só muda pelo superusuário. E-mails para `*.invalid` não são enviados.
- **Limpeza dos testes** (`pb_hooks/limpeza-testes.pb.js`): roda uma vez com `LIMPEZA_TESTES=sim` nos Secrets do
  Fly (marca em `sistema_execucoes`); faz backup completo antes (`pb_data/backups`); deixa só o titular, a empresa
  dele (renomeada "DNM&LTDA OBRAS", titular com nome e **ID 00**) e a "Construtora Teste DNM (não apagar)".
- **Limites por empresa** (`limites-empresa.pb.js` + `limites-lib.js`): empresa criada pelo cadastro nasce com 10
  logins, 30 funcionários, 300 materiais e 5 obras (0 = sem limite); só titular/superusuário muda.
- **Empresa de teste:** `docs/auditoria/testes/empresa-teste.py` (criar e conferir); logins
  `<cargo>@teste-appobra.invalid` (15 cargos); senhas só com o Diego, fora do repositório.
- **Superusuário:** o Diego não conseguiu entrar em `/_/` pelo "Forgot password" — pendente.
- Ideias para depois em `docs/ideias-futuras.md` (módulos por empresa, demonstração, aviso de protótipo, opinião,
  LGPD, regra do titular quando o app for vendido).

**Ficha de EPI, código de barras e assinatura (21/10/2026, Claude Code)**
- Publicado em 21/10/2026 ~05h: PR #10 (merge 2fa7ff4), Fly **v22** (snapshot antes: `vs_RmmByep69G6skY4YVLB2`), boot
  sem `Erro`; Hostinger atualizada (`assets/index-Pl4xQ9ru.js`). Falta o teste do Diego em produção.
- **Ficha de EPI (cautela) em PDF** (`frontend/src/lib/fichaEpi.js`; EPIs → aba Entregas → "Ficha de EPI do
  funcionário"): todas as entregas do funcionário (data, EPI, CA, quantidade, devolução), assinatura e foto de cada
  uma e o termo de responsabilidade da NR-6 (6.6.1), com linhas para assinar.
- **Correção:** entrega de EPI **assinada não salvava** (campo `assinatura_digital` com limite de 5000 caracteres e
  a assinatura é imagem em texto; aparecia "Must be no more than 5000 character(s)"). Limite agora 300000
  (`foto-retirada.pb.js`).
- **Código de barras da embalagem** (`pb_hooks/codigo-barras.pb.js` + `-lib.js`, `components/LeitorCodigo.jsx`):
  campo `materiais.codigo_barras` (sem repetir na empresa), lido pela câmera no cadastro do material; no Estoque,
  "Registrar Entrada/Saída" tem "Ler código de barras" que escolhe o material; a tela QR Code também lê o código
  de barras e abre o material.
- **Quem muda o quê nos dados das pessoas** (`pb_hooks/meus-dados.pb.js`, regra do Diego 21/10): no Meu Perfil a
  pessoa muda só nome de login, telefone, foto e senha; **e-mail e ID nunca mudam**; nome completo, cargo, empresa
  e situação só pelo administrador (pedido para mudar o próprio cargo/ID é recusado). Cadastro de funcionário:
  antes **qualquer pessoa da empresa alterava qualquer cadastro** (CPF, salário); agora Administrador, RH e Mestre
  de Obras cadastram e editam; Diretoria, Gerência, Engenheiro e Almoxarife só colocam/tiram da obra; os demais
  nada. Tela Meu Perfil: nome completo e e-mail só leitura.

**Etapa 5 e câmera (20/10/2026, Claude Code, pedido do Diego "faça tudo antes dos testes")**
- Publicado em 20/10/2026 ~23h: PR #9 (merge ba88ee4), Fly **v21** (snapshot antes: `vs_jRRDMv7eYpes2PAbj6w`),
  boot sem `Erro`; nenhuma das tabelas duplicadas travadas tinha dados em produção. Hostinger atualizada
  (`assets/index-DfxfHyCW.js`). Falta o teste do Diego em produção.
- **Foto de quem retira** (`pb_hooks/foto-retirada.pb.js`, regra do aceite em `fluxo-material.pb.js`; tela
  `components/FotoRetirada.jsx` e `FotoProtegida.jsx`): na retirada do material (aceite de quem pediu ou registro
  do almoxarifado no balcão), na entrega de EPI e no empréstimo de equipamento a câmera do aparelho abre, conta
  3 segundos e tira a foto da pessoa sozinha (ou escolhe uma foto). Obrigatória no servidor, não pode ser trocada
  depois e protegida (só abre com login de quem vê o registro). Aparece na solicitação, na lista de entregas de
  EPI e em "Emprestados agora". Campo `foto_retirada` em `solicitacoes`, `epis_entregas` e `emprestimos`
  (+ `solicitacoes.retirada_registrada_por`). Câmeras fixas (CFTV) não fazem parte: é a câmera do celular/tablet.
- **Passar equipamento para outra pessoa** (`emprestimo-equipamento.pb.js`, tela Equipamentos → "Emprestados agora"):
  quem está com o equipamento (ou a gestão) passa direto para outro funcionário dizendo onde estão (andar/setor) e
  com a foto da troca. O empréstimo de quem passou fecha como "Repassado" e abre outro para quem recebeu
  (`emprestimos.repassado_de`, `local_entrega`); o histórico do equipamento guarda de quem para quem e o local.
  Com local e hora registrados, a troca pode ser achada nas câmeras fixas da obra.
- **Dono do sistema como campo** (`pb_hooks/dono-lib.js` + `dono-sistema.pb.js`): `users.dono_sistema` substitui
  o e-mail fixo nas regras e hooks (os e-mails de contato/remetente continuam). No boot o campo é criado, a conta
  `dnmltda@hotmail.com` é marcada e as regras antigas no banco são trocadas. Só o superusuário (painel `/_/`)
  liga ou desliga; pela API ninguém se torna dono.
- **QR Code no app** (`pages/QRCodeModule.jsx`, `components/CodigosItem.jsx`, bibliotecas `qrcode` e `jsbarcode`):
  etiqueta de um item real (material, equipamento, EPI) gerada no aparelho; o QR guarda o link
  `/qrcode?ler=tipo:id` (a câmera comum do celular abre o app no item); leitura registrada em `qrcode_leituras`
  da empresa; item no menu (Suprimentos → QR Code). Equipamentos: QR e código de barras também locais (antes
  api.qrserver.com e bwipjs-api.fly.dev).
- **Tabelas duplicadas** (`seguranca-etapa1.pb.js`, `SEG_DUPLICADAS`): as que nenhuma tela usa (empresa, veiculo,
  epi_entrega, epi_funcionario, pedidos_compra, aprovacoes_compra, recebimentos, qr_scans, solicitacoes_compra) ficam travadas para gravação; dados antigos guardados. O log do
  boot lista as que têm dados. Não foi feita a fusão com migração de dados (companies/empresas,
  audit_logs/auditoria, campos inglês/português): mexe em dados de produção e fica para a checagem antes de vender.
- Hierarquia: conferida na tela — Almoxarife/Engenheiro/Administrador mostram Júnior/Pleno/Sênior; cargos de obra
  mostram Ajudante/Oficial/Encarregado.
- Testes: servidor `audit_tests.py` 279/0; navegador com câmera de teste (novos `qrcode.mjs`, que lê o QR pela câmera,
  e `equipamento-repasse.mjs`); todos os 27 testes de tela passam.

**Pendente / ideias do Diego**
- Câmeras fixas (CFTV) no almoxarifado: fora do app por enquanto.
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
