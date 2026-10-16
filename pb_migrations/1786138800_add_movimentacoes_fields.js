/// <reference path="../pb_data/types.d.ts" />
// Delta migration: adiciona campos completos ao collection `movimentacoes`
// para o módulo de Movimentações de Estoque (APP OBRA).
// Mantém os campos legados (material_id, obra_id, type, quantity, etc.) intactos.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("movimentacoes");

  const users = app.findCollectionByNameOrId("users");
  const fornecedores = app.findCollectionByNameOrId("fornecedores");
  const funcionarios = app.findCollectionByNameOrId("funcionarios");

  const addIfMissing = (field) => {
    if (!collection.fields.getByName(field.name)) {
      collection.fields.add(field);
    }
  };

  // --- Identificação ---
  addIfMissing(new TextField({ name: "numero_movimentacao", max: 50 }));
  addIfMissing(new DateField({ name: "data" }));
  addIfMissing(new TextField({ name: "hora", max: 10 }));

  addIfMissing(new SelectField({
    name: "tipo",
    maxSelect: 1,
    values: [
      "Entrada",
      "Saída",
      "Transferência",
      "Devolução",
      "Perda",
      "Ajuste de Estoque",
      "Inventário",
      "Consumo de Obra",
      "Retorno ao Almoxarifado",
    ],
  }));

  // --- Material / valores ---
  addIfMissing(new TextField({ name: "categoria", max: 100 }));
  addIfMissing(new TextField({ name: "codigo", max: 100 }));
  addIfMissing(new NumberField({ name: "quantidade", min: 0 }));
  addIfMissing(new TextField({ name: "unidade", max: 30 }));
  addIfMissing(new NumberField({ name: "valor_unitario", min: 0 }));
  addIfMissing(new NumberField({ name: "valor_total", min: 0 }));

  // --- Origem/Destino ---
  addIfMissing(new TextField({ name: "centro_custo", max: 100 }));
  addIfMissing(new TextField({ name: "origem", max: 150 }));
  addIfMissing(new TextField({ name: "destino", max: 150 }));

  // --- Relações ---
  addIfMissing(new RelationField({
    name: "fornecedor_id",
    collectionId: fornecedores.id,
    maxSelect: 1,
    cascadeDelete: false,
  }));
  addIfMissing(new RelationField({
    name: "solicitante_id",
    collectionId: users.id,
    maxSelect: 1,
    cascadeDelete: false,
  }));
  addIfMissing(new RelationField({
    name: "responsavel_id",
    collectionId: users.id,
    maxSelect: 1,
    cascadeDelete: false,
  }));
  addIfMissing(new RelationField({
    name: "funcionario_id",
    collectionId: funcionarios.id,
    maxSelect: 1,
    cascadeDelete: false,
  }));

  // --- Observações / anexos ---
  addIfMissing(new TextField({ name: "observacoes", max: 2000 }));
  addIfMissing(new FileField({
    name: "anexos",
    maxSelect: 10,
    maxSize: 20971520,
    mimeTypes: [],
    thumbs: [],
    protected: false,
  }));

  // --- Status / auditoria ---
  addIfMissing(new SelectField({
    name: "status",
    maxSelect: 1,
    values: ["Pendente", "Aprovado", "Cancelado", "Finalizado"],
  }));
  addIfMissing(new TextField({ name: "motivo_cancelamento", max: 500 }));

  addIfMissing(new RelationField({
    name: "criado_por",
    collectionId: users.id,
    maxSelect: 1,
    cascadeDelete: false,
  }));
  addIfMissing(new RelationField({
    name: "atualizado_por",
    collectionId: users.id,
    maxSelect: 1,
    cascadeDelete: false,
  }));

  // --- Indexes (apenas se não existirem) ---
  const existingIndexes = collection.indexes || [];
  const hasIndex = (name) => existingIndexes.some((idx) => idx && idx.includes(name));

  if (!hasIndex("idx_mov_company_id")) {
    collection.addIndex("idx_mov_company_id", false, "company_id", "");
  }
  if (!hasIndex("idx_mov_numero")) {
    collection.addIndex(
      "idx_mov_numero",
      true,
      "company_id, numero_movimentacao",
      "numero_movimentacao != ''",
    );
  }
  if (!hasIndex("idx_mov_tipo")) {
    collection.addIndex("idx_mov_tipo", false, "tipo", "");
  }
  if (!hasIndex("idx_mov_status")) {
    collection.addIndex("idx_mov_status", false, "status", "");
  }
  if (!hasIndex("idx_mov_data")) {
    collection.addIndex("idx_mov_data", false, "data", "");
  }
  if (!hasIndex("idx_mov_material")) {
    collection.addIndex("idx_mov_material", false, "material_id", "");
  }

  app.save(collection);
}, (app) => {
  // Down: remove apenas os campos adicionados por esta migração.
  const collection = app.findCollectionByNameOrId("movimentacoes");
  const removable = [
    "numero_movimentacao", "data", "hora", "tipo", "categoria", "codigo",
    "quantidade", "unidade", "valor_unitario", "valor_total", "centro_custo",
    "origem", "destino", "fornecedor_id", "solicitante_id", "responsavel_id",
    "funcionario_id", "observacoes", "anexos", "status", "motivo_cancelamento",
    "criado_por", "atualizado_por",
  ];
  removable.forEach((name) => {
    try { collection.fields.removeByName(name); } catch (_) { /* ignore */ }
  });
  ["idx_mov_company_id", "idx_mov_numero", "idx_mov_tipo", "idx_mov_status", "idx_mov_data", "idx_mov_material"]
    .forEach((name) => {
      try { collection.removeIndex(name); } catch (_) { /* ignore */ }
    });
  app.save(collection);
});
