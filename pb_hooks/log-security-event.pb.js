/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  // Log user creation
  try {
    const auditRecord = new Record($app.findCollectionByNameOrId("auditoria"));
    auditRecord.set("usuarioId", e.auth ? e.auth.id : null);
    auditRecord.set("usuario", e.auth ? e.auth.get("username") : "system");
    auditRecord.set("acao", "user_created");
    auditRecord.set("modulo", "security");
    auditRecord.set("detalhes", JSON.stringify({
      newUserId: e.record.id,
      newUsername: e.record.get("username"),
      newEmail: e.record.get("email"),
      cargo: e.record.get("cargo")
    }));
    
    $app.save(auditRecord);
  } catch (err) {
    console.log("Erro ao registrar criação de usuário:", err);
  }
  
  e.next();
}, "users");

onRecordUpdate((e) => {
  // Log password changes
  const originalPassword = e.record.original().get("password");
  const newPassword = e.record.get("password");
  
  if (originalPassword !== newPassword && newPassword) {
    try {
      const auditRecord = new Record($app.findCollectionByNameOrId("auditoria"));
      auditRecord.set("usuarioId", e.auth ? e.auth.id : null);
      auditRecord.set("usuario", e.auth ? e.auth.get("username") : "system");
      auditRecord.set("acao", "password_change");
      auditRecord.set("modulo", "security");
      auditRecord.set("detalhes", JSON.stringify({
        changedUserId: e.record.id,
        changedUsername: e.record.get("username"),
        timestamp: new Date().toISOString()
      }));
      
      $app.save(auditRecord);
    } catch (err) {
      console.log("Erro ao registrar mudança de senha:", err);
    }
  }
  
  // Log status changes (blocking/deactivation)
  const originalStatus = e.record.original().get("status");
  const newStatus = e.record.get("status");
  
  if (originalStatus !== newStatus) {
    try {
      let acao = null;
      if (newStatus === "Bloqueado") {
        acao = "user_blocked";
      } else if (newStatus === "Inativo") {
        acao = "user_deactivated";
      }
      
      if (acao) {
        const auditRecord = new Record($app.findCollectionByNameOrId("auditoria"));
        auditRecord.set("usuarioId", e.auth ? e.auth.id : null);
        auditRecord.set("usuario", e.auth ? e.auth.get("username") : "system");
        auditRecord.set("acao", acao);
        auditRecord.set("modulo", "security");
        auditRecord.set("detalhes", JSON.stringify({
          targetUserId: e.record.id,
          targetUsername: e.record.get("username"),
          previousStatus: originalStatus,
          newStatus: newStatus,
          timestamp: new Date().toISOString()
        }));
        
        $app.save(auditRecord);
      }
    } catch (err) {
      console.log("Erro ao registrar mudança de status:", err);
    }
  }
  
  e.next();
}, "users");

onRecordAuthRequest((e) => {
  // Log successful login
  try {
    const auditRecord = new Record($app.findCollectionByNameOrId("auditoria"));
    auditRecord.set("usuarioId", e.record.id);
    auditRecord.set("usuario", e.record.get("username"));
    auditRecord.set("acao", "login");
    auditRecord.set("modulo", "security");
    auditRecord.set("detalhes", JSON.stringify({
      authMethod: e.authMethod,
      timestamp: new Date().toISOString()
    }));
    
    $app.save(auditRecord);
    
    // Update last_login
    e.record.set("last_login", new Date().toISOString().split("T")[0]);
    $app.save(e.record);
  } catch (err) {
    console.log("Erro ao registrar login:", err);
  }
  
  e.next();
}, "users");
// ============================================================
// Correção: unificação de isolamento por empresa em "materiais"
// e "equipamentos" — migração de tenant_id (campo já removido do
// schema, órfão em migrações antigas) para company_id (já existe
// e já está preenchido nos registros reais). Roda a cada início
// do servidor; é IDEMPOTENTE (reaplicar não causa dano).
//
// materiais: só corrige as 4 regras de acesso (schema já correto).
// equipamentos: corrige as 4 regras E remove o campo duplicado
// "company_id_new" (criado numa tentativa de correção anterior
// que ficou incompleta; nenhum registro real existe na coleção,
// então não há dado para preservar nesse campo).
onBootstrap((e) => {
  e.next();

  try {
    const materiais = $app.findCollectionByNameOrId("materiais");
    // 18/10/2026: só corrige se ainda não houver isolamento por empresa —
    // senão desfazia o filtro de arquivados (seguranca-etapa1.pb.js).
    if (!String(materiais.listRule || "").includes("company_id")) {
      materiais.listRule = "@request.auth.company_id = company_id";
      materiais.viewRule = "@request.auth.company_id = company_id";
      materiais.createRule = '@request.auth.company_id = company_id && @request.auth.role != "viewer"';
      materiais.updateRule = '@request.auth.company_id = company_id && @request.auth.role != "viewer"';
    }
    $app.save(materiais);
    console.log("[fix-tenant-to-company] materiais: regras atualizadas.");
  } catch (err) {
    console.log("[fix-tenant-to-company] Erro ao atualizar materiais:", err);
  }

  try {
    const equipamentos = $app.findCollectionByNameOrId("equipamentos");
    // 18/10/2026: só corrige se ainda não houver isolamento por empresa —
    // senão desfazia o filtro de arquivados (seguranca-etapa1.pb.js).
    if (!String(equipamentos.listRule || "").includes("company_id")) {
      equipamentos.listRule = "@request.auth.company_id = company_id";
      equipamentos.viewRule = "@request.auth.company_id = company_id";
      equipamentos.createRule = '@request.auth.company_id = company_id && @request.auth.role != "viewer"';
      equipamentos.updateRule = '@request.auth.company_id = company_id && @request.auth.role != "viewer"';
    }
    if (equipamentos.fields.getByName("company_id_new")) {
      equipamentos.fields.removeByName("company_id_new");
    }
    $app.save(equipamentos);
    console.log("[fix-tenant-to-company] equipamentos: regras atualizadas e campo duplicado removido.");
  } catch (err) {
    console.log("[fix-tenant-to-company] Erro ao atualizar equipamentos:", err);
  }
});

// ============================================================
// Correção: campo "cargo" da collection "users" só aceitava 5
// valores (Administrador, Funcionário, Engenheiro, Almoxarife,
// Mestre de Obras), mas a tela de Cadastro de Usuários oferece
// mais perfis (Gerência, Comprador, Financeiro, RH, Cliente) que
// sempre falhavam ao salvar. Expande a lista de valores aceitos
// para bater com a lista real de perfis selecionáveis no app.
// "Supervisor" foi deixado de fora de propósito (perfil ainda
// não definido, congelado por enquanto).
//
// CORREÇÃO (18/10/2026): este hook rodava a CADA boot e
// SUBSTITUÍA a lista inteira de valores, apagando os cargos de
// execução de obra (Servente, Pedreiro, Encanador, Eletricista,
// Faxina) que a migration 1792300000_add_novos_cargos_e_faxina.js
// já tinha adicionado antes. Resultado: "Criar acesso ao sistema"
// para qualquer funcionário de obra falhava com
// "Invalid value Servente" (ou outro cargo de obra), sempre, em
// todo boot, mesmo a migration estando correta — porque esse
// hook reescrevia o campo por cima logo em seguida. Trocado para
// SOMAR (nunca remover) valores já existentes em vez de
// substituir a lista inteira, para não voltar a apagar cargos
// adicionados por outro lugar do código.
onBootstrap((e) => {
  e.next();
  try {
    const users = $app.findCollectionByNameOrId("users");
    const cargoField = users.fields.getByName("cargo");
    if (cargoField) {
      const obrigatorios = [
        "Administrador",
        "Gerência",
        "Engenheiro",
        "Mestre de Obras",
        "Almoxarife",
        "Comprador",
        "Financeiro",
        "RH",
        "Funcionário",
        "Cliente",
        "Pedreiro",
        "Servente",
        "Encanador",
        "Eletricista",
        "Faxina",
      ];
      const atuais = cargoField.values || [];
      const combinados = [...atuais, ...obrigatorios.filter((v) => !atuais.includes(v))];
      if (combinados.length !== atuais.length) {
        cargoField.values = combinados;
        $app.save(users);
        console.log("[fix-cargo-values] users.cargo: valores atualizados (somados, nada removido).");
      }
    }
  } catch (err) {
    console.log("[fix-cargo-values] Erro ao atualizar users.cargo:", err);
  }
});

// ============================================================
// Correção crítica: o índice "idx_users_id_unico" forçava
// id_unico ÚNICO GLOBALMENTE em toda a tabela "users", em vez
// de único POR EMPRESA. Isso travava o autocadastro de qualquer
// empresa a partir da segunda, pois toda empresa nova tenta usar
// "01" para o primeiro administrador (sequência já corrigida
// para ser por empresa em generate-user-id.pb.js), mas o índice
// antigo rejeitava por já existir em OUTRA empresa.
//
// Troca o índice único de (id_unico) para (company_id, id_unico)
// — mesmo id_unico pode repetir entre empresas diferentes, mas
// nunca dentro da mesma empresa. Roda a cada início do servidor;
// é IDEMPOTENTE.
onBootstrap((e) => {
  e.next();
  try {
    const users = $app.findCollectionByNameOrId("users");
    users.indexes = users.indexes.filter((idx) => !idx.includes("idx_users_id_unico"));
    users.indexes.push("CREATE UNIQUE INDEX idx_users_id_unico ON users (company_id, id_unico)");
    $app.save(users);
    console.log("[fix-id-unico-index] users: indice de id_unico agora e por empresa.");
  } catch (err) {
    console.log("[fix-id-unico-index] Erro ao atualizar indice de id_unico:", err);
  }
});

// ============================================================
// Correção: mesmo bug encontrado em "users" — o índice
// "idx_funcionarios_id_unico" forçava id_unico ÚNICO
// GLOBALMENTE em toda a tabela "funcionarios", em vez de único
// POR EMPRESA. Isso bloqueava a criação de funcionários em
// qualquer empresa cujo próximo número calculado já tivesse
// sido usado por OUTRA empresa.
//
// Troca o índice único de (id_unico) para (company_id, id_unico)
// — mesmo id_unico pode repetir entre empresas diferentes, mas
// nunca dentro da mesma empresa. Roda a cada início do servidor;
// é IDEMPOTENTE.
//
// Ajuste 19/10/2026: seguranca-etapa1.pb.js deixa este índice PARCIAL
// (... WHERE deleted_at = ''), para funcionário excluído não travar o
// número. Este hook regravava a versão sem o WHERE a cada boot; como a
// ordem dos onBootstrap entre arquivos é aleatória, quando existia um
// excluído e um ativo com o mesmo número o boot logava
// "UNIQUE constraint failed: funcionarios.company_id, funcionarios.id_unico"
// (a troca era desfeita e o índice parcial continuava). Agora só age se o
// índice ainda for o antigo, sem company_id, e já cria a versão parcial.
onBootstrap((e) => {
  e.next();
  try {
    const funcionarios = $app.findCollectionByNameOrId("funcionarios");
    const atuais = [];
    for (let i = 0; i < funcionarios.indexes.length; i++) atuais.push(String(funcionarios.indexes[i]));
    const atual = atuais.find((idx) => idx.includes("idx_funcionarios_id_unico"));
    if (atual && atual.includes("company_id")) return; // já é por empresa
    funcionarios.indexes = atuais.filter((idx) => !idx.includes("idx_funcionarios_id_unico"));
    funcionarios.indexes.push("CREATE UNIQUE INDEX idx_funcionarios_id_unico ON funcionarios (company_id, id_unico) WHERE deleted_at = ''");
    $app.save(funcionarios);
    console.log("[fix-funcionarios-id-unico] indice agora e por empresa.");
  } catch (err) {
    console.log("[fix-funcionarios-id-unico] Erro ao atualizar indice:", err);
  }
});

// ============================================================
// Correção: bug em que funcionário criado com "Criar acesso ao
// sistema" marcado NÃO gerava o login correspondente na coleção
// "users". Causa raiz: a regra de criação (createRule) da
// coleção "users" exigia @request.auth.role = "admin" (minúsculo,
// literal), mas o sistema real sempre usa role = "Administrador"
// (com A maiúsculo, em português) — nenhum usuário real do
// sistema jamais teve role="admin". Isso bloqueava qualquer
// administrador real de criar login para outra pessoa (via
// Funcionários), mesmo sendo dono legítimo da empresa.
//
// Corrige a regra para aceitar o valor real usado no sistema.
// Roda a cada início do servidor; é IDEMPOTENTE.
onBootstrap((e) => {
  e.next();
  // Desativado em 18/10/2026: substituído por seguranca-etapa1.pb.js, que
  // define TODAS as regras de users. Este hook regravava as regras a cada
  // boot e desfazia a correção (funcionário podia virar administrador).
  return;
  try {
    const users = $app.findCollectionByNameOrId("users");
    users.createRule = '@request.auth.role = "Administrador"';
    $app.save(users);
    console.log("[fix-users-createrule] users.createRule atualizada para aceitar role Administrador.");
  } catch (err) {
    console.log("[fix-users-createrule] Erro ao atualizar createRule:", err);
  }
});

// ============================================================
// Correção final consolidada (substitui as tentativas v1/v2/v3
// anteriores, que ficaram no mesmo arquivo por engano durante
// a investigação).
//
// PARTE 1 — regra role="admin" quebrada:
// Confirmado nos dados reais E no código de todos os fluxos de
// criação de usuário (self-register-company, AuthContext.createUser,
// useUsuarios.js) que o campo "role" é preenchido de forma
// consistente com o valor "Administrador" em TODO fluxo real de
// criação. O problema era só o VALOR da regra ("admin" minúsculo,
// que nenhum usuário real tem) — o campo em si sempre esteve certo.
// Corrige role="admin" -> role="Administrador" em todas as
// collections já identificadas como afetadas.
//
// PARTE 2 — isolamento de "companies":
// listRule e viewRule de "companies" usavam apenas
// "@request.auth.id != \"\"" (qualquer usuário autenticado, de
// qualquer empresa, podia listar/ver TODAS as empresas). Corrige
// para isolar pela própria empresa do usuário autenticado.
//
// Roda a cada início do servidor; é IDEMPOTENTE.
onBootstrap((e) => {
  e.next();

  // --- PARTE 1: role = "admin" -> role = "Administrador" ---
  const OLD_VARIANTS = [
    '@request.auth.role = "admin"',
    '@request.auth.cargo = "Administrador"', // reverte tentativa v3 equivocada, se tiver rodado
  ];
  const NEW_ROLE = '@request.auth.role = "Administrador"';
  const ruleFields = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];
  const collectionNames = [
    "users", "materiais", "equipamentos", "qr_codes", "movimentacoes",
    "solicitacoes", "emprestimos", "epi_entrega", "companies", "roles",
    "obras", "funcionarios", "fornecedores", "compras", "epis",
    "treinamentos", "veiculo", "financeiro", "audit_logs",
    "equipamentos_manutencao", "epis_entregas", "epis_devolucoes",
    "epis_reposicoes", "saldo_funcionario",
  ];

  let totalRulesFixed = 0;
  const fixedCollections = [];
  const notFound = [];
  const errors = [];

  for (const name of collectionNames) {
    let collection;
    try {
      collection = $app.findCollectionByNameOrId(name);
    } catch (err) {
      notFound.push(name);
      continue;
    }
    let changedThisCollection = false;
    for (const field of ruleFields) {
      let current = collection[field];
      if (typeof current !== "string") continue;
      for (const OLD of OLD_VARIANTS) {
        if (current.indexOf(OLD) !== -1) {
          current = current.split(OLD).join(NEW_ROLE);
          changedThisCollection = true;
          totalRulesFixed++;
        }
      }
      collection[field] = current;
    }

    // --- PARTE 2: isolamento de "companies" (só nesta collection) ---
    if (name === "companies") {
      const OLD_LIST_VIEW = '@request.auth.id != ""';
      const NEW_LIST_VIEW = '@request.auth.company_id = id';
      if (collection.listRule === OLD_LIST_VIEW) {
        collection.listRule = NEW_LIST_VIEW;
        changedThisCollection = true;
        totalRulesFixed++;
      }
      if (collection.viewRule === OLD_LIST_VIEW) {
        collection.viewRule = NEW_LIST_VIEW;
        changedThisCollection = true;
        totalRulesFixed++;
      }
    }

    if (changedThisCollection) {
      try {
        $app.save(collection);
        fixedCollections.push(name);
      } catch (err) {
        errors.push(name + ": " + err);
      }
    }
  }

  console.log(
    "[fix-final-all] Regras corrigidas:", totalRulesFixed,
    "| Collections afetadas:", fixedCollections.join(", "),
    "| Nao encontradas:", notFound.join(", "),
    "| Erros:", errors.join(" | ")
  );

});

// ============================================================
// Correção — índices únicos de funcionarios (cpf e matricula):
// Confirmado por diagnóstico autorizado que idx_funcionarios_cpf
// e idx_funcionarios_matricula eram índices ÚNICOS GLOBAIS (sem
// company_id), causando falha real "cpf: Value must be unique"
// ao criar funcionário sempre que outro registro de QUALQUER
// empresa já tivesse o mesmo valor (incluindo CPF vazio, já que
// cpf não é obrigatório).
//
// Correção: torna ambos os índices compostos por company_id,
// no mesmo padrão já usado com sucesso para idx_funcionarios_id_unico
// (que NÃO é alterado por este hook). Para cpf, usa índice parcial
// (WHERE cpf != '') para que múltiplos funcionários da mesma
// empresa sem CPF preenchido não colidam entre si.
//
// Não altera nenhum outro campo, regra, ou collection.
// Roda a cada início do servidor; é IDEMPOTENTE.
onBootstrap((e) => {
  e.next();
  try {
    const func = $app.findCollectionByNameOrId("funcionarios");
    let changed = false;

    const hasCpfOld = func.indexes.some(idx => idx.includes("idx_funcionarios_cpf") && !idx.includes("company_id"));
    if (hasCpfOld) {
      func.indexes = func.indexes.filter(idx => !idx.includes("idx_funcionarios_cpf"));
      func.indexes.push("CREATE UNIQUE INDEX idx_funcionarios_cpf ON funcionarios (company_id, cpf) WHERE cpf != ''");
      changed = true;
    }

    const hasMatriculaOld = func.indexes.some(idx => idx.includes("idx_funcionarios_matricula") && !idx.includes("company_id"));
    if (hasMatriculaOld) {
      func.indexes = func.indexes.filter(idx => !idx.includes("idx_funcionarios_matricula"));
      func.indexes.push("CREATE UNIQUE INDEX idx_funcionarios_matricula ON funcionarios (company_id, matricula)");
      changed = true;
    }

    if (changed) {
      $app.save(func);
      console.log("[fix-cpf-matricula-index] Indices de cpf/matricula agora sao por empresa.");
    }
  } catch (err) {
    console.log("[fix-cpf-matricula-index] Erro:", err);
  }
});




// ============================================================
// Correção — regras administrativas de users (updateRule,
// deleteRule, viewRule): ainda usavam @request.auth.role = "admin"
// (minúsculo, nunca corrigido — diferente de createRule, que já
// foi corrigido por um hook anterior). O valor real do sistema é
// role = "Administrador". Corrige para o valor real, preservando
// o isolamento por company_id e sem conceder privilégio baseado
// em id_unico, matricula, email ou username.
//
// Regras finais:
// - updateRule: usuário edita a si mesmo, OU Administrador da
//   MESMA empresa edita outros usuários da empresa.
// - deleteRule: Administrador da MESMA empresa exclui usuários
//   da empresa. Usuário comum não exclui ninguém.
// - viewRule: usuário vê a si mesmo, OU Administrador da MESMA
//   empresa vê outros usuários da empresa.
//
// listRule e createRule NÃO são alteradas aqui (já corretas /
// já corrigidas por hook anterior).
//
// Idempotente: só altera se detectar o valor antigo "admin".
onBootstrap((e) => {
  e.next();
  // Desativado em 18/10/2026: substituído por seguranca-etapa1.pb.js, que
  // define TODAS as regras de users. Este hook regravava as regras a cada
  // boot e desfazia a correção (funcionário podia virar administrador).
  return;
  try {
    const users = $app.findCollectionByNameOrId("users");
    let changed = false;

    if (users.updateRule && users.updateRule.includes('"admin"')) {
      users.updateRule = '@request.auth.id = id || (@request.auth.role = "Administrador" && @request.auth.company_id = company_id)';
      changed = true;
    }

    if (users.deleteRule && users.deleteRule.includes('"admin"')) {
      users.deleteRule = '@request.auth.role = "Administrador" && @request.auth.company_id = company_id';
      changed = true;
    }

    if (users.viewRule && users.viewRule.includes('"admin"')) {
      users.viewRule = '@request.auth.id = id || (@request.auth.role = "Administrador" && @request.auth.company_id = company_id)';
      changed = true;
    }

    if (changed) {
      $app.save(users);
      console.log("[fix-users-update-delete-view-rules] users.updateRule/deleteRule/viewRule atualizadas para role Administrador, isoladas por company_id.");
    }
  } catch (err) {
    console.log("[fix-users-update-delete-view-rules] Erro:", err);
  }
});

// ============================================================
// Correção — regras administrativas de users (updateRule,
// deleteRule, viewRule): ainda usavam @request.auth.role = "admin"
// (minúsculo, nunca corrigido — diferente de createRule, que já
// foi corrigido por um hook anterior). O valor real do sistema é
// role = "Administrador". Corrige para o valor real, preservando
// o isolamento por company_id e sem conceder privilégio baseado
// em id_unico, matricula, email ou username.
//
// Regras finais:
// - updateRule: usuário edita a si mesmo, OU Administrador da
//   MESMA empresa edita outros usuários da empresa.
// - deleteRule: Administrador da MESMA empresa exclui usuários
//   da empresa. Usuário comum não exclui ninguém.
// - viewRule: usuário vê a si mesmo, OU Administrador da MESMA
//   empresa vê outros usuários da empresa.
//
// listRule e createRule NÃO são alteradas aqui (já corretas /
// já corrigidas por hook anterior).
//
// Idempotente: só altera se detectar o valor antigo "admin".
onBootstrap((e) => {
  e.next();
  // Desativado em 18/10/2026: substituído por seguranca-etapa1.pb.js, que
  // define TODAS as regras de users. Este hook regravava as regras a cada
  // boot e desfazia a correção (funcionário podia virar administrador).
  return;
  try {
    const users = $app.findCollectionByNameOrId("users");
    let changed = false;

    if (users.updateRule && users.updateRule.includes('"admin"')) {
      users.updateRule = '@request.auth.id = id || (@request.auth.role = "Administrador" && @request.auth.company_id = company_id)';
      changed = true;
    }

    if (users.deleteRule && users.deleteRule.includes('"admin"')) {
      users.deleteRule = '@request.auth.role = "Administrador" && @request.auth.company_id = company_id';
      changed = true;
    }

    if (users.viewRule && users.viewRule.includes('"admin"')) {
      users.viewRule = '@request.auth.id = id || (@request.auth.role = "Administrador" && @request.auth.company_id = company_id)';
      changed = true;
    }

    if (changed) {
      $app.save(users);
      console.log("[fix-users-update-delete-view-rules] users.updateRule/deleteRule/viewRule atualizadas para role Administrador, isoladas por company_id.");
    }
  } catch (err) {
    console.log("[fix-users-update-delete-view-rules] Erro:", err);
  }
});


// Administrador Master (superadmin) — conta com users.dono_sistema = true
// (antes era o e-mail fixo; ver dono-lib.js). Concede acesso GLOBAL (todas
// as empresas) via condicao explicita nas regras do PocketBase.
// NAO usa id_unico, NAO usa role/cargo isoladamente, NAO altera
// o valor real de role/cargo/company_id/is_active do usuario.
// Isolamento por company_id para os DEMAIS Administradores
// permanece intacto (condicao adicionada via OR, sem remover nada).
//
// Cobertura desta correcao: users e funcionarios (as duas collections
// centrais ja testadas nesta investigacao). Demais collections com
// company_id (obras, compras, solicitacoes, financeiro, etc.) NAO
// foram alteradas nesta etapa - ver relatorio para escopo completo.
onBootstrap((e) => {
  e.next();
  require(`${__hooks}/dono-lib.js`).garantir($app);
  const MASTER_EMAIL = '@request.auth.dono_sistema = true';

  function addMasterException(collectionName, ruleName, companyCondition) {
    try {
      const col = $app.findCollectionByNameOrId(collectionName);
      const current = col[ruleName];
      if (current && !current.includes('dono_sistema')) {
        col[ruleName] = "(" + current + ") || " + MASTER_EMAIL;
        $app.save(col);
        console.log("[fix-master-admin] " + collectionName + "." + ruleName + " atualizada com excecao do Master.");
      }
    } catch (err) {
      console.log("[fix-master-admin] Erro em " + collectionName + "." + ruleName + ":", err);
    }
  }

  addMasterException("users", "listRule");
  addMasterException("users", "viewRule");
  addMasterException("users", "updateRule");
  addMasterException("users", "deleteRule");

  addMasterException("funcionarios", "listRule");
  addMasterException("funcionarios", "viewRule");
  addMasterException("funcionarios", "updateRule");
  addMasterException("funcionarios", "deleteRule");

  addMasterException("companies", "listRule");
  addMasterException("companies", "viewRule");
});
