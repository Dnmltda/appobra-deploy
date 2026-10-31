/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Estrutura da obra: andares, unidades e serviços (pedido do Diego,
// 31/10/2026). 100% aditivo: obra sem tipo de estrutura (todas as que já
// existiam) continua exatamente como era.
//
//  - obras.tipo_estrutura: "Sem estrutura" (vazio conta igual), "Prédio", "Casa".
//  - obras_andares (Prédio): 1º, 2º... renomeáveis (Térreo, Subsolo).
//  - obras_unidades: "Andar inteiro", apartamento, área comum, quarto, cômodo.
//    andar_id vazio na Casa. Quem cadastra decide, andar a andar, se é o andar
//    inteiro ou dividido.
//  - obras_unidade_servicos: serviço de cada unidade com status (Não iniciado,
//    Em andamento, Concluído). Nome guardado na hora, para renomear/desativar
//    no catálogo sem perder o histórico.
//  - servicos_padrao: catálogo da empresa (o Administrador muda nas
//    Configurações, sem deploy).
//  - solicitacoes.unidade_id e saldo_funcionario.unidade_id (opcionais): para
//    qual andar/unidade é o material.
// Quem monta e muda status: Administrador, Gerência, Engenheiro e Mestre de
// Obras. Almoxarife, Funcionário e Diretoria só veem; Cliente só vê as obras
// em que está (clientes_acesso). Nada se apaga: tudo desativa.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    const lib = require(`${__hooks}/estrutura-obra-lib.js`);
    const companies = app.findCollectionByNameOrId("companies");
    const obras = app.findCollectionByNameOrId("obras");

    let mudou = false;
    if (!obras.fields.getByName("tipo_estrutura")) {
      obras.fields.add(new SelectField({ name: "tipo_estrutura", maxSelect: 1, values: ["Sem estrutura", "Prédio", "Casa"] }));
      mudou = true;
    }
    // As regras abaixo usam obras.clientes_acesso (obras-cliente.pb.js); a ordem
    // de subida dos arquivos não é garantida, então o campo é criado aqui também.
    if (!obras.fields.getByName("clientes_acesso")) {
      obras.fields.add(new RelationField({ name: "clientes_acesso", collectionId: "_pb_users_auth_", maxSelect: 50, required: false }));
      mudou = true;
    }
    if (mudou) app.save(obras);

    const SAME = '@request.auth.id != "" && @request.auth.company_id = company_id';
    const ADMIN = '(@request.auth.cargo = "Administrador" || @request.auth.role = "admin" || @request.auth.role = "Administrador" || @request.auth.dono_sistema = true)';
    const EDITA = '(@request.auth.cargo = "Administrador" || @request.auth.cargo = "Gerência" || @request.auth.cargo = "Engenheiro" || ' +
      '@request.auth.cargo = "Mestre de Obras" || @request.auth.role = "admin" || @request.auth.role = "Administrador" || @request.auth.dono_sistema = true)';
    const VE = `${SAME} && (@request.auth.cargo != "Cliente" || obra_id.clientes_acesso.id ?= @request.auth.id)`;

    const criar = (nome, campos, regras, indices) => {
      let col = null;
      try { col = app.findCollectionByNameOrId(nome); } catch (_) {}
      if (!col) {
        col = new Collection({
          type: "base", name: nome,
          fields: [
            { name: "company_id", type: "relation", collectionId: companies.id, maxSelect: 1, required: true },
            ...campos,
            { name: "criado_por", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
            { name: "created", type: "autodate", onCreate: true },
            { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
          ],
          indexes: indices || [],
        });
        console.log(`[estrutura-obra] coleção ${nome} criada.`);
      }
      Object.assign(col, regras, { deleteRule: null });
      app.save(col);
      return col;
    };

    criar("servicos_padrao", [
      { name: "nome", type: "text", required: true, max: 80 },
      { name: "ordem", type: "number" },
      { name: "ativo", type: "bool" },
    ], { listRule: SAME, viewRule: SAME, createRule: `${SAME} && ${ADMIN}`, updateRule: `${SAME} && ${ADMIN}` },
    ["CREATE INDEX idx_servicos_padrao_empresa ON servicos_padrao (company_id)"]);

    const andares = criar("obras_andares", [
      { name: "obra_id", type: "relation", collectionId: obras.id, maxSelect: 1, required: true },
      { name: "numero", type: "number" },
      { name: "nome", type: "text", required: true, max: 60 },
      { name: "ordem", type: "number" },
      { name: "ativo", type: "bool" },
    ], { listRule: VE, viewRule: VE, createRule: `${SAME} && ${EDITA}`, updateRule: `${SAME} && ${EDITA}` },
    ["CREATE INDEX idx_obras_andares_obra ON obras_andares (obra_id)"]);

    const unidades = criar("obras_unidades", [
      { name: "obra_id", type: "relation", collectionId: obras.id, maxSelect: 1, required: true },
      { name: "andar_id", type: "relation", collectionId: andares.id, maxSelect: 1 },
      { name: "nome", type: "text", required: true, max: 60 },
      { name: "tipo", type: "select", maxSelect: 1, values: ["Andar inteiro", "Apartamento", "Área comum", "Quarto", "Cômodo"] },
      { name: "ordem", type: "number" },
      { name: "ativo", type: "bool" },
    ], { listRule: VE, viewRule: VE, createRule: `${SAME} && ${EDITA}`, updateRule: `${SAME} && ${EDITA}` },
    ["CREATE INDEX idx_obras_unidades_obra ON obras_unidades (obra_id, andar_id)"]);

    const catalogo = app.findCollectionByNameOrId("servicos_padrao");
    criar("obras_unidade_servicos", [
      { name: "obra_id", type: "relation", collectionId: obras.id, maxSelect: 1, required: true },
      { name: "unidade_id", type: "relation", collectionId: unidades.id, maxSelect: 1, required: true },
      { name: "servico_id", type: "relation", collectionId: catalogo.id, maxSelect: 1 },
      { name: "servico_nome", type: "text", max: 80 },
      { name: "status", type: "select", maxSelect: 1, values: lib.STATUS },
      { name: "alterado_por", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
      { name: "alterado_em", type: "date" },
      { name: "ativo", type: "bool" },
    ], { listRule: VE, viewRule: VE, createRule: `${SAME} && ${EDITA}`, updateRule: `${SAME} && ${EDITA}` },
    ["CREATE INDEX idx_obras_unidade_servicos_unidade ON obras_unidade_servicos (unidade_id)",
      "CREATE INDEX idx_obras_unidade_servicos_obra ON obras_unidade_servicos (obra_id)"]);

    // Campo opcional "para qual andar/unidade" no pedido e no "Registrar uso".
    ["solicitacoes", "saldo_funcionario"].forEach((nome) => {
      const col = app.findCollectionByNameOrId(nome);
      if (!col.fields.getByName("unidade_id")) {
        col.fields.add(new RelationField({ name: "unidade_id", collectionId: unidades.id, maxSelect: 1, required: false }));
        app.save(col);
      }
    });

    // Catálogo inicial de cada empresa que ainda não tem.
    let n = 0;
    app.findRecordsByFilter("companies", "id != ''", "", 0, 0).forEach((c) => { n += lib.semearCatalogo(app, c.id) ? 1 : 0; });
    if (n) console.log(`[estrutura-obra] catálogo de serviços criado em ${n} empresa(s).`);
  } catch (err) {
    console.log("[estrutura-obra] Erro ao preparar a estrutura das obras:", err);
  }
});

// Empresa nova já nasce com o catálogo de serviços.
onRecordAfterCreateSuccess((e) => {
  try { require(`${__hooks}/estrutura-obra-lib.js`).semearCatalogo(e.app, e.record.id); } catch (err) {
    console.log("[estrutura-obra] Erro ao criar o catálogo da empresa nova:", err);
  }
  e.next();
}, "companies");

// ---- Montar a estrutura (uma chamada só, tudo ou nada)
// Prédio: { obra_id, tipo: "Prédio", andares: 12 } → 1º ao 12º andar (sem
//   unidades: cada andar é dividido depois, um a um).
// Casa: { obra_id, tipo: "Casa", quartos: 3, comodos: ["Cozinha", ...] }.
routerAdd("POST", "/api/custom/estrutura/gerar", (e) => {
  const lib = require(`${__hooks}/estrutura-obra-lib.js`);
  const a = e.auth;
  if (!lib.podeEditar(a)) throw new ForbiddenError("Seu cargo não monta a estrutura da obra.");
  const d = new DynamicModel({ obra_id: "", tipo: "", andares: 0, quartos: 0, comodos: [] });
  e.bindBody(d);
  const tipo = String(d.tipo || "");
  if (tipo !== "Prédio" && tipo !== "Casa") throw new BadRequestError("Escolha Prédio ou Casa.");
  let obra;
  try { obra = $app.findRecordById("obras", String(d.obra_id || "")); } catch (_) { throw new NotFoundError("Obra não encontrada."); }
  if (!a.isSuperuser() && obra.get("company_id") !== a.get("company_id")) throw new NotFoundError("Obra não encontrada.");
  const ja = $app.findRecordsByFilter("obras_unidades", "obra_id = {:o}", "", 1, 0, { o: obra.id }).length
    + $app.findRecordsByFilter("obras_andares", "obra_id = {:o}", "", 1, 0, { o: obra.id }).length;
  if (ja) throw new BadRequestError("Esta obra já tem estrutura. Inclua andares ou unidades pela tela de andamento.");
  const andaresN = Math.floor(Number(d.andares || 0));
  const quartosN = Math.floor(Number(d.quartos || 0));
  const comodos = [];
  for (let i = 0; i < (d.comodos || []).length; i++) {
    const c = String(d.comodos[i] || "").trim().slice(0, 60);
    if (c && !comodos.includes(c)) comodos.push(c);
  }
  if (tipo === "Prédio" && (andaresN < 1 || andaresN > 200)) throw new BadRequestError("Informe quantos andares (de 1 a 200).");
  if (tipo === "Casa" && (quartosN < 0 || quartosN > 30 || quartosN + comodos.length < 1)) throw new BadRequestError("Informe os quartos e/ou os cômodos da casa.");

  $app.runInTransaction((tx) => {
    obra.set("tipo_estrutura", tipo);
    tx.saveNoValidate(obra);
    const cid = obra.get("company_id");
    const quem = a.isSuperuser() ? "" : a.id;
    if (tipo === "Prédio") {
      const col = tx.findCollectionByNameOrId("obras_andares");
      for (let i = 1; i <= andaresN; i++) {
        const r = new Record(col);
        r.set("company_id", cid); r.set("obra_id", obra.id); r.set("numero", i); r.set("nome", `${i}º andar`);
        r.set("ordem", i); r.set("ativo", true); r.set("criado_por", quem);
        tx.save(r);
      }
    } else {
      const col = tx.findCollectionByNameOrId("obras_unidades");
      const nomes = [];
      for (let i = 1; i <= quartosN; i++) nomes.push([`Quarto ${i}`, "Quarto"]);
      comodos.forEach((c) => nomes.push([c, "Cômodo"]));
      nomes.forEach(([nome, t], i) => {
        const r = new Record(col);
        r.set("company_id", cid); r.set("obra_id", obra.id); r.set("nome", nome); r.set("tipo", t);
        r.set("ordem", i + 1); r.set("ativo", true); r.set("criado_por", quem);
        tx.save(r);
        lib.servicosIniciais(tx, r);
      });
    }
  });
  lib.gravarProgresso($app, obra.id);
  return e.json(200, { ok: true });
});

// ---- Dividir um andar: { andar_id, modo: "inteiro" } ou
// { andar_id, modo: "dividido", aptos: 4, comuns: ["Corredor"] } → Apto 301..304.
// Se o andar estava "inteiro", a unidade "Andar inteiro" é desativada (fica no
// histórico).
routerAdd("POST", "/api/custom/estrutura/dividir", (e) => {
  const lib = require(`${__hooks}/estrutura-obra-lib.js`);
  const a = e.auth;
  if (!lib.podeEditar(a)) throw new ForbiddenError("Seu cargo não monta a estrutura da obra.");
  const d = new DynamicModel({ andar_id: "", modo: "", aptos: 0, comuns: [] });
  e.bindBody(d);
  let andar;
  try { andar = $app.findRecordById("obras_andares", String(d.andar_id || "")); } catch (_) { throw new NotFoundError("Andar não encontrado."); }
  if (!a.isSuperuser() && andar.get("company_id") !== a.get("company_id")) throw new NotFoundError("Andar não encontrado.");
  const modo = String(d.modo || "");
  const aptos = Math.floor(Number(d.aptos || 0));
  const comuns = [];
  for (let i = 0; i < (d.comuns || []).length; i++) {
    const c = String(d.comuns[i] || "").trim().slice(0, 60);
    if (c && !comuns.includes(c)) comuns.push(c);
  }
  if (modo !== "inteiro" && modo !== "dividido") throw new BadRequestError("Escolha andar inteiro ou dividido.");
  if (modo === "dividido" && (aptos < 0 || aptos > 60 || aptos + comuns.length < 1)) throw new BadRequestError("Informe os apartamentos e/ou as áreas comuns.");
  const atuais = $app.findRecordsByFilter("obras_unidades", "andar_id = {:a} && ativo = true", "ordem", 0, 0, { a: andar.id });
  if (modo === "inteiro" && atuais.length) throw new BadRequestError("Este andar já tem unidades.");

  $app.runInTransaction((tx) => {
    const col = tx.findCollectionByNameOrId("obras_unidades");
    const quem = a.isSuperuser() ? "" : a.id;
    const nova = (nome, tipo, ordem) => {
      const r = new Record(col);
      r.set("company_id", andar.get("company_id")); r.set("obra_id", andar.get("obra_id")); r.set("andar_id", andar.id);
      r.set("nome", nome); r.set("tipo", tipo); r.set("ordem", ordem); r.set("ativo", true); r.set("criado_por", quem);
      tx.save(r);
      lib.servicosIniciais(tx, r);
    };
    if (modo === "inteiro") {
      nova("Andar inteiro", "Andar inteiro", 1);
    } else {
      // "Andar inteiro" vira histórico; os serviços dele também saem da conta.
      atuais.filter((u) => u.get("tipo") === "Andar inteiro").forEach((u) => {
        const x = tx.findRecordById("obras_unidades", u.id);
        x.set("ativo", false);
        tx.save(x);
      });
      const n = Number(andar.get("numero") || 0);
      let ordem = atuais.length;
      for (let i = 1; i <= aptos; i++) nova(n > 0 ? `Apto ${n}${String(i).padStart(2, "0")}` : `Apto ${i}`, "Apartamento", ++ordem);
      comuns.forEach((c) => nova(c, "Área comum", ++ordem));
    }
  });
  lib.gravarProgresso($app, andar.get("obra_id"));
  return e.json(200, { ok: true });
});

// ---- Gravações avulsas pela API (incluir andar/unidade/serviço, renomear,
// desativar, mudar status): o servidor confere e carimba.
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/estrutura-obra-lib.js`);
  const r = e.record;
  const obra = e.app.findRecordById("obras", r.get("obra_id"));
  const t = obra.get("tipo_estrutura");
  if (t !== "Prédio" && t !== "Casa") throw new BadRequestError("Defina antes se a obra é Prédio ou Casa.");
  r.set("company_id", obra.get("company_id"));
  r.set("ativo", true);
  if (e.collection.name === "obras_andares" && t !== "Prédio") throw new BadRequestError("Só prédio tem andares.");
  if (e.collection.name === "obras_unidades") {
    const andarId = r.get("andar_id");
    if (t === "Prédio" && !andarId) throw new BadRequestError("Escolha o andar da unidade.");
    if (t === "Casa" && andarId) throw new BadRequestError("Casa não tem andares.");
    if (andarId && e.app.findRecordById("obras_andares", andarId).get("obra_id") !== obra.id) throw new BadRequestError("O andar não é desta obra.");
  }
  if (e.collection.name === "obras_unidade_servicos") {
    const u = e.app.findRecordById("obras_unidades", r.get("unidade_id"));
    if (u.get("obra_id") !== obra.id) throw new BadRequestError("A unidade não é desta obra.");
    const s = e.app.findRecordById("servicos_padrao", r.get("servico_id"));
    if (s.get("company_id") !== obra.get("company_id") || !s.get("ativo")) throw new BadRequestError("Escolha um serviço ativo do catálogo.");
    r.set("servico_nome", s.get("nome"));
    r.set("status", "Não iniciado");
    r.set("alterado_por", "");
    r.set("alterado_em", "");
  }
  e.next();
  // Unidade nova (incluída avulsa) já recebe os serviços do catálogo.
  if (e.collection.name === "obras_unidades") lib.servicosIniciais($app, e.record);
  lib.gravarProgresso($app, obra.id);
}, "obras_andares", "obras_unidades", "obras_unidade_servicos");

onRecordUpdateRequest((e) => {
  const r = e.record;
  const o = r.original();
  // Fixos depois de criados: obra, andar, empresa, serviço e o nome guardado.
  ["obra_id", "andar_id", "unidade_id", "servico_id", "servico_nome", "company_id", "criado_por", "numero"].forEach((f) => {
    if (e.collection.fields.getByName(f)) r.set(f, o.get(f));
  });
  if (e.collection.name === "obras_unidade_servicos") {
    if (r.get("status") !== o.get("status")) {
      r.set("alterado_por", e.auth && !e.auth.isSuperuser() ? e.auth.id : "");
      r.set("alterado_em", new Date().toISOString().replace("T", " "));
    } else {
      r.set("alterado_por", o.get("alterado_por"));
      r.set("alterado_em", o.get("alterado_em"));
    }
  }
  e.next();
}, "obras_andares", "obras_unidades", "obras_unidade_servicos");

// Depois de gravado: histórico do status (quem, quando, antes e depois) e % da obra.
onRecordAfterUpdateSuccess((e) => {
  const r = e.record;
  const o = r.original();
  try {
    // (neste evento a tabela vem do próprio registro)
    if (r.collection().name === "obras_unidade_servicos" && r.get("status") !== o.get("status")) {
      const h = new Record(e.app.findCollectionByNameOrId("historico_alteracoes"));
      let nome = "";
      try { nome = e.app.findRecordById("users", r.get("alterado_por")).get("name") || ""; } catch (_) {}
      h.set("company_id", r.get("company_id"));
      h.set("usuario_id", r.get("alterado_por"));
      h.set("usuario_nome", nome);
      h.set("tabela", "obras_unidade_servicos");
      h.set("registro_id", r.id);
      h.set("campo", "status");
      h.set("antes", JSON.stringify(o.get("status") || ""));
      h.set("depois", JSON.stringify(r.get("status") || ""));
      e.app.save(h);
    }
  } catch (err) {
    console.log("[estrutura-obra] Erro ao gravar o histórico do status:", err);
  }
  require(`${__hooks}/estrutura-obra-lib.js`).gravarProgresso(e.app, r.get("obra_id"));
  e.next();
}, "obras_andares", "obras_unidades", "obras_unidade_servicos");

// Tipo de estrutura não muda depois de montada (os andares/unidades ficariam
// soltos). A % da obra com estrutura é sempre calculada pelo servidor.
onRecordUpdateRequest((e) => {
  const o = e.record.original();
  const su = !!(e.auth && e.auth.isSuperuser());
  const antes = o.get("tipo_estrutura") || "Sem estrutura";
  const depois = e.record.get("tipo_estrutura") || "Sem estrutura";
  if (antes !== depois && !su) {
    const tem = e.app.findRecordsByFilter("obras_unidades", "obra_id = {:o}", "", 1, 0, { o: o.id }).length
      + e.app.findRecordsByFilter("obras_andares", "obra_id = {:o}", "", 1, 0, { o: o.id }).length;
    if (tem) throw new BadRequestError("O tipo de estrutura não muda depois que os andares/unidades foram montados.");
  }
  if ((antes === "Prédio" || antes === "Casa") && !su) e.record.set("progress_percentage", o.get("progress_percentage"));
  e.next();
}, "obras");

// Material para um andar/unidade (campo opcional): a unidade tem de ser da obra do registro.
onRecordCreateRequest((e) => {
  require(`${__hooks}/estrutura-obra-lib.js`).conferirUnidade(e);
  e.next();
}, "solicitacoes", "saldo_funcionario");
onRecordUpdateRequest((e) => {
  const o = e.record.original();
  if (String(e.record.get("unidade_id") || "") !== String(o.get("unidade_id") || "") || e.record.get("obra_id") !== o.get("obra_id")) {
    require(`${__hooks}/estrutura-obra-lib.js`).conferirUnidade(e);
  }
  e.next();
}, "solicitacoes", "saldo_funcionario");
