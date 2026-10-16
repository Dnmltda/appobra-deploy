/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const funcionarios = app.findCollectionByNameOrId("funcionarios");
    const entregas = app.findCollectionByNameOrId("epis_entregas");
    const companies = app.findCollectionByNameOrId("companies");

    let collection;
    try {
      collection = app.findCollectionByNameOrId("epis_devolucoes");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "epis_devolucoes",
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
          { name: "numero_devolucao", type: "text", required: true, max: 60 },
          {
            name: "entrega_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: entregas.id,
            cascadeDelete: false,
          },
          {
            name: "funcionario_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: funcionarios.id,
            cascadeDelete: false,
          },
          { name: "data_devolucao", type: "date", required: true },
          { name: "hora_devolucao", type: "text", required: true, max: 8 },
          {
            name: "responsavel_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          { name: "motivo", type: "text", required: true, max: 500 },
          {
            name: "estado_epi",
            type: "select",
            required: true,
            maxSelect: 1,
            values: ["Bom", "Desgastado", "Danificado", "Sujo", "Outro"],
          },
          { name: "aprovado_reutilizacao", type: "bool" },
          { name: "descartado", type: "bool" },
          { name: "necessita_manutencao", type: "bool" },
          { name: "necessita_higienizacao", type: "bool" },
          { name: "observacoes", type: "text", max: 2000 },
          {
            name: "foto_devolucao",
            type: "file",
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ["image/jpeg", "image/png", "image/webp"],
          },
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
          "CREATE UNIQUE INDEX idx_epis_devolucoes_numero ON epis_devolucoes (numero_devolucao, company_id) WHERE numero_devolucao != ''",
          "CREATE INDEX idx_epis_devolucoes_company ON epis_devolucoes (company_id)",
          "CREATE INDEX idx_epis_devolucoes_entrega ON epis_devolucoes (entrega_id)",
          "CREATE INDEX idx_epis_devolucoes_func ON epis_devolucoes (funcionario_id)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("epis_devolucoes");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
