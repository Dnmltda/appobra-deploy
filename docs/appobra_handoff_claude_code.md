# APP OBRA — Retomada do projeto (Claude Code → Cowork)

> Versão atualizada pelo **Claude Code em 18/10/2026**, seguindo o protocolo de transição. A versão anterior
> (Cowork → Code) continua valendo no que não foi alterado aqui — as seções 4 a 7 dela foram mantidas
> resumidas no fim. Leia o TL;DR e a seção 2 antes de mexer em produção.

## TL;DR

- Repositório: **`Dnmltda/appobra-deploy`**. Todo o trabalho do Code está na branch
  **`ccr-6751e2d4-oj4p0r`** (19 commits à frente do `main`, sem conflito). **Nada foi publicado ainda.**
- Foi feita a **auditoria completa** (pedida pela documentação mestre) e executadas as **Etapas 1 a 4** do
  plano dela, todas testadas num PocketBase local isolado: servidor **199/0**, telas (Playwright) **118/118**.
- O código-fonte das telas agora está no GitHub em **`frontend/`** (veio de `~\Documents\appobra-app\apps\web`).
  **Daqui para frente as telas mudam no GitHub, não no Hostinger Horizons**, senão as duas cópias se separam.
- **Próximo passo é da Cowork: publicar.** Roteiro e prompt prontos em **`docs/PUBLICAR-COWORK.md`**
  (snapshot → Brevo → Secrets → merge → deploy → logs → Hostinger → teste rápido).
- Depois de publicado e usado alguns dias, o Code segue para a **Etapa 5 (limpeza)**.

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
