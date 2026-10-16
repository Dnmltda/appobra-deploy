/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const companies = app.findCollectionByNameOrId("pbc_1286596701"); // companies
    const users = app.findCollectionByNameOrId("_pb_users_auth_"); // users
    const clientes = app.findCollectionByNameOrId("clientes");
    const materiais = app.findCollectionByNameOrId("materiais");

    const collection = new Collection({
      type: "base",
      name: "propostas",
      // Multitenancy: isolamento por company_id do usuário autenticado.
      listRule: "@request.auth.company_id = company_id",
      viewRule: "@request.auth.company_id = company_id",
      createRule:
        "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"",
      updateRule:
        "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"",
      deleteRule:
        "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"",
      fields: [
        {
          name: "company_id",
          type: "relation",
          required: true,
          maxSelect: 1,
          minSelect: 0,
          collectionId: companies.id,
          cascadeDelete: false,
        },
        { name: "numero_proposta", type: "text", required: true, max: 50 },
        {
          name: "cliente_id",
          type: "relation",
          required: true,
          maxSelect: 1,
          minSelect: 0,
          collectionId: clientes.id,
          cascadeDelete: false,
        },
        { name: "data_proposta", type: "date", required: true },
        { name: "data_validade", type: "date", required: true },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["Rascunho", "Enviada", "Aceita", "Rejeitada", "Expirada"],
        },
        { name: "descricao", type: "text", max: 500 },
        { name: "valor_total", type: "number", required: true, min: 0 },
        { name: "desconto", type: "number", min: 0 },
        { name: "desconto_percentual", type: "number", min: 0 },
        { name: "valor_final", type: "number", required: true, min: 0 },
        { name: "condicoes_pagamento", type: "text", max: 500 },
        { name: "observacoes", type: "text", max: 2000 },
        {
          name: "itens",
          type: "json",
          maxSize: 5000000,
        },
        {
          name: "criado_por",
          type: "relation",
          maxSelect: 1,
          minSelect: 0,
          collectionId: users.id,
          cascadeDelete: false,
        },
        {
          name: "atualizado_por",
          type: "relation",
          maxSelect: 1,
          minSelect: 0,
          collectionId: users.id,
          cascadeDelete: false,
        },
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_propostas_company_id ON propostas (company_id)",
        "CREATE UNIQUE INDEX idx_propostas_company_numero ON propostas (company_id, numero_proposta)",
        "CREATE INDEX idx_propostas_status ON propostas (status)",
        "CREATE INDEX idx_propostas_data_proposta ON propostas (data_proposta)",
        "CREATE INDEX idx_propostas_cliente_id ON propostas (cliente_id)",
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("propostas");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        return;
      }
      throw e;
    }
  },
);
