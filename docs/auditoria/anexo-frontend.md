# Auditoria do Frontend (bundle) — APP OBRA

Fonte analisada: `pb_public/assets/index-qr36PMAX.js` (2,99 MB, minificado, gerado pelo Hostinger Horizons), mais `index.html`, `llms.txt`, `.htaccess` e os chunks auxiliares (`html2canvas`, `purify`, `index.es` = core-js). Não existe código-fonte: todas as evidências abaixo são trechos do bundle (com o offset em bytes `@N` quando ajuda a localizar). Os nomes de variáveis são os nomes minificados.

Backend: `const Doe="https://appobra-backend.fly.dev",He=new RW(Doe)` (@240295). `RW` é a classe do SDK PocketBase.

---

## 1. Rotas e telas

Router em `iGe()` (@2979775). `Jn` é o guard. Ele aceita `requiredRoles` (lista) e/ou `module`. Quando não recebe nenhum dos dois, exige apenas login.

Lógica do guard (@451896):
```
c=n?.role||n?.cargo,
u=t.length===0||t.includes(c)||c==="admin"||c==="Administrador",
f=Qhe(c,r)   // Qhe: admin/Administrador => true; senão (Zhe[c]||["dashboard"]).includes(module)
```
O guard também bloqueia `status==="Bloqueado"` e `status==="Inativo"` e registra no log "Acesso negado".

| Rota | Componente | Guard | Quem acessa |
|---|---|---|---|
| `/` | t2e (landing/login) | público | todos |
| `/login` | W2e | público | todos |
| `/reset-password` | nGe | público | todos |
| `/ativar-conta` | aGe | público | todos |
| `/dashboard` | nq | module `dashboard` | todos os cargos do mapa; cargos desconhecidos caem no padrão `["dashboard"]` |
| `/projects` | q8e (Obras) | module `obras` | Diretoria, Gerência, Engenheiro, Mestre de Obras, admin |
| `/materiais` | wHe | module `materiais` | Gerência, Engenheiro, Mestre, Almoxarife, admin |
| `/movimentacoes` | OHe | module `movimentacoes` | Almoxarife, Faxina, admin |
| `/estoque` | DHe | module `estoque` | Diretoria, Gerência, Engenheiro, Mestre, Almoxarife, Comprador, Faxina, admin |
| `/saldo-funcionario` | BHe | module `saldo_funcionario` | Diretoria, Gerência, Engenheiro, Mestre, Almoxarife, Pedreiro, Servente, Encanador, Eletricista, admin |
| `/equipamentos` | VHe | module `equipamentos` | Engenheiro, Mestre, Almoxarife, Pedreiro, Servente, Encanador, Eletricista, admin |
| `/rh/epis` | VWe | module `epis` | Mestre, Almoxarife, RH, Pedreiro, Servente, Encanador, Eletricista, admin |
| `/suppliers` | V8e | module `fornecedores` | Almoxarife, Comprador, admin |
| `/compras`, `/compras/:id`, `/compras/:id/editar` | DH / pWe | module `compras` | Gerência, Engenheiro, Almoxarife, Comprador, Financeiro, admin |
| `/compras/solicitacoes` | redireciona para `/solicitacoes` | — | — |
| `/solicitacoes`, `/:id`, `/:id/editar` | VH / _We | module `solicitacoes` | Mestre, Almoxarife, Comprador, Funcionário, Pedreiro, Servente, Encanador, Eletricista, Faxina, admin |
| `/employees` | z8e | module `funcionarios` | Mestre, RH, admin |
| `/financeiro/dashboard` | FWe | module `financeiro` | Diretoria, Gerência, Financeiro, admin |
| `/documentos` | uHe | module `documentos` | Diretoria, Gerência, Engenheiro, RH, admin |
| `/relatorios` | _Ve | module `relatorios` | Diretoria, Gerência, Engenheiro, Financeiro, admin |
| `/settings` | cIe | module `configuracoes` | Diretoria, admin |
| `/auditoria` | wIe | `requiredRoles:["admin","Administrador","Diretoria"]` | admin, Administrador, Diretoria |
| `/admin/security` | bIe | `requiredRoles:["admin","Administrador"]` | admin |
| `/usuarios`, `/usuarios/:id/editar` | GH | `requiredRoles:["admin","Administrador"]` | admin |
| `/usuarios/:id` | LWe | **só login** | qualquer usuário logado |
| `/notificacoes`, `/profile` | uIe, vIe | só login | qualquer usuário logado |
| `/qrcode` | lHe | **só login** | qualquer usuário logado |
| `/perdas-ganhos` | cHe | **só login** | qualquer usuário logado |
| `/financeiro/contas-pagar`, `/financeiro/contas-receber` | BWe, rGe | **só login** | qualquer usuário logado (o financeiro tem module, estes não) |
| `/clientes`, `/propostas` | pHe, SHe | **só login** | qualquer usuário logado |
| `/empresas`, `/empresas/:id`, `/empresas/:id/editar` | CH, aWe | **só login** | qualquer usuário logado |
| `/trainings` | $We | só login | qualquer usuário logado |
| `/rh/equipes`, `/rh/escalas`, `/rh/documentos` | HWe, WWe, GWe | só login | qualquer usuário logado |
| `/frota/dashboard`, `veiculos`, `abastecimentos`, `manutencoes`, `licenciamentos`, `quilometragem` | YWe…JWe | só login | qualquer usuário logado |
| `*` | nq (Dashboard) | só login | qualquer usuário logado |

Mapa de permissões do guard, `Zhe` (@451896):
```
Diretoria:[dashboard,obras,financeiro,rh,documentos,auditoria,configuracoes,relatorios,estoque,saldo_funcionario]
Gerência:[dashboard,obras,materiais,compras,financeiro,rh,documentos,relatorios,estoque,saldo_funcionario]
Engenheiro:[dashboard,obras,materiais,compras,documentos,equipamentos,relatorios,estoque,saldo_funcionario]
"Mestre de Obras":[dashboard,obras,materiais,funcionarios,equipamentos,epis,solicitacoes,estoque,saldo_funcionario]
Almoxarife:[dashboard,materiais,movimentacoes,compras,fornecedores,epis,equipamentos,solicitacoes,estoque,saldo_funcionario]
Comprador:[dashboard,compras,solicitacoes,fornecedores,estoque]
Financeiro:[dashboard,financeiro,compras,relatorios]
RH:[dashboard,rh,funcionarios,epis,documentos]
Funcionário:[dashboard,solicitacoes]
Pedreiro/Servente/Encanador/Eletricista:[dashboard,solicitacoes,saldo_funcionario,epis,equipamentos]
Faxina:[dashboard,solicitacoes,estoque,movimentacoes]
```

### Menu lateral (`Exe`, @533042)
Itens: Dashboard `/dashboard`, Obras `/projects`, Materiais, Estoque, Movimentações, Saldo por Funcionário, Equipamentos, EPIs `/rh/epis`, Fornecedores `/suppliers`, Compras, Solicitações, Funcionários `/employees`, Financeiro `/financeiro/dashboard`, Documentos, Relatórios, Configurações `/settings`, Auditoria, Cadastro de Empresas `/empresas`, Gestão de Acessos `/usuarios`. Os grupos são GESTÃO, SUPRIMENTOS, FLUXO DE COMPRA, PESSOAS e EMPRESA.

Visibilidade: `i||c==="admin"||c==="Administrador"?!0:({...}[c]||["dashboard"]).includes(id)`. O mapa do menu é uma **cópia** do mapa do guard, com diferenças:
- **Diretoria** vê no menu `empresas` e `usuarios`. `/usuarios` exige admin, então a Diretoria clica e recebe "Acesso Negado". `/empresas` não tem guard de cargo, então a Diretoria (e qualquer usuário que digite a URL) consegue abrir.
- **Cliente** aparece no menu com `["dashboard","obras"]`, mas não existe no mapa do guard. `/projects` devolve "Acesso Negado" para Cliente.
- Rotas **sem item de menu** (órfãs), que qualquer usuário logado abre digitando a URL: `/qrcode`, `/perdas-ganhos`, `/clientes`, `/propostas`, `/trainings`, `/rh/equipes|escalas|documentos`, `/frota/*`, `/financeiro/contas-pagar|receber` (estas duas são linkadas a partir do dashboard financeiro).

---

## 2. Módulos

| Módulo | Rotas |
|---|---|
| Auth / usuários / acessos | `/login`, `/reset-password`, `/ativar-conta`, `/profile`, `/usuarios*`, `/admin/security`, `/notificacoes` |
| Dashboard | `/dashboard`, `*` |
| Obras | `/projects` (CRUD simples e alocação de funcionário na obra) |
| Materiais | `/materiais` |
| Estoque / movimentações | `/estoque` (entrada, saída e retirada com efeito no saldo), `/movimentacoes` (registro com status, **sem efeito no saldo**), `/saldo-funcionario` (posse por funcionário e devolução) |
| Solicitações | `/solicitacoes*` (genéricas: Material, Compra, Equipamento, Ferramenta, EPI, Financeiro, RH, Transporte, Documento, Manutenção, Administrativo, Outro) |
| Equipamentos / ferramentas | `/equipamentos` (cadastro, transferência, envio para obra, manutenção, baixa, ficha em PDF) |
| EPIs | `/rh/epis` (cadastro, entrega, devolução, reposição, histórico) |
| Compras | `/compras*` (itens, aprovação, recebimento, anexos), `/suppliers` |
| Perdas e ganhos | `/perdas-ganhos` (Quebra, Extravio, Avaria, Sobra, Recuperação) |
| Ocorrências | **não existe**: nenhuma ocorrência de "ocorrência" no bundle |
| Documentos | `/documentos` (central), `/rh/documentos` (somente lista) |
| Relatórios / exportações | `/relatorios` (CSV, PDF, impressão) e exportações espalhadas pelas telas (ver §6) |
| Auditoria | `/auditoria` (coleção `audit_logs`) e `auditoria` (coleção legada, usada em Configurações) |
| QR Code | `/qrcode` (gera via api.qrserver.com e lê com html5-qrcode) |
| Configurações / admin SaaS | `/settings` (coleção `companies`), `/empresas*` (coleção `empresas`), `/admin/security` |
| Veículos / frota | `/frota/veiculos` (CRUD), abastecimentos e manutenções (somente lista), licenciamentos e quilometragem ("Em Desenvolvimento"), dashboard |
| Financeiro | `/financeiro/dashboard`, contas a pagar (somente lista, botão sem ação), contas a receber (CRUD) |
| Funcionários / RH | `/employees`, `/trainings`, `/rh/equipes` (somente lista; "Nova Equipe" desabilitado), `/rh/escalas` ("Módulo em Desenvolvimento") |
| Comercial | `/clientes`, `/propostas` |

---

## 3. Uso do backend por módulo

Operações contadas por coleção (apenas chamadas do app; as variáveis já foram resolvidas: `jh`=solicitacoes, `jf`=compras, `Dd`=users, `cp`=empresas, `d_`=compras_itens, `IH`=compras_recebimento, `OH`=compras_aprovacao, `UH`=solicitacoes_aprovacao, `uT`=solicitacoes_anexos, `cT`=compras_anexos):

| Coleção | Operações |
|---|---|
| users | getFullList 20, getList 3+2, getOne 3, update 14+6, create 1+1, delete 1, subscribe, authWithPassword 4 |
| funcionarios | getFullList 10, getList 3, create, update 2, delete |
| obras | getFullList 12, getList, create, update (sem delete) |
| materiais | getFullList 6, getList 2, create, update 4, delete |
| movimentacoes | getList 5, getFullList 2, create 4, update 3, subscribe 2 |
| saldo_funcionario | create 2, getFullList, subscribe |
| solicitacoes | getList, getOne, create, update 5, delete, subscribe |
| solicitacoes_aprovacao / _anexos | getFullList, create (e delete em anexos) |
| compras | getList 2, getFullList, getOne, create, update 6, delete, subscribe |
| compras_itens | getFullList, create, update, delete |
| compras_aprovacao / compras_recebimento / compras_anexos | getFullList, create (e delete em anexos) |
| equipamentos | getList 2, getFullList, create, update 6, delete, subscribe |
| equipamentos_historico / equipamentos_manutencao | getFullList, create (e update em manutenção) |
| epis | getFullList, create, update 4, delete |
| epis_entregas | getFullList, create, update |
| epis_devolucoes / epis_reposicoes / epis_historico | getFullList, create |
| fornecedores | getFullList 7, create, update, delete |
| empresas | getList 2, getOne 2, create, update 3, delete 2, subscribe |
| companies | getFullList, getOne 2, update |
| clientes | getList 2, getFullList 2, create, update, delete |
| propostas | getList 2, create, update 2, delete |
| contas_receber | getFullList, create, update 2, delete |
| contas_pagar, receitas, despesas | somente getFullList |
| veiculos | getFullList 2, getList, create, update, delete |
| abastecimentos, manutencoes, licenciamentos, equipes, documentos, cargos | somente leitura |
| treinamentos | getFullList 4, create, update, delete |
| documentos_central | getFullList, create |
| perdas_ganhos | getFullList, create |
| qrcode_leituras | create |
| relatorios_exportados | create |
| notificacoes | getList 2, getFullList, update 2, delete 3, subscribe |
| audit_logs | create 2, getList 6 |
| auditoria (legada) | getList 1 |

Há também uma referência a `solicitacoes_compra` (em `aq` e em `fetchCounts` de usuários). Não está claro se a coleção existe ao lado de `solicitacoes` (incerto).

### Payloads de criação (chaves exatas)

**solicitacoes** (função `X`, @2778738), mais `criado_por` e `atualizado_por`:
`numero_solicitacao, company_id, tipo, categoria, solicitante_id, departamento, centro_custo, obra_id, responsavel_id, prioridade, descricao, justificativa, data_solicitacao, data_prazo, status ("Aberta"), observacoes`.
Não há `material_id`, quantidade nem itens: a solicitação é só texto.
- Cancelar: `{status:"Cancelada", observacoes:"... [Cancelamento] motivo", atualizado_por}`. Concluir: `{status:"Concluída"}`.
- **solicitacoes_aprovacao**: `company_id, solicitacao_id, nivel_aprovacao, usuario_id, data_aprovacao, hora_aprovacao, status_aprovacao, observacao, criado_por`. Em seguida faz `solicitacoes.update` para `{status:"Aprovada", responsavel_id}` ou `{status:"Rejeitada"}`.
- **solicitacoes_anexos** (FormData): `company_id, solicitacao_id, tipo_anexo, arquivo, descricao, criado_por`.

**movimentacoes**
- Tela Movimentações (`OHe`, @2510094): `data, hora, tipo, material_id, categoria, codigo, quantidade, unidade, valor_unitario, valor_total, obra_id, centro_custo, origem, destino, fornecedor_id, solicitante_id, responsavel_id, funcionario_id, observacoes, status ("Pendente"), company_id, atualizado_por`, mais `numero_movimentacao` e `criado_por` na criação. Cancelamento: `{status:"Cancelado", motivo_cancelamento}`. Troca de status: `{status: "Aprovado"|"Finalizado"}`.
- Tela Estoque, entrada (@2553449): `numero_movimentacao, data, hora, tipo:"Entrada", material_id, categoria, codigo, quantidade, unidade, valor_unitario, valor_total, origem:"Almoxarifado", fornecedor_id, responsavel_id, observacoes, status:"Aprovado", company_id, criado_por`. Depois faz `materiais.update({quantity_in_stock: atual+qtd, unit_cost?, supplier_id?})`.
- Tela Estoque, saída ou retirada (@2555819): as mesmas chaves, com `tipo` igual a "Saída", "Consumo de Obra" ou "Retirada por Funcionário", `obra_id`, `destino` ("Obra"/"Funcionário"/"Saída") e `funcionario_id`. Depois faz `materiais.update({quantity_in_stock: atual-qtd})`.
- **saldo_funcionario**: `company_id, funcionario_id, material_id, tipo_operacao ("Retirada"|"Devolução"), quantidade, data_operacao, hora_operacao, obra_id, movimentacao_id, responsavel_id, observacoes, criado_por`.

**materiais** (FormData, @2451900): `name, code, description, category, marca, unit, quantity_in_stock, min_quantity, unit_cost, supplier_id, status, company_id, foto`. A edição reenvia `quantity_in_stock` (ver §6).

**obras** (@1156572): `{...{nome, descricao, status:"Planejamento", dataInicio, dataFim}, company_id}`. A alocação é feita com `funcionarios.update(id,{obraId})`.

**compras** (função `L`, @2713284): `numero_compra, company_id, fornecedor_id, obra_id, solicitante_id, comprador_id, categoria, subcategoria, centro_custo, prioridade, justificativa, observacoes, descricao, data_solicitacao, data_entrega_prevista, data_entrega_real, status ("Solicitado"), valor_previsto, valor_aprovado, valor_final, forma_pagamento, parcelas, responsavel_aprovacao_id, data_aprovacao`, mais `criado_por` e `atualizado_por`.
- **compras_itens**: `company_id, compra_id, material_id, codigo, descricao, unidade, quantidade, preco_unitario, desconto, frete, ipi, icms, valor_total, fornecedor_id, observacoes, criado_por`.
- **compras_aprovacao**: igual à aprovação de solicitação, com `compra_id`. Aprovado leva a `compras.status="Aprovado"`. Rejeitado leva a `"Cancelado"`.
- **compras_recebimento** (FormData): `company_id, compra_id, numero_recebimento, data_recebimento, hora_recebimento, responsavel_id, quantidade_recebida, quantidade_prevista, status_recebimento, observacoes, criado_por, foto_recebimento`. Depois faz `compras.update({status:"Recebido"|"Parcialmente Recebido", data_entrega_real})`. **Nenhuma movimentação nem atualização de estoque é feita.**

**epis_entregas** (`gt`, @2918xxx): `funcionario_id, obra_id, setor, cargo, centro_custo, data_entrega, hora_entrega, responsavel_id, epi_id, quantidade, tamanho, ca_utilizado, lote, validade, prazo_troca, data_prevista_devolucao, situacao ("Entregue"), assinatura_digital, observacoes`, mais `numero_entrega, company_id, criado_por, atualizado_por`. Depois faz `epis.update({quantidade_estoque: atual-qtd})`.
- **epis_devolucoes**: `entrega_id, funcionario_id, data_devolucao, hora_devolucao, responsavel_id, motivo, estado_epi, aprovado_reutilizacao, descartado, necessita_manutencao, necessita_higienizacao, observacoes, numero_devolucao, company_id, criado_por, atualizado_por`. Depois faz `epis_entregas.update({situacao:"Devolvido"})` e, quando a reutilização é aprovada, devolve ao `quantidade_estoque`.
- **epis**: `codigo, nome, descricao, categoria, marca, modelo, fabricante, fornecedor_id, numero_ca, validade_ca, norma_regulamentadora, tamanho, cor, material, quantidade_estoque, estoque_minimo, unidade, valor_unitario, valor_medio, local_armazenamento, observacoes, status, tipo, id_unico ("EPI-<timestamp>-<random>"), company_id, criado_por, atualizado_por, data_atualizacao, data_criacao`.

**equipamentos** (FormData, `oT` + `pr()`): `numero_patrimonial, codigo_interno, codigo_qr, codigo_barras, nome, descricao, categoria, marca, modelo, fabricante, numero_serie, fornecedor_id, data_compra, nota_fiscal, garantia, vida_util, valor_compra, valor_atual, depreciacao, estado_conservacao, situacao, local_atual, obra_atual_id, responsavel_id, funcionario_id, centro_custo, observacoes, company_id, atualizado_por, criado_por`, mais os arquivos `fotos[]`, `documentos[]`, `manual` e `certificados[]`.
- **equipamentos_historico**: `company_id, equipamento_id, data, hora, usuario_id, alteracao_realizada, local_anterior, local_atual, responsavel_anterior_id, novo_responsavel_id, obra_anterior_id, nova_obra_id, status_anterior, novo_status, detalhes`.
- **equipamentos_manutencao**: `company_id, equipamento_id, tipo, custos, fornecedor_id, data_prevista, data_realizada, proxima_manutencao, descricao, responsavel_id, status, observacoes, criado_por, atualizado_por`.

**funcionarios** (FormData, @1142022): `matricula, nome, nome_completo, id_unico, company_id, cargoId, hierarquia, departamento, telefone, obraId, status, dataAdmissao, cpf, email, foto`.

**users**
- `AuthContext.createUser` (@250634, usado no convite a partir de Funcionários): `email, password, passwordConfirm, name, username, id_unico, cargo, role, telefone, company_id, status, is_active, is_blocked, login_attempts, created_by, funcionario_id, password_reset_token, password_reset_expires`.
- Gestão de Acessos (`se`, @2827274): `nome_completo, name, email, username, id_unico, cargo, perfil_acesso, departamento, centro_custo, company_id, obra_vinculada_id, telefone, cpf, rg, data_admissao, data_demissao, status, is_active, is_blocked, observacoes, role (=perfil_acesso||cargo)`, mais `password, passwordConfirm, login_attempts, created_by, updated_by, foto`.

**Outros**
- **perdas_ganhos**: `tipo, item_nome, quantidade, data, motivo, valor_estimado, status:"Registrado", localizacao, descricao, responsavel_id, company_id`.
- **qrcode_leituras**: `qrcode_id, item_tipo, usuario_id, localizacao:"Canteiro Central", acao:"Leitura"`, **sem company_id**.
- **documentos_central** (FormData): `nome, tipo, descricao, tags, acesso, categoria, data_vencimento, arquivo, responsavel_id, versao`, **sem company_id**.
- **audit_logs** (`Er`, @241935): `usuario_id, usuario, perfil, data, hora, acao, modulo, detalhes, navegador, user_agent, ip_address:"127.0.0.1", status`, **sem company_id**. `LW` grava logs sem autenticação (`usuario_id:null`, `perfil:"Não Autenticado"`).
- **contas_receber**: `cliente (texto), descricao, valor, data_vencimento, status, data_recebimento, observacao, company_id`.
- **veiculos**: `placa, marca, modelo, ano, cor, tipo, chassi, renavam, combustivel, capacidade_carga, status, company_id, id_unico:"VEI-<timestamp>"`.
- **relatorios_exportados**: `tipo_relatorio, formato, usuario_id, company_id`.

### Endpoints customizados
- `POST /api/custom/self-register-company` com `{companyName, adminName, cpfCnpj, adminEmail, username, password}` (@677884).
- `POST /api/custom/get-invite-details` com `{token}`.
- `POST /api/custom/activate-invite` com `{token, password, passwordConfirm}`.
- Os demais `/api/...` do bundle (backups, crons, settings, logs) pertencem ao SDK e não são chamados pelo app.

---

## 4. Filtros por empresa (multi-tenant)

A maior parte das listas monta o filtro com `company_id = "${...}"`, por exemplo materiais `ne()`, movimentações `kt()`/`lt()`, equipamentos `Te()`, clientes, propostas, EPIs (`K`), frota, relatórios e dashboard. Algumas filtram pela relação: receitas e despesas usam `obraId.company_id`.

**Consultas SEM filtro de empresa**, que dependem só das regras do servidor:

| Local | Consulta | Evidência |
|---|---|---|
| Lista de Compras | `compras.getList(...,{filter:J\|\|""})` | `mWe` monta busca, status, prioridade, obra, fornecedor, datas e valores, **sem company_id** (@2713284) |
| Lista de Solicitações | `solicitacoes.getList(...,{filter:_e\|\|""})` | `wWe` também sem company_id (@2776607); não filtra por solicitante, então um Funcionário vê todas |
| Central de Documentos | `documentos_central.getFullList({filter:E})` | `E` é só `categoria = "..."`; o create também não envia company_id (@2417100) |
| Auditoria | `audit_logs.getList(...,{filter:N})` | filtros de data, ação, módulo, usuário e status; o log não tem company_id |
| Históricos (Empresas, Compras, Solicitações, Usuários) | `audit_logs.getList(1,20,{filter:'modulo = "Compras" && detalhes ~ "${id}"'})` | a busca é feita por texto |
| Configurações | `users/funcionarios/obras.getList(1,1,{$autoCancel:!1})` sem filtro; `auditoria.getList({filter:'modulo = "settings"'})` | @1182048 |
| Gestão de Acessos | `obras.getFullList({sort:"nome"})` sem filtro | @2823999 |
| Cadastro de Empresas | `empresas.getList({filter:B\|\|""})` | é a visão do admin SaaS, mas a rota não tem guard de cargo |
| Cargos | `cargos.getFullList({$autoCancel:!1})` | @1138421; pode ser global (incerto) |
| Itens, aprovações, recebimentos e anexos | filtram por `compra_id` ou `solicitacao_id` | aceitável quando o pai é protegido |
| Unicidade e login | `users` por email, username, id_unico ou token, sem empresa | o login roda **antes** de autenticar (ver §6) |
| Realtime | `compras`, `solicitacoes`, `equipamentos`, `users`, `empresas` com `subscribe("*")` | sem filtro; `users` filtra no cliente (`se.record.company_id===t.company_id`) |

---

## 5. Controle de acesso no front

Há **quatro mecanismos diferentes e inconsistentes**:
1. **Guard de rota** (`Jn`/`Zhe`): usa `currentUser.role || currentUser.cargo`.
2. **Menu** (`Exe`): usa uma cópia do mapa com divergências (Diretoria→empresas/usuarios, Cliente).
3. **Flags por tela**, cada uma com regra própria:
   - Movimentações e Estoque (`kHe`/`RHe`, @2503623) usam `role||cargo` em minúsculas com `includes("gerente")`, `"mestre"`, `"diretor"`, `"almoxar"` e `"comprad"`. O cargo real é "**Gerência**", e `"gerência".includes("gerente")` dá false. Engenheiro também não é reconhecido. Os dois ficam como `isFuncionario` e veem só os próprios registros.
   - Equipamentos (`VHe`): `n==="Gerência"||"Gerente"||"Engenheiro"`; `canDelete` e `canBaixa` só para admin ou Diretoria.
   - Solicitações (@2776607): usa **`e?.cargo`**, não `role`. `canManage` só para Administrador. `canEdit` para Gerente, Gerência ou Supervisor. `canApprove` para esses e Engenheiro.
   - Compras: `canEdit` para Administrador, Gerente, Gerência ou Comprador. `canApprove` para Administrador, Gerente, Gerência ou Engenheiro.
   - EPIs: `["Técnico de Segurança","Almoxarife","Gerência","Gerente","RH"]`.
   - Empresas: `oe=t||cargo==="Administrador"||cargo==="Gerência"`; `H=t||cargo==="Administrador"`.
4. **isAdmin / isMasterAdmin** (@254533):
```
isMasterAdmin:t?.email==="dnmltda@hotmail.com",
isAdmin:t?.role==="admin"||t?.cargo==="Administrador"||t?.username==="dnmltda"||t?.email==="dnmltda@hotmail.com"
```
Quando o usuário é carregado, o front reescreve `role` (@244189): `he=ae.email==="dnmltda@hotmail.com"||ae.username==="dnmltda"||ae.cargo==="Administrador"; ae.role=he?"admin":ae.role||ae.cargo||"Funcionário"`.

Strings de cargo e perfil encontradas: `admin, Administrador, Diretoria, Gerência, Gerente, Supervisor, Engenheiro, Mestre de Obras, Almoxarife, Comprador, Financeiro, RH, Técnico de Segurança, Funcionário, Pedreiro, Servente, Encanador, Eletricista, Faxina, Cliente, user`.
- Perfis da Gestão de Acessos: `HH=["Administrador","Gerência","Engenheiro","Mestre de Obras","Almoxarife","Comprador","Financeiro","RH","Funcionário","Cliente"]`. "Diretoria" não está na lista.
- Convite a partir de Funcionários: `D8e=["Administrador","Funcionário","Engenheiro","Almoxarife","Mestre de Obras","Pedreiro","Servente","Encanador","Eletricista","Faxina"]` com `iq=e=>D8e.includes(e)?e:"Funcionário"`. Um funcionário com cargo Comprador, Financeiro, RH, Gerência ou Diretoria ganha **role "Funcionário"**.
- Níveis de aprovação: `["Funcionário","Supervisor","Engenheiro","Gerente","Administrador"]` (escolha livre do usuário).
- Na Gestão de Acessos o campo **Cargo é texto livre** (`placeholder:"Ex.: Engenheiro Civil"`). As telas que testam `cargo===` (Solicitações, Compras, Empresas) não reconhecem esse valor.

---

## 6. Problemas visíveis

**Segurança e autenticação**
- **Reset de senha feito inteiramente no cliente** (@247563): `requestPasswordReset` faz `users.getFullList({filter: email|id_unico|username})` sem autenticação, gera `crypto.randomUUID()` no navegador, grava `users.update(id,{password_reset_token, password_reset_expires})` e **devolve o token ao chamador**. `resetPassword` busca o usuário pelo token e faz `users.update(L.id,{password, passwordConfirm,...})` sem autenticação. A tela mostra "email enviado", mas nenhum email é enviado pelo front, e o `requestPasswordReset/confirmPasswordReset` nativo do SDK não é usado. Para isso funcionar, o servidor precisa permitir list/update anônimo em `users`; se permitir, qualquer pessoa troca a senha de qualquer conta. Se não permitir, o fluxo simplesmente não funciona (incerto qual dos dois; depende das regras).
- **Login consulta `users` antes de autenticar** (`loginWithEmail`, `loginWithId`, `loginWithUsername`) e atualiza `login_attempts` e `locked_until` sem autenticação (@245833). O bloqueio por tentativas é controlado pelo cliente e pode ser burlado.
- `updateProfile` envia `{...se, role: se.role||t.role||t.cargo, status, id_unico}`: o próprio usuário pode tentar mudar o próprio `role`. Só é seguro se a regra do servidor impedir.
- Convite: o token (`U8e`, UUID, 7 dias) e a senha temporária (`$8e`, `Math.random`) são gerados no cliente e gravados em `password_reset_token`. O envio do email não aparece no front: deve ser um hook do servidor (incerto).

**Valores hardcoded**
- `dnmltda@hotmail.com` aparece 10 vezes e `username==="dnmltda"` 3 vezes: superadmin no cliente, isenção de `is_active===false` no login (`ge=L.email==="dnmltda@hotmail.com"`) e proteção "Administrador Principal" (@1211459). Também aparece como contato em mailto.
- IDs de empresa `cjly25lkal4kq1a` e `84r580vv19kkyzl`: **0 ocorrências**.
- `ip_address:"127.0.0.1"` fixo no audit log. `localizacao:"Canteiro Central"` fixo nas leituras de QR.
- Alerta mock em Documentos: `"1 Documento a vencer" "Licença Ambiental - Obra Centro (Vence em 12 dias)"` (texto estático).
- O formulário de contato ("Fale conosco") é falso: `await new Promise(b=>setTimeout(b,800)),qe.success("Mensagem enviada com sucesso!...")` (@683296).

**Cliente PocketBase**
- **Uma única instância** no app: `He=new RW(Doe)`. A outra ocorrência de `new RW(` está dentro do SDK (`impersonate`). Atende à regra.
- `getFirstListItem`: **nenhum uso pelo app** (só aparece dentro do SDK). Em vez dele, o app usa `getFullList({filter})` e pega `[0]`, ou `getList(1,1)`.

**Placeholders, "em breve" e mock**
- "Logins sociais estarão disponíveis em breve" (botões desabilitados). "Modo Escuro (Em breve)". "Gráficos financeiros detalhados estarão disponíveis em breve". "Exportação em desenvolvimento" na Auditoria (o botão só mostra um toast). "Nova Equipe": `qe.info("Funcionalidade em desenvolvimento")`. `/rh/escalas`, `/frota/licenciamentos` e `/frota/quilometragem` mostram "Em Desenvolvimento".
- O botão "Registrar Título" em Contas a Pagar não tem `onClick`.
- "Test Data" e "mock": 0 ocorrências. Todos os TODO vêm da biblioteca SheetJS.
- Toasts em inglês na tela Obras ("Project created successfully", "Failed to load projects") e em Configurações.

**Hard deletes** (a regra é inativar): `materiais`, `funcionarios`, `users` (Gestão de Acessos `deleteUsuario`), `empresas` (2 lugares, "Esta ação não pode ser desfeita"), `solicitacoes`, `compras`, `compras_itens`, anexos, `epis`, `equipamentos`, `fornecedores`, `clientes`, `propostas`, `contas_receber`, `veiculos` (`window.confirm`), `treinamentos`, `notificacoes`. Obras, movimentações e entregas de EPI não têm delete: usam cancelamento ou devolução. Equipamentos também têm "Baixa" (`situacao:"Baixado"`, `motivo_baixa`), mas o delete continua existindo para admin.

**Integridade de estoque**
- A tela Movimentações cria registros "Pendente" e muda o status para Aprovado ou Finalizado **sem alterar `materiais.quantity_in_stock`**. Só a tela Estoque e o Saldo por Funcionário alteram o saldo. Resultado: dois caminhos com efeitos diferentes; tipos como "Ajuste de Estoque", "Inventário" e "Perda" não mexem no saldo.
- O saldo é atualizado no cliente por ler, modificar e gravar (`quantity_in_stock: atual ± qtd`), com valor do estado em memória e sem transação: há risco de condição de corrida e de deixar um estoque inconsistente quando a segunda chamada falha. O mesmo vale para `epis.quantidade_estoque`.
- O formulário de material permite editar `quantity_in_stock` diretamente, o que é um ajuste sem movimentação.
- Os numeradores (`MOV-AAAA-NNNN`, `R8e`/`hT` por contagem ou máximo) são calculados no cliente e podem repetir em concorrência.
- Os tipos "Retirada por Funcionário" (`p1`) e "Devolução de Funcionário" (`MHe`) não estão na lista `J3` da tela Movimentações.

**Inconsistências de dados**
- Duas coleções de empresa: `companies` (Configurações e Gestão de Acessos) e `empresas` (Cadastro de Empresas). Dois logs: `audit_logs` e `auditoria`.
- Campos com convenções misturadas: `obraId`/`obra_id`, `funcionarioId`/`funcionario_id`, `fornecedorId` (dashboard) e `fornecedor_id`, `dataInicio` e `data_solicitacao`.
- O dashboard conta compras com `status="Enviado"||"Confirmado"||"Pendente"`, mas os status de compra são `Solicitado, Em Cotação, Aguardando Aprovação, Aprovado, Pedido Emitido, Em Transporte, Recebido, Parcialmente Recebido, Cancelado`. O card provavelmente mostra sempre 0.
- Terceiros: o QR é gerado em `https://api.qrserver.com/v1/create-qr-code/?data=...`, o que envia os dados do item a um serviço externo. Também aparece `bwipjs-api.fly.dev` (código de barras).

**Texto livre onde caberia um select** (pedido do Diego). Todos são `tt` (Input):
- Gestão de Acessos: **Cargo** (que influencia permissões) e Departamento.
- Funcionários: Departamento.
- Movimentações: Categoria, Unidade, Centro de Custo, Origem e Destino (`mov_categoria`, `mov_unidade`, `mov_cc`, `mov_origem`, `mov_destino`), mesmo havendo listas de categoria e de obra.
- Solicitações: Departamento, e Categoria em texto quando o tipo não é Material. Compras: Subcategoria e Centro de Custo.
- Equipamentos: Local Atual e Centro de Custo.
- EPI entrega: Setor e Cargo (deveriam vir do funcionário).
- Perdas e Ganhos: **Item** (`item_nome` em texto em vez de `material_id`) e Localização.
- Contas a Receber: **Cliente** em texto (`cr_cliente`), embora exista a coleção `clientes`.
- QR Code: "info" do item em texto livre, sem vínculo com material, EPI ou equipamento.

**Console**: `console.error` 183 vezes, `console.warn` 24, `console.log` 13. Padrões: `"=== ERRO AO CRIAR USUÁRIO ==="` (com stack), `"Erro completo:"`, `"Realtime ... falhou"`, `"Error creating audit log"`. Muitos `catch{}` silenciosos que devolvem `[]` (aprovações, anexos, recebimentos), o que esconde erro de permissão.

**Exportações presentes**
- CSV: clientes, relatórios e saldo por funcionário.
- XLSX: compras, solicitações e EPIs.
- PDF (jsPDF): empresas, usuários, compra, solicitação, empresa, EPIs, ficha de equipamento, movimentações, proposta e relatório.
- PNG do QR code.
- `window.print` (9 vezes).
- Cada exportação de relatório grava `relatorios_exportados`.

---

## 7. Fluxos

**(1) Consumível: solicitação → análise → aprovação → separação → entrega → confirmação → baixa**
- Solicitação: existe, mas é **genérica** (tipo "Material", sem material nem quantidade). Status disponíveis: `Aberta, Em análise, Aguardando aprovação, Aprovada, Em execução, Concluída, Cancelada, Rejeitada`. Ações: criar ("Aberta"), "Registrar Aprovação" (Aprovado→"Aprovada", Rejeitado→"Rejeitada"), "Cancelar Solicitação" (com motivo), concluir ("Concluída"), "Excluir", duplicar e anexos.
- Análise: só como valor de status escolhido no formulário. Não há passo dedicado.
- Separação: **não existe** (0 ocorrências de "Separa").
- Entrega e baixa: feitas **separadamente** na tela Estoque ("Registrar Saída do Estoque" ou "Retirada por Funcionário", que já nasce "Aprovado" e já baixa o saldo), **sem vínculo** com a solicitação.
- Confirmação de recebimento pelo solicitante: **não existe**.

**(2) Equipamento retornável: solicitação → aprovação → entrega → uso → devolução → inspeção**
- Não existe um fluxo de empréstimo ligado a solicitação. Na tela Equipamentos existem: "Transferir" (local, responsável e obra), "Enviar para obra" (`situacao:"Em Uso"`), manutenção (tipos `Preventiva, Corretiva, Emergencial, Calibração, Inspeção, Troca de peças`; status `Agendada, Em Execução, Concluída, Cancelada`; ao concluir, `situacao` volta para "Disponível"), "Baixa" (com motivo) e um histórico em `equipamentos_historico`.
- Situações: `Disponível, Em Uso, Reservado, Em Manutenção, Em Transporte, Emprestado, Extraviado, Danificado, Inativo, Baixado`. São escolhidas livremente no formulário.
- Devolução e inspeção na devolução: **não existem** como passo; "Inspeção" é só um tipo de manutenção. O "Confirmar Devolução" do Saldo por Funcionário vale para materiais. Para EPI existe devolução com estado, reutilização, higienização e manutenção.

**(3) Compra: necessidade → solicitação → aprovação → pedido → recebimento → conferência → entrada no estoque**
- Status: `Solicitado, Em Cotação, Aguardando Aprovação, Aprovado, Pedido Emitido, Em Transporte, Recebido, Parcialmente Recebido, Cancelado`.
- Botões: criar, itens, "Registrar Aprovação" (Aprovado→"Aprovado", Rejeitado→"Cancelado"), "Registrar Recebimento" (Completo→"Recebido", Parcial→"Parcialmente Recebido", com foto), anexos (`Orçamento, Nota Fiscal, Boleto, Contrato...`), "Cancelar Compra", "Excluir Compra", PDF e XLSX.
- A compra não tem vínculo com `solicitacoes` (não há `solicitacao_id`).
- "Pedido emitido" é só um status manual.
- A conferência se resume a `quantidade_recebida` contra `quantidade_prevista`, num total único e não por item.
- **Entrada no estoque: não acontece.** O recebimento não cria movimentação nem altera `materiais`.

**(4) Divergência de estoque: registro com motivo → autorização → ajuste como nova operação**
- Não existe fluxo próprio ("Diverg": 0 no app).
- Aproximações: o tipo "Ajuste de Estoque" ou "Inventário" na tela Movimentações (status Pendente→Aprovado→Finalizado, com `canApprove`) **não altera o saldo**. Perdas e Ganhos registra Quebra, Extravio, Avaria, Sobra e Recuperação com motivo, mas sem `material_id`, sem aprovação (status fixo "Registrado") e sem ajuste. A edição direta de `quantity_in_stock` no cadastro de material ajusta o saldo sem registro.
- O cancelamento de movimentação exige motivo (`motivo_cancelamento`) e é a única operação parecida com um estorno.

**Convite de funcionário (`/ativar-conta`)**: em Funcionários, a opção "Criar acesso ao sistema" faz `createUser` com senha aleatória, `status:"Inativo"` e `password_reset_token` (UUID, 7 dias). O toast diz "convite enviado para email". A página lê `?token`, chama `/api/custom/get-invite-details`, mostra os dados para confirmar e depois chama `/api/custom/activate-invite` com a nova senha (estados `loading → confirm → password → done/invalid`). O envio do email depende do backend (incerto).

**Autocadastro de empresa**: um modal no login/landing coleta `companyName, name, cpfCnpj, email, username, password` e envia para `/api/custom/self-register-company`. Em caso de sucesso: "Empresa e conta criadas com sucesso! Faça login".

**Recuperação de senha**: "Esqueci minha senha" (`U2e`, só email) e `rte` (email, ID ou username) chamam o `requestPasswordReset` customizado no cliente (ver §6). `/reset-password?token=` chama `resetPassword(token, senha)`, que atualiza `users` sem autenticação. Não há email no front. Para um admin, "Resetar Senha" na Gestão de Acessos gera uma senha temporária (`kWe`) e a mostra na tela (`tempPassword`).
