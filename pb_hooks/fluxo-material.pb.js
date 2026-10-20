/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Etapa 4.1 (documento mestre, fluxo 1 — material de consumo), ajustado
// a pedido do Diego (19/10/2026):
//   pedir → estoque confirma que recebeu o pedido → separa → "Pronto para
//   retirada" → quem pediu confere e ACEITA na retirada (só aí o material
//   sai do estoque) ou recusa com o motivo (volta para separação).
//
// - solicitacoes_itens: os materiais e quantidades de cada solicitação.
// - Status novos em solicitacoes: "Em separação", "Pronto para retirada" e
//   "Entregue" (este só para pedidos antigos, do fluxo anterior).
// - Numa solicitação COM itens o servidor exige a ordem dos passos:
//     Aberta/Em análise/Aguardando aprovação → Aprovada | Rejeitada | Cancelada
//     Aprovada → Em separação | Cancelada
//     Em separação → Pronto para retirada | Cancelada
//     Pronto para retirada → Concluída (aceite) | Em separação (recusa) | Cancelada
//     Entregue → Concluída   (pedidos antigos)
//   No aceite, cada item gera uma saída de estoque ligada à solicitação. Se
//   quem pediu tem cadastro de funcionário, é "Retirada por Funcionário" e o
//   material entra no saldo dele (depois ele registra onde usou); senão é
//   Consumo de Obra (com obra) ou Saída. Sem saldo, o aceite é recusado e nada
//   é gravado (transação).
// - Aceitar na retirada: quem pediu, ou o almoxarifado registrando no balcão;
//   sempre com a foto de quem leva (foto_retirada, ver foto-retirada.pb.js).
//   Recusar: só quem pediu (ou o administrador).
// - Itens só podem ser incluídos/alterados enquanto a solicitação não foi
//   aprovada.
// Solicitações sem itens (RH, transporte...) continuam com o fluxo livre.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    const sol = app.findCollectionByNameOrId("solicitacoes");
    const st = sol.fields.getByName("status");
    const valores = [];
    for (let i = 0; i < st.values.length; i++) valores.push(String(st.values[i]));
    let mudou = false;
    ["Em separação", "Pronto para retirada", "Entregue"].forEach((v) => { if (!valores.includes(v)) { valores.push(v); mudou = true; } });
    if (mudou) { st.values = valores; app.save(sol); }
    const solAtual = app.findCollectionByNameOrId("solicitacoes");
    let novos = false;
    if (!solAtual.fields.getByName("retirada_recusa_motivo")) {
      solAtual.fields.add(new TextField({ name: "retirada_recusa_motivo", max: 1000 }));
      novos = true;
    }
    if (!solAtual.fields.getByName("separado_por")) {
      solAtual.fields.add(new RelationField({ name: "separado_por", collectionId: app.findCollectionByNameOrId("users").id, maxSelect: 1 }));
      novos = true;
    }
    if (novos) app.save(solAtual);

    const mov = app.findCollectionByNameOrId("movimentacoes");
    if (!mov.fields.getByName("solicitacao_id")) {
      mov.fields.add(new RelationField({ name: "solicitacao_id", collectionId: sol.id, maxSelect: 1 }));
      app.save(mov);
    }

    let itens = null;
    try { itens = app.findCollectionByNameOrId("solicitacoes_itens"); } catch (_) {}
    if (!itens) {
      const SAME = '@request.auth.id != "" && @request.auth.company_id = company_id';
      itens = new Collection({
        type: "base",
        name: "solicitacoes_itens",
        listRule: SAME,
        viewRule: SAME,
        createRule: '@request.auth.id != "" && (@request.body.company_id:isset = false || @request.body.company_id = @request.auth.company_id)',
        updateRule: SAME,
        deleteRule: SAME,
        fields: [
          { name: "company_id", type: "relation", collectionId: app.findCollectionByNameOrId("companies").id, maxSelect: 1 },
          { name: "solicitacao_id", type: "relation", collectionId: sol.id, maxSelect: 1, required: true, cascadeDelete: true },
          { name: "material_id", type: "relation", collectionId: app.findCollectionByNameOrId("materiais").id, maxSelect: 1, required: true },
          { name: "quantidade", type: "number", required: true, min: 0.0001 },
          { name: "unidade", type: "text" },
          { name: "quantidade_entregue", type: "number" },
          { name: "movimentacao_id", type: "relation", collectionId: mov.id, maxSelect: 1 },
          { name: "observacao", type: "text" },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE INDEX idx_solicitacoes_itens_sol ON solicitacoes_itens (solicitacao_id)"],
      });
      app.save(itens);
      console.log("[fluxo-material] coleção solicitacoes_itens criada.");
    }
  } catch (err) {
    console.log("[fluxo-material] Erro ao preparar o fluxo:", err);
  }
});

// Itens: empresa vem da solicitação; só mexe antes da aprovação.
onRecordCreate((e) => {
  const sol = e.app.findRecordById("solicitacoes", e.record.get("solicitacao_id"));
  if (!["Aberta", "Em análise", "Aguardando aprovação", "draft", "pending"].includes(sol.get("status"))) {
    throw new BadRequestError("Só dá para incluir material antes da aprovação.");
  }
  e.record.set("company_id", sol.get("company_id"));
  if (!e.record.get("unidade")) {
    try { e.record.set("unidade", e.app.findRecordById("materiais", e.record.get("material_id")).get("unit") || "un"); } catch (_) {}
  }
  e.record.set("quantidade_entregue", 0);
  e.record.set("movimentacao_id", "");
  e.next();
}, "solicitacoes_itens");

onRecordUpdateRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    const sol = e.app.findRecordById("solicitacoes", e.record.get("solicitacao_id"));
    if (!["Aberta", "Em análise", "Aguardando aprovação", "draft", "pending"].includes(sol.get("status"))) {
      throw new BadRequestError("Os materiais não podem mudar depois da aprovação.");
    }
    ["solicitacao_id", "company_id", "quantidade_entregue", "movimentacao_id"].forEach((f) => e.record.set(f, e.record.original().get(f)));
  }
  e.next();
}, "solicitacoes_itens");

onRecordDeleteRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    const sol = e.app.findRecordById("solicitacoes", e.record.get("solicitacao_id"));
    if (!["Aberta", "Em análise", "Aguardando aprovação", "draft", "pending"].includes(sol.get("status"))) {
      throw new BadRequestError("Os materiais não podem sair depois da aprovação.");
    }
  }
  e.next();
}, "solicitacoes_itens");

// Mudança de status em transação (o aceite grava várias saídas).
onRecordUpdateRequest((e) => {
  const a = e.auth;
  const r = e.record;
  const antes = r.original().get("status");
  const depois = r.get("status");
  if (a && !a.isSuperuser() && antes !== depois) {
    const lib = require(`${__hooks}/uso-material-lib.js`);
    if (antes === "Pronto para retirada" && depois === "Concluída") {
      // Retirada: quem pediu aceita, ou o almoxarifado registra no balcão.
      // Nos dois casos vai a foto de quem está levando (câmera do aparelho).
      if (r.get("solicitante_id") !== a.id && !lib.ehGestao(a)) {
        throw new ForbiddenError("Quem confere e aceita o material é a pessoa que fez o pedido.");
      }
      if (!r.getUnsavedFiles("foto_retirada").length) {
        throw new BadRequestError("Tire a foto de quem está retirando o material.");
      }
      r.set("retirada_registrada_por", a.id);
    } else if (antes === "Pronto para retirada" && depois === "Em separação") {
      if (r.get("solicitante_id") !== a.id && !lib.ehAdmin(a)) {
        throw new ForbiddenError("Quem confere e aceita o material é a pessoa que fez o pedido.");
      }
      if (depois === "Em separação" && !String(r.get("retirada_recusa_motivo") || "").trim()) {
        throw new BadRequestError("Diga o que está errado no material para o estoque corrigir.");
      }
    } else if (["Em separação", "Pronto para retirada"].includes(depois) && !lib.ehGestao(a)) {
      throw new ForbiddenError("Só o almoxarifado separa o material.");
    }
    if (depois === "Pronto para retirada") {
      r.set("separado_por", a.id);
      r.set("retirada_recusa_motivo", "");
    }
  }
  // A foto da retirada só entra no aceite; depois ninguém troca nem apaga.
  if (a && !a.isSuperuser() && !(antes === "Pronto para retirada" && depois === "Concluída")) {
    r.set("foto_retirada", r.original().get("foto_retirada"));
    r.set("retirada_registrada_por", r.original().get("retirada_registrada_por"));
  }
  // De qual estoque sai (geral ou da obra): quem separa escolhe ao marcar
  // "Pronto para retirada"; depois disso ninguém troca.
  if (a && !a.isSuperuser() && !(antes !== depois && depois === "Pronto para retirada")) {
    r.set("estoque_obra_id", r.original().get("estoque_obra_id"));
  }
  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    e.next();
  });
}, "solicitacoes");

onRecordUpdateExecute((e) => {
  const r = e.record;
  const antes = r.original().get("status");
  const depois = r.get("status");
  if (antes === depois) return e.next();

  const itens = e.app.findRecordsByFilter("solicitacoes_itens", "solicitacao_id = {:s}", "created", 0, 0, { s: r.id });
  if (!itens.length) return e.next(); // sem itens: fluxo livre de antes

  const PODE = {
    "Aberta": ["Aprovada", "Rejeitada", "Cancelada", "Em análise", "Aguardando aprovação"],
    "Em análise": ["Aprovada", "Rejeitada", "Cancelada", "Aguardando aprovação"],
    "Aguardando aprovação": ["Aprovada", "Rejeitada", "Cancelada"],
    "Aprovada": ["Em separação", "Cancelada"],
    "Em separação": ["Pronto para retirada", "Cancelada"],
    "Pronto para retirada": ["Concluída", "Em separação", "Cancelada"],
    "Entregue": ["Concluída"],
  };
  if (!(PODE[antes] || []).includes(depois)) {
    throw new BadRequestError(`Passo fora de ordem: de "${antes}" não dá para ir para "${depois}".`);
  }

  const lib = require(`${__hooks}/uso-material-lib.js`);
  const ref = "solicitacao:" + r.id;
  const numero = r.get("numero_solicitacao") || r.id;

  if (antes === "Pronto para retirada" && depois === "Concluída") {
    // Quem pediu tem cadastro de funcionário? Então o material vai para o
    // saldo dele, e depois ele registra onde usou.
    let funcId = "";
    try {
      const sol = e.app.findRecordById("users", r.get("solicitante_id"));
      const f = sol.get("funcionario_id");
      if (f) {
        const func = e.app.findRecordById("funcionarios", f);
        if (!func.getString("deleted_at")) funcId = f;
      }
    } catch (_) {}
    const movCol = e.app.findCollectionByNameOrId("movimentacoes");
    const saldoCol = e.app.findCollectionByNameOrId("saldo_funcionario");
    const agora = new Date();
    itens.forEach((it) => {
      const mat = e.app.findRecordById("materiais", it.get("material_id"));
      const mov = new Record(movCol);
      mov.set("company_id", r.get("company_id"));
      mov.set("material_id", it.get("material_id"));
      mov.set("tipo", funcId ? "Retirada por Funcionário" : (r.get("obra_id") ? "Consumo de Obra" : "Saída"));
      mov.set("quantidade", it.get("quantidade"));
      mov.set("unidade", it.get("unidade") || mat.get("unit") || "un");
      mov.set("valor_unitario", mat.get("unit_cost") || 0);
      mov.set("valor_total", Number(((mat.get("unit_cost") || 0) * it.get("quantidade")).toFixed(2)));
      mov.set("obra_id", r.get("obra_id") || "");
      mov.set("estoque_obra_id", r.get("estoque_obra_id") || "");
      mov.set("origem", r.get("estoque_obra_id") ? "Estoque da obra" : "Almoxarifado");
      mov.set("destino", funcId || !r.get("obra_id") ? "Funcionário" : "Obra");
      mov.set("funcionario_id", funcId);
      mov.set("solicitante_id", r.get("solicitante_id") || "");
      mov.set("responsavel_id", r.get("separado_por") || r.get("atualizado_por") || "");
      mov.set("solicitacao_id", r.id);
      mov.set("status", "Aprovado");
      mov.set("observacoes", "Entrega da solicitação " + (r.get("numero_solicitacao") || r.id));
      mov.set("data", new Date().toISOString().replace("T", " "));
      try {
        e.app.save(mov); // o hook de estoque dá a baixa e recusa sem saldo
      } catch (err) {
        throw new BadRequestError(`Não foi possível entregar "${mat.get("name")}": ${err.message || err}`);
      }
      if (funcId) {
        const sf = new Record(saldoCol);
        sf.set("company_id", r.get("company_id"));
        sf.set("funcionario_id", funcId);
        sf.set("material_id", it.get("material_id"));
        sf.set("tipo_operacao", "Retirada");
        sf.set("quantidade", it.get("quantidade"));
        sf.set("data_operacao", agora.toISOString().replace("T", " "));
        sf.set("hora_operacao", agora.toISOString().slice(11, 16));
        sf.set("obra_id", r.get("obra_id") || "");
        sf.set("movimentacao_id", mov.id);
        sf.set("responsavel_id", r.get("separado_por") || "");
        sf.set("criado_por", r.get("solicitante_id") || "");
        sf.set("observacoes", "Pedido " + numero);
        e.app.save(sf);
      }
      it.set("quantidade_entregue", it.get("quantidade"));
      it.set("movimentacao_id", mov.id);
      e.app.saveNoValidate(it);
    });
    lib.notificar(e.app, r.get("separado_por"), `Pedido ${numero}: material conferido e aceito na retirada.`, ref);
  } else if (depois === "Pronto para retirada") {
    lib.notificar(e.app, r.get("solicitante_id"), `Pedido ${numero}: material separado. Confira e aceite na retirada.`, ref);
  } else if (antes === "Pronto para retirada" && depois === "Em separação") {
    lib.notificar(e.app, r.get("separado_por"),
      `Pedido ${numero}: quem pediu recusou o material. Motivo: ${r.get("retirada_recusa_motivo")}`, ref);
  } else if (depois === "Aprovada") {
    lib.notificar(e.app, r.get("solicitante_id"), `Pedido ${numero}: o estoque recebeu o seu pedido.`, ref);
  }
  e.next();
}, "solicitacoes");

// Pedido novo de quem não é da gestão nasce sempre "Aberta" (o formulário
// tem o campo status; sem isto dava para criar já "Aprovada").
onRecordCreateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser()) {
    const cargo = a.get("cargo") || a.get("role");
    const gestao = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador"].includes(cargo)
      || a.get("role") === "admin" || a.get("dono_sistema") === true;
    if (!gestao) e.record.set("status", "Aberta");
  }
  e.next();
}, "solicitacoes");

// Pedido de material novo: avisa no sininho quem cuida do estoque.
onRecordAfterCreateSuccess((e) => {
  if (e.record.get("tipo") === "Material") {
    const lib = require(`${__hooks}/uso-material-lib.js`);
    const numero = e.record.get("numero_solicitacao") || e.record.id;
    lib.equipeDoEstoque(e.app, e.record.get("company_id")).forEach((u) => {
      if (u.id !== e.record.get("solicitante_id")) {
        lib.notificar(e.app, u.id, `Novo pedido de material: ${numero}. Confirme que recebeu e separe.`, "solicitacao:" + e.record.id);
      }
    });
  }
  e.next();
}, "solicitacoes");
