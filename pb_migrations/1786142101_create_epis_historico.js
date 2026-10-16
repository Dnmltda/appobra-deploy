/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const funcionarios = app.findCollectionByNameOrId("funcionarios");
    const epis = app.findCollectionByNameOrId("epis");
    const companies = app.findCollectionByNameOrId("companies");

    let collection;
    try {
      collection = app.findCollectionByNameOrId("epis_historico");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "epis_historico",
        listRule: "@request.auth.company_id = company_id",
        viewRule: "@request.auth.company_id = company_id",
        createRule:
          "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: "company_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: companies.id,
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
          {
            name: "epi_id",
            type: "relation",
            maxSelect: 1,
            collectionId: epis.id,
            cascadeDelete: false,
          },
          {
            name: "tipo_operacao",
            type: "select",
            required: true,
            maxSelect: 1,
            values: ["Entrega", "Devolução", "Reposição", "Alteração", "Exclusão"],
          },
          { name: "data_operacao", type: "date", required: true },
          { name: "hora_operacao", type: "text", required: true, max: 8 },
          {
            name: "usuario_id",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          { name: "descricao", type: "text", required: true, max: 500 },
          { name: "detalhes", type: "text", max: 2000 },
          {
            name: "criado_por",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          { name: "data_criacao", type: "autodate", onCreate: true, onUpdate: false },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE INDEX idx_epis_historico_company ON epis_historico (company_id)",
          "CREATE INDEX idx_epis_historico_func ON epis_historico (funcionario_id)",
          "CREATE INDEX idx_epis_historico_epi ON epis_historico (epi_id)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("epis_historico");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
