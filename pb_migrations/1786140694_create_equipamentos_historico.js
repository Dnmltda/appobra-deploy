/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const equipamentos = app.findCollectionByNameOrId("equipamentos");
    const companies = app.findCollectionByNameOrId("companies");

    let collection;
    try {
      collection = app.findCollectionByNameOrId("equipamentos_historico");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "equipamentos_historico",
        listRule: "@request.auth.company_id = company_id",
        viewRule: "@request.auth.company_id = company_id",
        createRule: "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"",
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
            name: "equipamento_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: equipamentos.id,
            cascadeDelete: true,
          },
          { name: "data", type: "date", required: true },
          { name: "hora", type: "text", required: true, max: 8 },
          {
            name: "usuario_id",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          { name: "alteracao_realizada", type: "text", required: true, max: 200 },
          { name: "local_anterior", type: "text", max: 200 },
          { name: "local_atual", type: "text", max: 200 },
          {
            name: "responsavel_anterior_id",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          {
            name: "novo_responsavel_id",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          {
            name: "obra_anterior_id",
            type: "relation",
            maxSelect: 1,
            collectionId: app.findCollectionByNameOrId("obras").id,
            cascadeDelete: false,
          },
          {
            name: "nova_obra_id",
            type: "relation",
            maxSelect: 1,
            collectionId: app.findCollectionByNameOrId("obras").id,
            cascadeDelete: false,
          },
          { name: "status_anterior", type: "text", max: 50 },
          { name: "novo_status", type: "text", max: 50 },
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
          "CREATE INDEX idx_equip_hist_company ON equipamentos_historico (company_id)",
          "CREATE INDEX idx_equip_hist_equip ON equipamentos_historico (equipamento_id)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("equipamentos_historico");
      app.delete(collection);
    } catch (e) {
      if (!e.message.includes("no rows in result set")) throw e;
    }
  },
);
