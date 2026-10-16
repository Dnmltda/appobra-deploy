/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const funcionarios = app.findCollectionByNameOrId("funcionarios");
    const epis = app.findCollectionByNameOrId("epis");
    const companies = app.findCollectionByNameOrId("companies");

    let collection;
    try {
      collection = app.findCollectionByNameOrId("epis_reposicoes");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "epis_reposicoes",
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
          { name: "numero_reposicao", type: "text", required: true, max: 60 },
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
            required: true,
            maxSelect: 1,
            collectionId: epis.id,
            cascadeDelete: false,
          },
          {
            name: "tipo_reposicao",
            type: "select",
            required: true,
            maxSelect: 1,
            values: [
              "Troca por desgaste",
              "Troca por perda",
              "Troca por vencimento",
              "Troca por dano",
              "Troca preventiva",
            ],
          },
          { name: "data_reposicao", type: "date", required: true },
          {
            name: "responsavel_id",
            type: "relation",
            required: true,
            maxSelect: 1,
            collectionId: users.id,
            cascadeDelete: false,
          },
          { name: "quantidade", type: "number", required: true, min: 1 },
          { name: "tamanho", type: "text", max: 60 },
          { name: "motivo", type: "text", max: 500 },
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
          "CREATE UNIQUE INDEX idx_epis_reposicoes_numero ON epis_reposicoes (numero_reposicao, company_id) WHERE numero_reposicao != ''",
          "CREATE INDEX idx_epis_reposicoes_company ON epis_reposicoes (company_id)",
          "CREATE INDEX idx_epis_reposicoes_func ON epis_reposicoes (funcionario_id)",
          "CREATE INDEX idx_epis_reposicoes_epi ON epis_reposicoes (epi_id)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("epis_reposicoes");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) return;
      throw e;
    }
  },
);
