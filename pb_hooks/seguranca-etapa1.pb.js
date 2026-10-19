/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Etapa 1 da auditoria de 18/10/2026 (docs/auditoria/): segurança e
// separação entre empresas. Só regras e campos do servidor, nenhuma tela
// muda.
//
// Corrige:
//  S1  usuário comum alterava o próprio cargo/role (virava administrador)
//  S2  29 coleções sem company_id: uma empresa via e apagava dados da outra
//  S3  regras de exclusão "role = admin" sem checar empresa
//  S4  admin de uma empresa criava usuários em outra
//  S5  qualquer usuário listava todas as empresas (companies)
//  S6  token de convite visível para colegas
//  S7  logs de auditoria apagáveis e forjáveis sem login
//  D1  Administrador de empresa nova não aprovava solicitação
//  D2  Administrador de empresa nova não conseguia excluir
//
// Mesmo espírito dos hooks onBootstrap do projeto: roda a cada início,
// é idempotente (reaplicar não muda nada) e nunca derruba o servidor —
// cada coleção tem seu próprio try/catch.
//
// Os hooks antigos fix-users-createrule e fix-users-update-delete-view-rules
// (log-security-event.pb.js) foram desativados: eles regravavam as regras de
// users a cada boot e desfaziam esta correção. Se algum hook novo mexer em
// regras de users, ele precisa ser compatível com este arquivo.
//
// Obs.: o JSVM do PocketBase roda cada handler isolado, por isso as
// constantes e funções ficam DENTRO do handler.
//
// Papel de permissão: o servidor passa a reconhecer o "cargo" (lista
// oficial do app). role = "admin" continua valendo, mas SEMPRE dentro da
// própria empresa — nunca mais dá acesso a outras empresas.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;

  const SEG_MASTER = '@request.auth.email = "dnmltda@hotmail.com"';
  // Exige login explicitamente: sem isso um visitante (empresa vazia) passaria
  // em registros sem empresa, porque "" = "".
  const SEG_SAME = '@request.auth.id != "" && @request.auth.company_id = company_id';
  const SEG_ADMIN = '(@request.auth.cargo = "Administrador" || @request.auth.role = "admin" || @request.auth.role = "Administrador")';
  // Na criação a tela pode omitir company_id (o servidor preenche no hook
  // onRecordCreateRequest abaixo); se mandar, tem que ser a própria empresa.
  const SEG_CREATE = '@request.auth.id != "" && (@request.body.company_id:isset = false || @request.body.company_id = @request.auth.company_id)';
  const SEG_GESTAO = '(' + SEG_ADMIN.slice(1, -1) +
    ' || @request.auth.cargo = "Gerência" || @request.auth.cargo = "Engenheiro" || @request.auth.cargo = "Mestre de Obras"' +
    ' || @request.auth.cargo = "Almoxarife" || @request.auth.cargo = "Comprador")';
  // Empresa principal (DNM&LTDA OBRAS): destino dos registros antigos sem dono.
  const SEG_EMPRESA_PRINCIPAL = "cjly25lkal4kq1a";

  // Coleções que existiam sem company_id (relatório, seção 4).
  const SEG_SEM_EMPRESA = [
    "abastecimentos", "aprovacoes_compra", "centro_custos", "contas_pagar", "contas_receber", "despesas",
    "documentos", "documentos_central", "empresa", "empresas", "epi_funcionario", "equipe_funcionario",
    "equipes", "escala_funcionario", "escalas", "fluxo_caixa", "licenciamentos", "manutencoes", "motoristas",
    "notas_fiscais", "pedidos_compra", "perdas_ganhos", "qrcode_leituras", "quilometragem", "recebimentos",
    "receitas", "solicitacoes_compra", "veiculos",
  ];
  const SEG_LOGS = ["auditoria", "audit_logs"];

  // Campos de um registro antigo que apontam para quem o criou, na ordem de
  // preferência, para descobrir a empresa dele no preenchimento retroativo.
  const SEG_CAMPOS_DONO = ["usuarioId", "usuario_id", "responsavel_id", "criado_por", "created_by"];

  // Campos que o próprio usuário NÃO pode mudar no seu cadastro.
  const SEG_USERS_PROTEGIDOS = [
    "role", "cargo", "perfil_acesso", "company_id", "status", "is_active", "is_blocked",
    "login_attempts", "locked_until", "id_unico", "funcionario_id", "role_id",
    "password_reset_token", "password_reset_expires",
  ];

  const segCompanyFieldOk = (col) => {
    const f = col.fields.getByName("company_id");
    return !!f;
  };

  const segAddCompanyField = (app, col) => {
    if (segCompanyFieldOk(col)) return false;
    const companies = app.findCollectionByNameOrId("companies");
    col.fields.add(new RelationField({
      name: "company_id",
      collectionId: companies.id,
      maxSelect: 1,
      required: false,
      cascadeDelete: false,
    }));
    app.save(col);
    return true;
  };

  // Preenche company_id dos registros antigos: pela empresa de quem criou o
  // registro; se não der, pela empresa principal (se ela existir neste banco).
  const segEmpresaDoUsuario = {}; // cache: logs antigos podem ser milhares
  const segBackfill = (app, colName) => {
    let principal = "";
    try {
      principal = app.findRecordById("companies", SEG_EMPRESA_PRINCIPAL).id;
    } catch (_) {}

    const col = app.findCollectionByNameOrId(colName);
    const donos = SEG_CAMPOS_DONO.filter((n) => {
      const f = col.fields.getByName(n);
      if (!f) return false;
      const tipo = typeof f.type === "function" ? f.type() : f.type; // no JSVM é método
      return tipo === "relation";
    });

    let n = 0;
    let records = [];
    try {
      records = app.findRecordsByFilter(colName, 'company_id = ""', "", 0, 0);
    } catch (_) {}

    records.forEach((r) => {
      let empresa = "";
      for (const campo of donos) {
        const uid = r.get(campo);
        if (!uid) continue;
        if (segEmpresaDoUsuario[uid] === undefined) {
          try {
            segEmpresaDoUsuario[uid] = app.findRecordById("users", uid).get("company_id") || "";
          } catch (_) {
            segEmpresaDoUsuario[uid] = "";
          }
        }
        empresa = segEmpresaDoUsuario[uid];
        if (empresa) break;
      }
      if (!empresa) empresa = principal;
      if (!empresa) return; // banco sem empresa principal: fica visível só ao superusuário
      r.set("company_id", empresa);
      app.saveNoValidate(r);
      n++;
    });
    return n;
  };

  const segSetRules = (col, r) => {
    ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"].forEach((k) => {
      if (r[k] !== undefined) col[k] = r[k];
    });
  };

  // ---- S2: coleções sem empresa passam a ter company_id e regras por empresa
  SEG_SEM_EMPRESA.forEach((name) => {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (segAddCompanyField(app, col)) {
        console.log(`[seguranca-etapa1] ${name}: campo company_id criado.`);
      }
      const n = segBackfill(app, name);
      if (n) console.log(`[seguranca-etapa1] ${name}: ${n} registro(s) antigo(s) ligados a uma empresa.`);

      const fresh = app.findCollectionByNameOrId(name);
      segSetRules(fresh, {
        listRule: SEG_SAME,
        viewRule: SEG_SAME,
        createRule: SEG_CREATE,
        updateRule: SEG_SAME,
        deleteRule: `${SEG_SAME} && ${SEG_ADMIN}`,
      });
      app.save(fresh);
    } catch (err) {
      console.log(`[seguranca-etapa1] Erro em ${name}:`, err);
    }
  });

  // ---- S7: logs com empresa, só admin da empresa lê, ninguém altera/apaga
  SEG_LOGS.forEach((name) => {
    try {
      const col = app.findCollectionByNameOrId(name);
      segAddCompanyField(app, col);
      segBackfill(app, name);
      const fresh = app.findCollectionByNameOrId(name);
      segSetRules(fresh, {
        listRule: `(${SEG_SAME} && ${SEG_ADMIN}) || ${SEG_MASTER}`,
        viewRule: `(${SEG_SAME} && ${SEG_ADMIN}) || ${SEG_MASTER}`,
        createRule: SEG_CREATE,
        updateRule: null,
        deleteRule: null,
      });
      app.save(fresh);
    } catch (err) {
      console.log(`[seguranca-etapa1] Erro em ${name}:`, err);
    }
  });

  // ---- S3 / D2: exclusão sempre dentro da própria empresa, pelo administrador
  try {
    app.findAllCollections("base").forEach((c) => {
      if (!segCompanyFieldOk(c) || SEG_LOGS.includes(c.name)) return;
      const del = c.deleteRule === null ? null : String(c.deleteRule);
      if (del === null || del.includes("company_id")) return;
      const col = app.findCollectionByNameOrId(c.name);
      col.deleteRule = `${SEG_SAME} && ${SEG_ADMIN}`;
      // create sem checagem de empresa (epi_entrega, qr_codes, qr_scans)
      const cr = col.createRule === null ? null : String(col.createRule);
      if (cr !== null && !cr.includes("company_id")) {
        col.createRule = cr ? `${SEG_SAME} && (${cr})` : SEG_SAME;
      }
      app.save(col);
      console.log(`[seguranca-etapa1] ${c.name}: exclusão restrita ao admin da própria empresa.`);
    });
  } catch (err) {
    console.log("[seguranca-etapa1] Erro nas regras de exclusão:", err);
  }

  // ---- D1: aprovar/alterar solicitação
  try {
    const col = app.findCollectionByNameOrId("solicitacoes");
    // solicitante_id é criado pelo fix-solicitacoes-schema; num banco novo ele
    // pode só existir a partir do segundo início.
    if (!col.fields.getByName("solicitante_id")) {
      console.log("[seguranca-etapa1] Aviso: solicitacoes ainda sem solicitante_id (banco novo); regras aplicadas no próximo início.");
    } else {
      // Gestão altera qualquer solicitação da empresa. Quem pediu pode editar
      // a própria, mas não aprovar: o status só pode ficar igual, ir para
      // "Cancelada" (antes da entrega) ou "Concluída" (confirmar recebimento).
      col.updateRule = `${SEG_SAME} && (${SEG_GESTAO} || (solicitante_id = @request.auth.id && ` +
        `(@request.body.status:isset = false || @request.body.status = status || ` +
        `(@request.body.status = "Cancelada" && status != "Entregue") || (@request.body.status = "Concluída" && status = "Entregue"))))`;
      app.save(col);
    }
  } catch (err) {
    console.log("[seguranca-etapa1] Erro em solicitacoes:", err);
  }

  // ---- financeiro: cargos reais do app
  try {
    const col = app.findCollectionByNameOrId("financeiro");
    const quem = `(${SEG_ADMIN.slice(1, -1)} || @request.auth.cargo = "Financeiro" || @request.auth.cargo = "Gerência")`;
    col.createRule = `${SEG_SAME} && ${quem}`;
    col.updateRule = `${SEG_SAME} && ${quem}`;
    app.save(col);
  } catch (err) {
    console.log("[seguranca-etapa1] Erro em financeiro:", err);
  }

  // ---- roles: administrador da própria empresa
  try {
    const col = app.findCollectionByNameOrId("roles");
    col.createRule = `${SEG_SAME} && ${SEG_ADMIN}`;
    col.updateRule = `${SEG_SAME} && ${SEG_ADMIN}`;
    col.deleteRule = `${SEG_SAME} && ${SEG_ADMIN}`;
    app.save(col);
  } catch (err) {
    console.log("[seguranca-etapa1] Erro em roles:", err);
  }

  // ---- cargos: catálogo comum a todas as empresas; só o dono do sistema altera
  try {
    const col = app.findCollectionByNameOrId("cargos");
    col.createRule = SEG_MASTER;
    col.updateRule = SEG_MASTER;
    col.deleteRule = SEG_MASTER;
    app.save(col);
  } catch (err) {
    console.log("[seguranca-etapa1] Erro em cargos:", err);
  }

  // ---- notificações: só para usuários da mesma empresa
  try {
    const col = app.findCollectionByNameOrId("notificacoes");
    col.createRule = '@request.auth.id != "" && usuarioId.company_id = @request.auth.company_id';
    app.save(col);
  } catch (err) {
    console.log("[seguranca-etapa1] Erro em notificacoes:", err);
  }

  // ---- S5: cada empresa vê e edita só a si mesma
  try {
    const col = app.findCollectionByNameOrId("companies");
    col.listRule = `id = @request.auth.company_id || ${SEG_MASTER}`;
    col.viewRule = `id = @request.auth.company_id || ${SEG_MASTER}`;
    col.createRule = SEG_MASTER;
    col.updateRule = `(id = @request.auth.company_id && ${SEG_ADMIN}) || ${SEG_MASTER}`;
    col.deleteRule = SEG_MASTER;
    app.save(col);
  } catch (err) {
    console.log("[seguranca-etapa1] Erro em companies:", err);
  }

  // ---- S1 / S4 / S6: usuários
  try {
    const col = app.findCollectionByNameOrId("users");
    // A tela de perfil reenvia role = cargo para quem tem role vazio; aceitar
    // role igual ao próprio cargo não dá poder nenhum (cargo é protegido).
    const protegidos = SEG_USERS_PROTEGIDOS
      .map((f) => f === "role"
        ? "(@request.body.role:isset = false || @request.body.role = role || @request.body.role = cargo)"
        : `(@request.body.${f}:isset = false || @request.body.${f} = ${f})`)
      .join(" && ");
    // Arquivados (deleted_at, ex.: limpeza inicial) saem da lista; o "excluir"
    // da Gestão de Acessos só inativa e continua aparecendo para reativar.
    col.listRule = `(${SEG_SAME} || ${SEG_MASTER}) && deleted_at = ""`;
    col.viewRule = `${SEG_SAME} || ${SEG_MASTER}`;
    col.createRule = `(${SEG_ADMIN} && @request.auth.company_id = company_id) || ${SEG_MASTER}`;
    col.updateRule =
      `(${SEG_ADMIN} && ${SEG_SAME} && (@request.body.company_id:isset = false || @request.body.company_id = company_id))` +
      ` || (@request.auth.id = id && ${protegidos})` +
      ` || ${SEG_MASTER}`;
    col.deleteRule = `(${SEG_ADMIN} && ${SEG_SAME}) || ${SEG_MASTER}`;
    // Os tokens NÃO podem ser "hidden": campo hidden não é gravável pela API,
    // e a tela de convite grava o token ao criar o acesso. Eles ficam
    // visíveis no schema e são escondidos pelos hooks no fim deste arquivo.
    ["password_reset_token", "remember_token"].forEach((n) => {
      const f = col.fields.getByName(n);
      if (f) f.hidden = false;
    });
    app.save(col);
  } catch (err) {
    console.log("[seguranca-etapa1] Erro em users:", err);
  }

  // ---- S16: campos "únicos" passam a ser únicos POR EMPRESA. Antes, duas
  // empresas não podiam cadastrar o mesmo fornecedor (CNPJ), a mesma placa,
  // nem usar o mesmo código interno — e só podia existir UM veículo sem
  // chassi/RENAVAM no sistema inteiro. O índice novo é sempre menos restrito
  // que o antigo, então nunca falha por dado já existente.
  const SEG_UNICOS = [
    ["abastecimentos", "id_unico"], ["centro_custos", "codigo"], ["compras", "numero"], ["compras", "id_unico"],
    ["documentos", "id_unico"], ["empresas", "cnpj"], ["empresas", "razao_social"], ["epis", "id_unico"],
    ["equipes", "id_unico"], ["escalas", "id_unico"], ["fornecedores", "cnpj"], ["fornecedores", "id_unico"],
    ["licenciamentos", "id_unico"], ["manutencoes", "id_unico"], ["motoristas", "cnh"], ["pedidos_compra", "numero"],
    ["quilometragem", "id_unico"], ["solicitacoes_compra", "id_unico"], ["treinamentos", "id_unico"],
    ["veiculo", "plate"], ["veiculos", "id_unico"], ["veiculos", "placa"], ["veiculos", "chassi"], ["veiculos", "renavam"],
  ];
  SEG_UNICOS.forEach(([name, campo]) => {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (!col.fields.getByName("company_id") || !col.fields.getByName(campo)) return;
      const novo = `idx_${name}_${campo}_empresa`;
      const atuais = [];
      for (let i = 0; i < col.indexes.length; i++) atuais.push(String(col.indexes[i]));
      if (atuais.some((ix) => ix.includes(novo))) return;
      const soCampo = new RegExp(`^CREATE UNIQUE INDEX .*\\(\\s*\`?${campo}\`?\\s*\\)`, "i");
      const mantidos = atuais.filter((ix) => !soCampo.test(ix));
      mantidos.push(`CREATE UNIQUE INDEX ${novo} ON ${name} (company_id, ${campo}) WHERE ${campo} != ''`);
      col.indexes = mantidos;
      app.save(col);
      console.log(`[seguranca-etapa1] ${name}.${campo}: único por empresa.`);
    } catch (err) {
      console.log(`[seguranca-etapa1] Erro no índice ${name}.${campo}:`, err);
    }
  });

  // ---- Excluir vira ARQUIVAR (regra do documento mestre: nunca apagar o
  // que tem histórico). O pedido de exclusão das telas é convertido pelo
  // hook onRecordDeleteRequest no fim deste arquivo; aqui: campo
  // deleted_at, arquivados fora das listas e fora dos campos únicos.
  const SEG_ARQUIVAVEIS = [
    "materiais", "funcionarios", "empresas", "epis", "equipamentos", "fornecedores", "clientes", "veiculos",
    "solicitacoes", "compras", "propostas", "contas_receber", "treinamentos",
  ];
  SEG_ARQUIVAVEIS.forEach((name) => {
    try {
      let col = app.findCollectionByNameOrId(name);
      if (!col.fields.getByName("deleted_at")) {
        col.fields.add(new DateField({ name: "deleted_at" }));
        app.save(col);
        col = app.findCollectionByNameOrId(name);
      }
      const lr = col.listRule === null ? null : String(col.listRule);
      if (lr !== null && !lr.includes("deleted_at")) {
        col.listRule = `(${lr}) && deleted_at = ""`;
      }
      // Únicos (CNPJ, placa, código...) não contam os arquivados.
      const idx = [];
      for (let i = 0; i < col.indexes.length; i++) idx.push(String(col.indexes[i]));
      col.indexes = idx.map((ix) =>
        /^CREATE UNIQUE INDEX/i.test(ix) && !ix.includes("deleted_at")
          ? (/ WHERE /i.test(ix) ? `${ix} AND deleted_at = ''` : `${ix} WHERE deleted_at = ''`)
          : ix);
      app.save(col);
    } catch (err) {
      console.log(`[seguranca-etapa1] Erro ao preparar arquivamento de ${name}:`, err);
    }
  });

  console.log("[seguranca-etapa1] Regras de segurança e separação por empresa aplicadas.");
});

// Telas antigas não mandam company_id em algumas coleções (documentos,
// leituras de QR, logs). O servidor preenche com a empresa de quem está
// logado, para o registro não ficar sem dono.
onRecordCreateRequest((e) => {
  try {
    const col = e.record.collection();
    if (e.auth && col.fields.getByName("company_id") && !e.record.get("company_id")) {
      e.record.set("company_id", e.auth.get("company_id"));
    }
  } catch (_) {}
  e.next();
});

// Logs gravados pelo próprio servidor (login, criação de usuário) também
// recebem a empresa do usuário envolvido.
onRecordCreate((e) => {
  try {
    if (!e.record.get("company_id")) {
      const uid = e.record.get("usuarioId") || e.record.get("usuario_id");
      if (uid) {
        e.record.set("company_id", $app.findRecordById("users", uid).get("company_id"));
      }
    }
  } catch (_) {}
  e.next();
}, "auditoria", "audit_logs");

// S6: o token do convite (e o "lembrar login") nunca sai nas respostas da
// API para quem não é superusuário...
onRecordEnrich((e) => {
  const info = e.requestInfo;
  if (!(info && info.auth && info.auth.isSuperuser())) {
    e.record.hide("password_reset_token", "remember_token");
  }
  e.next();
}, "users");

// ...nem pode ser descoberto por busca (?filter=password_reset_token~"a").
onRecordsListRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    const q = e.requestInfo().query || {};
    const texto = String(q["filter"] || "") + " " + String(q["sort"] || "");
    if (/password_reset_token|remember_token/.test(texto)) {
      throw new BadRequestError("Filtro não permitido.");
    }
  }
  e.next();
}, "users");

// Excluir vira ARQUIVAR: o registro some das listas mas fica no banco (com
// a data em deleted_at), e o histórico (movimentações, compras antigas)
// continua mostrando o nome. Quem pode "excluir" continua sendo decidido
// pela regra de exclusão da coleção. Usuários são só inativados (a Gestão
// de Acessos mostra e permite reativar). Superusuário apaga de verdade.
onRecordDeleteRequest((e) => {
  if (e.auth && e.auth.isSuperuser()) return e.next();

  const r = e.record;
  const col = r.collection();
  const regra = col.deleteRule === null ? null : String(col.deleteRule);
  if (regra === null || !$app.canAccessRecord(r, e.requestInfo(), regra)) {
    throw new ForbiddenError("Você não tem permissão para excluir este registro.");
  }

  const INATIVO = {
    materiais: "inactive", funcionarios: "Inativo", empresas: "Inativo", epis: "Inativo",
    equipamentos: "inactive", clientes: "Inativo", veiculos: "Inativo", users: "Inativo",
  };
  if (col.name !== "users") r.set("deleted_at", new Date().toISOString().replace("T", " "));
  if (INATIVO[col.name]) r.set("status", INATIVO[col.name]);
  if (col.name === "users") {
    r.set("is_active", false);
    // Convite pendente deixa de valer: quem foi excluído não reativa a conta
    // pelo link antigo nem pelo "Esqueci minha senha".
    r.set("password_reset_token", "");
    r.set("password_reset_expires", "");
  }
  $app.saveNoValidate(r);
  return e.noContent(204);
}, "materiais", "funcionarios", "empresas", "epis", "equipamentos", "fornecedores", "clientes", "veiculos",
   "solicitacoes", "compras", "propostas", "contas_receber", "treinamentos", "users");
