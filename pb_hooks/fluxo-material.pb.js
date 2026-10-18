/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Etapa 4.1 (documento mestre, fluxo 1 — material de consumo):
//   pedir → aprovar → separar → entregar (baixa no estoque) → confirmar
//   recebimento.
//
// - solicitacoes_itens: os materiais e quantidades de cada solicitação.
// - Status novos em solicitacoes: "Em separação" e "Entregue".
// - Numa solicitação COM itens o servidor exige a ordem dos passos:
//     Aberta/Em análise/Aguardando aprovação → Aprovada | Rejeitada | Cancelada
//     Aprovada → Em separação | Cancelada
//     Em separação → Entregue | Cancelada
//     Entregue → Concluída   (confirmação de recebimento)
//   Ao virar "Entregue", cada item gera uma saída de estoque (Consumo de Obra
//   se tiver obra, senão Saída), ligada à solicitação; sem saldo, a entrega é
//   recusada e nada é gravado (transação).
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
    ["Em separação", "Entregue"].forEach((v) => { if (!valores.includes(v)) { valores.push(v); mudou = true; } });
    if (mudou) { st.values = valores; app.save(sol); }

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

// Mudança de status em transação (a entrega grava várias saídas).
onRecordUpdateRequest((e) => {
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
    "Em separação": ["Entregue", "Cancelada"],
    "Entregue": ["Concluída"],
  };
  if (!(PODE[antes] || []).includes(depois)) {
    throw new BadRequestError(`Passo fora de ordem: de "${antes}" não dá para ir para "${depois}".`);
  }

  if (depois === "Entregue") {
    const movCol = e.app.findCollectionByNameOrId("movimentacoes");
    itens.forEach((it) => {
      const mat = e.app.findRecordById("materiais", it.get("material_id"));
      const mov = new Record(movCol);
      mov.set("company_id", r.get("company_id"));
      mov.set("material_id", it.get("material_id"));
      mov.set("tipo", r.get("obra_id") ? "Consumo de Obra" : "Saída");
      mov.set("quantidade", it.get("quantidade"));
      mov.set("unidade", it.get("unidade") || mat.get("unit") || "un");
      mov.set("valor_unitario", mat.get("unit_cost") || 0);
      mov.set("valor_total", Number(((mat.get("unit_cost") || 0) * it.get("quantidade")).toFixed(2)));
      mov.set("obra_id", r.get("obra_id") || "");
      mov.set("origem", "Almoxarifado");
      mov.set("destino", r.get("obra_id") ? "Obra" : "Funcionário");
      mov.set("solicitante_id", r.get("solicitante_id") || "");
      mov.set("responsavel_id", r.get("atualizado_por") || "");
      mov.set("solicitacao_id", r.id);
      mov.set("status", "Aprovado");
      mov.set("observacoes", "Entrega da solicitação " + (r.get("numero_solicitacao") || r.id));
      mov.set("data", new Date().toISOString().replace("T", " "));
      try {
        e.app.save(mov); // o hook de estoque dá a baixa e recusa sem saldo
      } catch (err) {
        throw new BadRequestError(`Não foi possível entregar "${mat.get("name")}": ${err.message || err}`);
      }
      it.set("quantidade_entregue", it.get("quantidade"));
      it.set("movimentacao_id", mov.id);
      e.app.saveNoValidate(it);
    });
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
      || a.get("role") === "admin" || a.get("email") === "dnmltda@hotmail.com";
    if (!gestao) e.record.set("status", "Aberta");
  }
  e.next();
}, "solicitacoes");
