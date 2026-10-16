/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const equipamentos = app.findCollectionByNameOrId("equipamentos");
    const fornecedores = app.findCollectionByNameOrId("fornecedores");
    const companies = app.findCollectionByNameOrId("companies");

    let collection;
    try {
      collection = app.findCollectionByNameOrId("equipamentos_manutencao");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "equipamentos_manutencao",
        listRule: "@request.auth.company_id = company_id",
        viewRule: "@request.auth.company_id = company_id",
        createRule: "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"",
        updateRule: "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"",
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
          {
            name: "equipamento_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: equipamentos.id,
            cascadeDelete: true,
          },
          {
            name: "tipo",
            type: "select",
            required: true,
            maxSelect: 1,
            values: ["Preventiva", "Corretiva", "Emergencial", "Calibração", "Inspeção", "Troca de peças"],
          },
          { name: "custos", type: "number", min: 0 },
          {
            name: "fornecedor_id",
            type: "relation",
            maxSelect: 1,
            collectionId: fornecedores.id,
            cascadeDelete: false,
          },
          { name: "data_prevista", type: "date" },
          { name: "data_realizada", type: "date" },
          { name: "proxima_manutencao", type: "date" },
          { name: "descricao", type: "text", max: 2000 },
          {
            name: "responsavel_id",
            type: "relation",
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          {
            name: "status",
            type: "select",
            maxSelect: 1,
            values: ["Agendada", "Em Execução", "Concluída", "Cancelada"],
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
          "CREATE INDEX idx_equip_manut_company ON equipamentos_manutencao (company_id)",
          "CREATE INDEX idx_equip_manut_equip ON equipamentos_manutencao (equipamento_id)",
          "CREATE INDEX idx_equip_manut_status ON equipamentos_manutencao (status)",
          "CREATE INDEX idx_equip_manut_proxima ON equipamentos_manutencao (proxima_manutencao)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("equipamentos_manutencao");
      app.delete(collection);
    } catch (e) {
      if (!e.message.includes("no rows in result set")) throw e;
    }
  },
);
