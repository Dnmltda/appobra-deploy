/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const funcionarios = app.findCollectionByNameOrId("funcionarios");
    const obras = app.findCollectionByNameOrId("obras");
    const epis = app.findCollectionByNameOrId("epis");
    const companies = app.findCollectionByNameOrId("companies");

    let collection;
    try {
      collection = app.findCollectionByNameOrId("epis_entregas");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "epis_entregas",
        listRule: "@request.auth.company_id = company_id",
        viewRule: "@request.auth.company_id = company_id",
        createRule:
          "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"",
        updateRule:
          "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"",
        deleteRule: "@request.auth.role = \"admin\"",
        fields: [
          {
            name: "company_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: companies.id,
            cascadeDelete: false,
          },
          { name: "numero_entrega", type: "text", required: true, max: 60 },
          {
            name: "funcionario_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: funcionarios.id,
            cascadeDelete: false,
          },
          {
            name: "obra_id",
            type: "relation",
            maxSelect: 1,
            collectionId: obras.id,
            cascadeDelete: false,
          },
          { name: "setor", type: "text", max: 120 },
          { name: "cargo", type: "text", max: 120 },
          { name: "centro_custo", type: "text", max: 120 },
          { name: "data_entrega", type: "date", required: true },
          { name: "hora_entrega", type: "text", required: true, max: 8 },
          {
            name: "responsavel_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          {
            name: "epi_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: epis.id,
            cascadeDelete: false,
          },
          { name: "quantidade", type: "number", required: true, min: 1 },
          { name: "tamanho", type: "text", max: 60 },
          { name: "ca_utilizado", type: "text", max: 60 },
          { name: "lote", type: "text", max: 60 },
          { name: "validade", type: "date" },
          { name: "prazo_troca", type: "date" },
          { name: "data_prevista_devolucao", type: "date" },
          {
            name: "situacao",
            type: "select",
            maxSelect: 1,
            values: ["Entregue", "Pendente", "Devolvido", "Extraviado", "Danificado"],
          },
          { name: "assinatura_digital", type: "text", max: 5000 },
          {
            name: "foto_entrega",
            type: "file",
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ["image/jpeg", "image/png", "image/webp"],
          },
          { name: "observacoes", type: "text", max: 2000 },
          {
            name: "criado_por",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          {
            name: "atualizado_por",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          { name: "data_criacao", type: "autodate", onCreate: true, onUpdate: false },
          { name: "data_atualizacao", type: "autodate", onCreate: true, onUpdate: true },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_epis_entregas_numero ON epis_entregas (numero_entrega, company_id) WHERE numero_entrega != ''",
          "CREATE INDEX idx_epis_entregas_company ON epis_entregas (company_id)",
          "CREATE INDEX idx_epis_entregas_func ON epis_entregas (funcionario_id)",
          "CREATE INDEX idx_epis_entregas_epi ON epis_entregas (epi_id)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("epis_entregas");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
