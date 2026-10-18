# APP OBRA — Auditoria completa do app real (18/10/2026)

Feita pelo Claude Code a pedido do Diego, seguindo a ordem de entrega do documento mestre:
inventário de módulos → telas/rotas → fluxos → banco e relações → permissões → funcionalidades →
segurança/integridade → comparação com o documento mestre → plano de correção → plano de testes.

**Nada foi alterado em produção nem no schema.** Tudo foi testado numa cópia local isolada.

---

## Andamento

- **Etapa 1 — feita e testada localmente, aguardando publicação:** ver `etapa1-seguranca.md`
  (testes 36/50 → 85/3). Durante a Etapa 1 apareceram três defeitos novos, já corrigidos nela:
  - **D10.** Compras e Equipamentos não salvavam pela tela; EPIs perdiam ~24 campos (mesmo problema de
    nomes que Solicitações tinha).
  - **D11.** Fornecedor, compra, EPI e veículo: só o primeiro cadastro do sistema inteiro era salvo
    (gerador de código sempre devolvia `PREFIXO-000001`).
  - **D12.** Campos "únicos" valiam para o sistema todo (duas empresas não podiam ter o mesmo
    fornecedor; só um veículo sem chassi/RENAVAM no sistema).
- **Etapa 2 — feita e testada localmente, aguardando publicação (junto com a 1):** ver
  `etapa2-estoque.md` (script completo: 108/0). Saldo pelo servidor, saída maior que o saldo recusada,
  movimentação lançada imutável (cancelar estorna), compra recebida entra no estoque.
- **Etapa 3 — feita e testada localmente, aguardando publicação:** ver `etapa3-telas.md`. Código-fonte das
  telas em `frontend/`. Servidor 123/0; navegador 68/68. Corrigidos também: Compras sem listas no
  formulário, login por ID/Usuário e "Esqueci minha senha" que nunca funcionaram, troca de senha no
  perfil, "Fale conosco" falso; excluir passou a arquivar.
- **Etapa 4 — em andamento:** ver `etapa4-fluxos.md`. 4.1 feita e testada localmente (pedido de material
  com itens → aprovar → separar → entregar com baixa no estoque → confirmar recebimento); 4.2 feita e
  testada (emprestar equipamento → receber de volta conferindo o estado). E-mails com botão e link certo
  (o convite de funcionário apontava para o endereço antigo); 4.3 feita e testada (conferir estoque:
  diferença com motivo e autorização; o servidor passou a decidir quem aprova movimentação).
  4.4 feita e testada (módulo Ocorrências, que não existia); 4.5 feita e testada (alerta de estoque mínimo
  no sininho e por e-mail, "Pedir compra"). **Etapa 4 concluída.** Servidor 199/0; navegador 118/118.
  Próxima: Etapa 5 (limpeza).

---

## 0. Resumo para o Diego (leia isto primeiro)

O app tem muitas telas prontas e a base de dados cobre quase todos os módulos do documento mestre.
Mas hoje ele **não está pronto para outras empresas usarem**, por três motivos comprovados em teste:

1. **Um funcionário comum consegue virar administrador sozinho** e, com isso, **apagar dados de
   qualquer empresa**. No teste, o funcionário da "Empresa A" apagou uma obra da "Empresa B".
2. **29 das 67 tabelas não separam os dados por empresa.** No teste, a Empresa B viu e apagou
   veículos, equipes, contas a pagar, perdas e ganhos e documentos da Empresa A.
3. **O estoque não é confiável:** registrar uma movimentação na tela Movimentações não muda o saldo;
   o servidor aceita saída maior que o saldo (testado com 999.999); movimentação registrada pode ser
   editada; compra recebida não entra no estoque.

Além disso, alguns fluxos do documento mestre ainda não existem (separação, confirmação de
recebimento, empréstimo/devolução/inspeção de equipamento, divergência de estoque, Ocorrências).

**Recomendação:** antes de qualquer tela nova, fazer a Etapa 1 do plano (seção 9): fechar as falhas de
segurança e separação entre empresas. São mudanças de regras no servidor, testáveis localmente, sem
mexer nas telas.

Placar dos testes automáticos (seção 10): **10 aprovados, 21 reprovados** + 4 testes manuais extras
(1 aprovado, 3 reprovados).

---

## Método e limites desta auditoria

- **Código analisado:** o `appobra_deploy_final.zip` do `main` do GitHub (commit `c568a19`, 18/10
  16:02). Backend PocketBase 0.40.4 + 273 migrations + 16 hooks. As telas só existem **compiladas**
  (minificadas) dentro de `pb_public/` — o código-fonte React não está no GitHub (fica no notebook do
  Diego, `~\Documents\appobra-app`). Por isso as telas foram analisadas pelo arquivo compilado.
- **Banco testado:** cópia local criada a partir do `pb_data` do zip + todas as migrations (rodadas
  duas vezes, simulando restart) + hooks. **O banco real de produção (volume do Fly.io) não foi
  acessado.** O schema deve ser igual (mesmas migrations e hooks), mas dados e qualquer ajuste feito à
  mão no painel do PocketBase de produção podem ser diferentes.
- **Testes:** duas empresas criadas pelo autocadastro real (`/api/custom/self-register-company`),
  usando os mesmos dados que as telas enviam. Script reutilizável em `docs/auditoria/testes/`.
- **Arquitetura confirmada:** as telas apontam para `https://appobra-backend.fly.dev` (backend no
  Fly.io). O PocketBase que existe na Hostinger (`midnightblue-chamois-688707.hostingersite.com`) é uma
  tentativa antiga, parada desde 16/10 — não é produção.

Anexo com o detalhe das telas (rotas, chaves de cada formulário, evidências): `anexo-frontend.md`.

---

## 1. Inventário de módulos

| Módulo (doc. mestre) | Existe? | Observação |
|---|---|---|
| Autenticação / usuários | Sim | Login por email, ID ou usuário; convite com link; autocadastro de empresa. "Esqueci minha senha" **não funciona** (ver 6). |
| Dashboard | Sim | Card de compras provavelmente sempre 0 (conta status que não existem). |
| Obras | Sim | CRUD simples + alocar funcionário. Sem excluir (bom). |
| Materiais | Sim | Catálogo padrão de ~91 itens criado para cada empresa nova. Saldo editável direto no cadastro (ruim). |
| Estoque / movimentações | Parcial | Duas telas com comportamentos diferentes (ver 3). |
| Solicitações | Parcial | Genérica (só texto, sem material e quantidade). |
| Equipamentos / ferramentas | Parcial | Cadastro, transferência, envio para obra, manutenção, baixa, ficha PDF. Sem empréstimo/devolução. |
| EPIs | Sim | Cadastro, entrega, devolução, reposição, histórico. O mais completo. |
| Compras | Parcial | Itens, aprovação, recebimento, anexos. Recebimento não entra no estoque. |
| Perdas e ganhos | Parcial | Registro em texto (sem ligar ao material), sem aprovação, sem ajuste. Sem item de menu. |
| Ocorrências | **Não existe** → criado na Etapa 4.4 | |
| Documentos | Parcial | Central de documentos sem separação por empresa. Alerta de vencimento é texto fixo falso. |
| Relatórios / exportações | Sim | CSV, XLSX, PDF (~11 tipos), impressão. |
| Auditoria | Parcial | Duas tabelas de log (`audit_logs` e `auditoria`); logs podem ser apagados e forjados. |
| QR Code | Parcial | Gera QR num serviço externo (api.qrserver.com) e lê pela câmera; leitura sem empresa. |
| Configurações / admin SaaS | Parcial | Duas tabelas de empresa (`companies` e `empresas`). |
| *Extras fora do doc. mestre* | — | Frota (veículos etc.), Financeiro (contas, receitas, despesas), RH (equipes, escalas, treinamentos), Comercial (clientes, propostas). Vários "em desenvolvimento". |

## 2. Inventário de telas / rotas

37 rotas. Detalhe completo no anexo (§1). Pontos principais:

- **Rotas protegidas por cargo:** dashboard, obras, materiais, movimentações, estoque, saldo por
  funcionário, equipamentos, EPIs, fornecedores, compras, solicitações, funcionários, financeiro,
  documentos, relatórios, configurações, auditoria, segurança, gestão de acessos.
- **Rotas abertas a qualquer usuário logado** (basta digitar o endereço), a maioria sem item no menu:
  `/empresas` (permite **excluir empresa**), `/usuarios/:id`, `/clientes`, `/propostas`, `/qrcode`,
  `/perdas-ganhos`, `/financeiro/contas-pagar`, `/financeiro/contas-receber`, `/frota/*`, `/rh/*`,
  `/trainings`.
- **Menu e proteção de rota divergem:** a Diretoria vê "Gestão de Acessos" no menu e recebe "Acesso
  Negado"; "Cliente" tem menu mas não existe na proteção de rota.
- **Em desenvolvimento / sem ação:** escalas, licenciamentos, quilometragem, "Nova Equipe", botão
  "Registrar Título" (contas a pagar), exportação da auditoria, modo escuro, login social, formulário
  "Fale conosco" (finge que envia).

## 3. Mapa de fluxos implementados

| Fluxo do documento mestre | Situação |
|---|---|
| **(1) Consumível:** solicitação → análise → aprovação → separação → entrega → confirmação → baixa | Solicitação e aprovação existem; "análise" é só um status. **Separação e confirmação de recebimento não existem.** Entrega/baixa é feita à parte na tela Estoque, **sem ligação com a solicitação**. |
| **(2) Equipamento retornável:** solicitação → aprovação → entrega → uso → devolução → inspeção | **Não existe como fluxo.** Há transferir/enviar para obra/manutenção/baixa. Devolução e inspeção não existem (inspeção é só um tipo de manutenção). |
| **(3) Compra:** necessidade → solicitação → aprovação → pedido → recebimento → conferência → entrada | Aprovação e recebimento existem. Compra **não se liga** à solicitação. "Pedido emitido" é status manual. Conferência é só um total (não por item). **Entrada no estoque não acontece.** |
| **(4) Divergência:** registro com motivo → autorização → ajuste como nova operação | **Não existe.** "Ajuste de Estoque"/"Inventário" em Movimentações não mexe no saldo; o cadastro do material permite mudar o saldo sem registro. |
| Convite de funcionário (link "criar minha senha") | **Funciona no servidor** (testado: convite → dados → nova senha → login; link não pode ser reusado). E-mail sai pelo Brevo quando `BREVO_SMTP_LOGIN`/`BREVO_SMTP_KEY` estiverem nos Secrets do Fly.io. |
| Autocadastro de empresa | Funciona (testado). Cada empresa nasce com catálogo de materiais. |
| Esqueci minha senha | **Não funciona** (ver 6, item D3). |

**Estoque hoje tem dois caminhos com efeitos diferentes:**
- Tela **Estoque** (entrada/saída/retirada): cria a movimentação **e** atualiza o saldo — mas quem
  calcula o saldo é o navegador (lê, soma, grava), sem proteção contra dois usuários ao mesmo tempo.
- Tela **Movimentações**: cria e aprova movimentações **sem mudar o saldo** (inclusive Ajuste,
  Inventário e Perda).

## 4. Estado do banco e relações

- **67 tabelas.** 33 separadas por empresa (`company_id` + regra), 29 sem separação, 5 com regra própria.
- **Sem separação por empresa (29):** abastecimentos, aprovacoes_compra, auditoria, centro_custos,
  contas_pagar, contas_receber, despesas, documentos, documentos_central, empresa, empresas,
  epi_funcionario, equipe_funcionario, equipes, escala_funcionario, escalas, fluxo_caixa, licenciamentos,
  manutencoes, motoristas, notas_fiscais, pedidos_compra, perdas_ganhos, qrcode_leituras, quilometragem,
  recebimentos, receitas, solicitacoes_compra, veiculos.
- **Tabelas duplicadas** (mesmo assunto, duas ou três tabelas): `companies`/`empresas`/`empresa`;
  `veiculo`/`veiculos`; `epi_entrega`/`epis_entregas`/`epi_funcionario`; `compras`/`pedidos_compra`;
  `compras_aprovacao`/`aprovacoes_compra`; `compras_recebimento`/`recebimentos`; `qr_scans`/`qrcode_leituras`;
  `audit_logs`/`auditoria`; `manutencoes`/`equipamentos_manutencao`; `solicitacoes`/`solicitacoes_compra`;
  `financeiro`/`despesas`+`receitas`+`contas_*`; papéis em `roles`, `cargos`, `users.cargo`,
  `users.perfil_acesso` e `users.role`.
- **Campos misturados inglês/português na mesma tabela:** `movimentacoes` tem `type` e `tipo`;
  `solicitacoes` tem `status` com valores em inglês e português, `priority` e `prioridade`;
  `materiais` usa `quantity_in_stock`, `unit_cost`; `obraId` × `obra_id`, `funcionarioId` × `funcionario_id`.
- **Nenhum hook no servidor mexe no saldo** (`quantity_in_stock`). Todo cálculo de saldo é no navegador.
- **Dados de exemplo no banco do zip:** empresas "Default Company" e "Empresa Principal" (ids diferentes
  dos de produção). Se o volume do Fly for recriado, o banco volta a esse estado.

## 5. Matriz de permissões

Há **quatro sistemas de permissão que não batem entre si**:

1. **Servidor (regras do PocketBase)** usa `role` com valores `admin`, `viewer`, `financeiro`,
   `almoxarife`, `engenheiro`, `mestre_obras`. Mas o autocadastro grava `role = "Administrador"`, e o
   convite grava o cargo ("Funcionário", "Almoxarife"…). **Esses valores nunca batem** com os do servidor.
2. **Proteção de rota** nas telas usa `role || cargo` com outro mapa de cargos.
3. **Menu** usa uma cópia desse mapa, com diferenças.
4. **Cada tela** testa do seu jeito (`cargo === "Administrador"`, `includes("gerente")` — que não reconhece
   "Gerência" —, listas próprias de cargos).

Consequências comprovadas ou diretas:

| Ação | Quem deveria | O que acontece hoje |
|---|---|---|
| Aprovar/alterar solicitação | Administrador, Almoxarife, Engenheiro, Mestre | Servidor exige `role` = `admin`/`almoxarife`/`engenheiro`/`mestre_obras`. **Administrador de empresa nova não consegue** (testado: recusado). Só funciona para quem tiver `role = "admin"` gravado. |
| Excluir qualquer registro (obras, materiais, compras…) | Admin **da mesma empresa** | Servidor exige `role = "admin"` **sem checar empresa**. Admin de empresa nova não consegue; quem tem `role=admin` apaga de **qualquer** empresa. |
| Lançar no Financeiro | Financeiro/Admin | Exige `role` = `financeiro`/`admin` — ninguém recebe esses valores pelo app. |
| Alterar o próprio cadastro | Nome, telefone, foto | **Qualquer campo**, inclusive `role`, `cargo`, `status`, `is_blocked` (testado: funcionário virou Administrador e `admin`). |
| Criar usuário | Admin, só na própria empresa | Admin cria usuário **em qualquer empresa** (testado). |
| "Gerência" e "Engenheiro" em Movimentações/Estoque | Ver tudo | Tratados como funcionário comum (só veem os próprios registros). |
| Cargo digitado na Gestão de Acessos | Escolher da lista | É **texto livre**; telas que comparam o cargo exato não reconhecem. |
| Convite de Comprador, Financeiro, RH, Gerência, Diretoria | Manter o cargo | Vira `role = "Funcionário"`. |

O e-mail `dnmltda@hotmail.com` está escrito no código das telas (13 vezes) e nas regras do servidor
como "dono do sistema". Funciona, mas o ideal é um campo "superadmin" no banco em vez de e-mail fixo.

## 6. Funcionalidades: concluídas, parciais, ausentes, defeituosas

**Concluídas (testadas ou claramente completas):** autocadastro de empresa; convite de funcionário com
link (servidor); login; obras; catálogo de materiais por empresa; EPIs (entrega/devolução/reposição/
histórico); exportações CSV/XLSX/PDF; QR (gerar/ler); compras com itens, aprovação, anexos.

**Parciais:** solicitações (sem itens); movimentações (sem efeito no saldo); estoque (saldo calculado no
navegador); equipamentos (sem empréstimo/devolução); compras (recebimento não entra no estoque);
perdas e ganhos (texto livre, sem ajuste); documentos; auditoria; frota; financeiro; RH; configurações.

**Ausentes:** separação e confirmação de recebimento; empréstimo/devolução/inspeção de equipamento;
divergência de estoque; Ocorrências; alerta de estoque mínimo (já apontado no estudo do Easytool);
mostrar saldo de outras obras antes de comprar.

**Defeituosas (com evidência):**
- **D1.** Administrador de empresa nova não aprova solicitações (servidor recusa — seção 5).
- **D2.** Exclusões falham para o Administrador da empresa (só `role=admin` apaga) — as telas mostram
  botão de excluir.
- **D3.** "Esqueci minha senha" não funciona: a tela procura o usuário sem estar logada, o servidor não
  devolve nada (testado: lista vazia) e nenhum e-mail sai. O fluxo nativo do PocketBase
  (`request-password-reset`) existe e responde, mas as telas não o usam.
- **D4.** Bloqueio por tentativas de login não funciona: as telas tentam gravar o contador sem estar
  logadas e o servidor recusa (testado: 404).
- **D5.** Card de compras do dashboard conta status inexistentes ("Enviado", "Confirmado", "Pendente").
- **D6.** Toasts em inglês na tela Obras e em Configurações.
- **D7.** Alerta de documento a vencer é texto fixo ("Licença Ambiental - Obra Centro").
- **D8.** "Fale conosco" mostra "Mensagem enviada" sem enviar nada.
- **D9.** Pendência antiga (do documento de retomada): Diego não consegue editar o próprio cadastro de
  funcionário (separação `users` × `funcionarios`). **Não reproduzido nesta auditoria** — fica na lista.

## 7. Problemas de segurança e integridade

Ordenados por gravidade. "Testado" = reproduzido no ambiente local.

**Críticos**
- **S1. Qualquer usuário altera o próprio perfil para administrador** (testado). A regra de alteração de
  `users` deixa o próprio usuário mudar qualquer campo. Com `role = "admin"` ele passa a ver usuários de
  todas as empresas e a **apagar dados de qualquer empresa** (testado: apagou obra da Empresa B).
- **S2. 29 tabelas sem separação por empresa** (testado em 6 delas: B leu e apagou dados de A).
  Inclui financeiro (contas, receitas, despesas), documentos, veículos, equipes, auditoria.
- **S3. Regras de exclusão sem checar empresa** (`role = "admin"` apaga de todas).
- **S4. Admin de uma empresa cria usuários em outra** (testado).
- **S5. Qualquer usuário logado lista todas as empresas** com CNPJ, e-mail e telefone (testado).
- **S6. Token de convite visível para colegas da mesma empresa.** O campo `password_reset_token` não é
  oculto; um colega que listar usuários pode usar o link de convite de outra pessoa e criar a senha dela.

**Altos**
- **S7. Logs de auditoria podem ser apagados** por qualquer usuário (testado) e **forjados por visitante
  sem login** em `audit_logs` (testado). O log também não guarda empresa e grava IP fixo `127.0.0.1`.
- **S8. Saldo de estoque calculado no navegador:** sem transação, sujeito a corrida e a erro no meio.
- **S9. Servidor aceita saída maior que o saldo** (testado) e **movimentação registrada pode ser
  editada** (testado) — o histórico não é imutável.
- **S10. Exclusão definitiva (hard delete)** em 17 lugares das telas (materiais, funcionários, usuários,
  empresas, solicitações, compras, EPIs, equipamentos, fornecedores, clientes…). O documento mestre
  exige inativar.
- **S11. Rota `/empresas` aberta a qualquer usuário logado**, com botão de excluir empresa.

**Médios**
- **S12. Dados enviados a terceiros:** o QR Code é gerado em `api.qrserver.com` (o conteúdo do item vai
  para fora). Melhor gerar no próprio navegador.
- **S13. Atualizações ao vivo (`subscribe("*")`) sem filtro de empresa** em compras, solicitações,
  equipamentos, usuários e empresas.
- **S14. Banco da cópia antiga na Hostinger em pasta temporária** — irrelevante se ela for desligada
  (recomendado: desligar o app Node.js `midnightblue-chamois` para não confundir).
- **S15. Chave antiga do Brevo** continua no histórico público do GitHub. Precisa estar **apagada na
  Brevo** (só o Diego confirma isso).

## 8. Comparação com o documento mestre

| Regra / critério do documento mestre | Atende? |
|---|---|
| Nenhuma movimentação some silenciosamente | Não — movimentação pode ser editada; saldo pode mudar sem movimentação |
| Exclusão nunca compromete o histórico (inativar) | Não — 17 exclusões definitivas |
| Operações críticas transacionais | Não — saldo é gravado pelo navegador em duas chamadas separadas |
| Permissão validada no servidor, não só escondida na tela | Não — várias rotas só escondem; servidor tem regras inconsistentes |
| Dados de empresas sempre isolados | Não — S1 a S5 |
| Divergência é nova operação, nunca apaga histórico | Não — fluxo inexistente |
| 4 fluxos formais | Nenhum completo (ver 3) |
| Cargos: Administrador, Almoxarife, Engenheiro, Mestre, Funcionário, Diretoria | Existem, mas Diretoria não está na Gestão de Acessos e o servidor não reconhece os nomes |
| Consumível × retornável | Não há distinção no cadastro de material |
| 16 módulos | 12 existem (vários parciais); Ocorrências não existe |
| Uma única instância PocketBase / sem `getFirstListItem` | **Sim** |
| Sem "Test Data" | **Sim** (mas há textos fixos falsos — D7, D8) |
| Texto livre → seleção | Pendente em Gestão de Acessos (Cargo, Departamento), Movimentações (Categoria, Unidade, Centro de Custo, Origem, Destino), Perdas e Ganhos (Item), Contas a Receber (Cliente), EPI (Setor, Cargo), Equipamentos (Local) |
| Identidade visual (azul-marinho/dourado/coroa) | Não avaliado nesta auditoria (precisa ver as telas no navegador) |
| Comprovado por teste | Esta auditoria cria o primeiro conjunto de testes automáticos (seção 10) |

## 9. Plano de correção priorizado

Cada etapa é pequena, testada localmente (mesmo método do documento de retomada) antes de ir para
produção, e não muda telas sem necessidade.

**Etapa 1 — Segurança e separação entre empresas (servidor apenas; urgente, antes de abrir para clientes)**
1. `users`: o próprio usuário só altera nome, telefone, foto e senha. `role`, `cargo`, `perfil_acesso`,
   `company_id`, `status`, `is_blocked`, `is_active`, `login_attempts` só o Administrador **da mesma
   empresa**. Criar usuário só na própria empresa. Ocultar `password_reset_token` e `remember_token`.
2. `companies`: cada um vê só a própria empresa (o dono do sistema vê todas).
3. Regras de exclusão: sempre com checagem de empresa.
4. Adicionar `company_id` + regras nas tabelas sem separação **que as telas usam** (perdas_ganhos,
   veiculos, contas_receber, contas_pagar, receitas, despesas, documentos_central, documentos, equipes,
   abastecimentos, manutencoes, licenciamentos, cargos se forem por empresa, qrcode_leituras,
   auditoria/audit_logs). Preencher os registros existentes com a empresa principal
   (`cjly25lkal4kq1a`) antes de exigir o campo.
5. `audit_logs`/`auditoria`: criar só logado, nunca alterar nem apagar; gravar empresa.
6. Padronizar o papel: decidir **um** campo de permissão (sugestão: `cargo`, com a lista oficial) e
   reescrever as regras do servidor com esses nomes. Corrige D1 e D2.

**Etapa 2 — Estoque confiável (servidor)**
7. Hook no servidor: o saldo só muda quando uma movimentação é aprovada/finalizada; recusa saldo
   negativo; movimentação registrada não pode ser editada (cancelar = nova operação de estorno).
8. Recebimento de compra gera a movimentação de entrada automaticamente.
9. Telas: tirar o campo saldo do cadastro de material; tela Estoque passa a só criar movimentação.

**Etapa 3 — Correções de telas que quebram (precisa do código-fonte)**
10. "Esqueci minha senha" usando o fluxo nativo do PocketBase (e-mail pelo Brevo).
11. Proteger `/empresas` e as rotas abertas; alinhar menu, rotas e telas num único mapa de permissões.
12. Trocar exclusões definitivas por inativação.
13. Textos livres → seleção (lista da seção 8). Toasts em português. Remover textos falsos (D7, D8).

**Etapa 4 — Fluxos que faltam (documento mestre)**
14. Solicitação com itens (material + quantidade) → separação → entrega → confirmação → baixa.
15. Empréstimo de equipamento com devolução e inspeção.
16. Divergência de estoque com motivo e autorização.
17. Alerta de estoque mínimo; saldo de outras obras antes de comprar; Ocorrências.

**Etapa 5 — Limpeza**
18. Unificar tabelas duplicadas e campos inglês/português (com migração de dados).
19. QR Code gerado no próprio app; "superadmin" como campo em vez de e-mail fixo.

**Pré-requisito para as etapas 3 a 5:** colocar o **código-fonte das telas** (`~\Documents\appobra-app`)
no GitHub. Sem ele, só dá para mexer no servidor.

## 10. Plano de testes de regressão

Script: `docs/auditoria/testes/audit_tests.py` (Python, sem dependências). Roda contra um PocketBase
local isolado; cria duas empresas e verifica cada regra. **Deve ser rodado antes de cada publicação.**
Hoje: 10 aprovados, 21 reprovados — a meta da Etapa 1 é zerar os reprovados de isolamento e permissão.

Casos cobertos hoje:
- Isolamento: empresa não vê outras empresas, nem usuários de outra; não cria usuário em outra; B não vê
  nem apaga registros de A em perdas_ganhos, veiculos, contas_pagar, auditoria, equipes,
  documentos_central, pedidos_compra.
- Permissão: funcionário não se promove; não muda de empresa; não aprova solicitação; admin aprova.
- Estoque: entrada soma no saldo; saída maior que o saldo é recusada; movimentação não é editável.
- Auditoria: log não pode ser apagado; visitante não grava log.

Testes manuais feitos nesta auditoria (incluir no script na Etapa 1):
- Funcionário com `role=admin` apaga obra de outra empresa → hoje **apaga** (falha).
- Convite: criar → ver dados → criar senha → login → reusar link é recusado → **aprovado**.
- "Esqueci minha senha" sem login → hoje não encontra o usuário (falha funcional).
- Contador de tentativas de login sem login → hoje recusado (falha funcional).

A acrescentar nas próximas etapas: aprovação de compra → recebimento → entrada no estoque; solicitação
com itens até a baixa; empréstimo e devolução de equipamento; divergência; exclusão vira inativação.

Como rodar: ver `docs/auditoria/testes/README.md`.
