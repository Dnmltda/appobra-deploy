/// <reference path="../pb_data/types.d.ts" />
// ETAPA 15 — Cria a collection `saldo_funcionario` (razão/ledger de retiradas
// e devoluções de materiais por funcionário). Cada registro representa uma
// operação (Retirada ou Devolução); o saldo atual por (funcionario, material)
// é calculado somando as retiradas e subtraindo as devoluções.
// Integra-se com as collections existentes: funcionarios, materiais, obras,
// movimentacoes, users e companies (company_id). Não duplica materiais nem
// altera collections existentes.
migrate((app) => {
  const companies = app.findCollectionByNameOrId("companies");
  const funcionarios = app.findCollectionByNameOrId("funcionarios");
  const materiais = app.findCollectionByNameOrId("materiais");
  const obras = app.findCollectionByNameOrId("obras");
  const movimentacoes = app.findCollectionByNameOrId("movimentacoes");
  const users = app.findCollectionByNameOrId("users");

  let collection;
  try {
    collection = app.findCollectionByNameOrId("saldo_funcionario");
  } catch (_) {
    collection = new Collection({
      type: "base",
      name: "saldo_funcionario",
      listRule: '@request.auth.company_id = company_id',
      viewRule: '@request.auth.company_id = company_id',
      createRule: '@request.auth.company_id = company_id && @request.auth.role != "viewer"',
      updateRule: '@request.auth.company_id = company_id && @request.auth.role != "viewer"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: "company_id", type: "relation", required: true, maxSelect: 1, collectionId: companies.id, cascadeDelete: false },
        { name: "funcionario_id", type: "relation", required: true, maxSelect: 1, collectionId: funcionarios.id, cascadeDelete: false },
        { name: "material_id", type: "relation", required: true, maxSelect: 1, collectionId: materiais.id, cascadeDelete: false },
        { name: "tipo_operacao", type: "select", required: true, maxSelect: 1, values: ["Retirada", "Devolução"] },
        { name: "quantidade", type: "number", required: true, min: 1, onlyInt: false },
        { name: "data_operacao", type: "date", required: true },
        { name: "hora_operacao", type: "text", max: 8 },
        { name: "obra_id", type: "relation", required: false, maxSelect: 1, collectionId: obras.id, cascadeDelete: false },
        { name: "movimentacao_id", type: "relation", required: false, maxSelect: 1, collectionId: movimentacoes.id, cascadeDelete: false },
        { name: "responsavel_id", type: "relation", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { name: "observacoes", type: "text", max: 2000 },
        { name: "criado_por", type: "relation", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { name: "atualizado_por", type: "relation", required: false, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
        { name: "data_criacao", type: "autodate", onCreate: true, onUpdate: false },
        { name: "data_atualizacao", type: "autodate", onCreate: true, onUpdate: true },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_saldo_company ON saldo_funcionario (company_id)",
        "CREATE INDEX idx_saldo_func ON saldo_funcionario (funcionario_id)",
        "CREATE INDEX idx_saldo_material ON saldo_funcionario (material_id)",
        "CREATE INDEX idx_saldo_func_mat ON saldo_funcionario (funcionario_id, material_id)",
      ],
    });
    app.save(collection);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("saldo_funcionario");
    app.delete(collection);
  } catch (e) {
    if (e.message && e.message.includes("no rows in result set")) {
      console.log("saldo_funcionario not found, skipping revert");
      return;
    }
    throw e;
  }
});
