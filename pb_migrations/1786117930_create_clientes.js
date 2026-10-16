/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const companies = app.findCollectionByNameOrId("pbc_1286596701"); // companies
    const users = app.findCollectionByNameOrId("_pb_users_auth_"); // users

    const collection = new Collection({
      type: "base",
      name: "clientes",
      // Multitenancy: isolamento por company_id do usuário autenticado.
      listRule:
        "@request.auth.company_id = company_id",
      viewRule:
        "@request.auth.company_id = company_id",
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
        { name: "nome", type: "text", required: true, max: 200 },
        { name: "email", type: "email", required: true },
        { name: "telefone", type: "text", max: 30 },
        { name: "cpf_cnpj", type: "text", max: 20 },
        { name: "endereco", type: "text", max: 255 },
        { name: "cidade", type: "text", max: 100 },
        { name: "estado", type: "text", max: 2 },
        { name: "cep", type: "text", max: 15 },
        {
          name: "tipo",
          type: "select",
          maxSelect: 1,
          values: ["Pessoa Física", "Pessoa Jurídica"],
        },
        {
          name: "status",
          type: "select",
          maxSelect: 1,
          values: ["Ativo", "Inativo"],
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
        "CREATE INDEX idx_clientes_company_id ON clientes (company_id)",
        "CREATE INDEX idx_clientes_email ON clientes (email)",
        "CREATE INDEX idx_clientes_cpf_cnpj ON clientes (cpf_cnpj)",
        "CREATE INDEX idx_clientes_status ON clientes (status)",
      ],
    });

    app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("clientes");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        return;
      }
      throw e;
    }
  },
);
