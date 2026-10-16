/// <reference path="../pb_data/types.d.ts" />
// Estende a collection `users` (auth, já existente) com os campos do
// Módulo Cadastro de Usuários — APP OBRA. Apenas adiciona campos que
// ainda não existem (idempotente via getByName). Não recria a collection,
// não altera regras de acesso existentes, não toca em created/updated
// (auto-adicionados em collections auth).

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const obras = app.findCollectionByNameOrId("obras");

    const addIfMissing = (field) => {
      if (users.fields.getByName(field.name)) return;
      users.fields.add(field);
    };

    // nome_completo
    addIfMissing(
      new TextField({
        name: "nome_completo",
        required: false,
        max: 200,
      }),
    );

    // cpf
    addIfMissing(
      new TextField({
        name: "cpf",
        required: false,
        max: 14,
      }),
    );

    // rg
    addIfMissing(
      new TextField({
        name: "rg",
        required: false,
        max: 20,
      }),
    );

    // departamento
    addIfMissing(
      new TextField({
        name: "departamento",
        required: false,
        max: 120,
      }),
    );

    // centro_custo
    addIfMissing(
      new TextField({
        name: "centro_custo",
        required: false,
        max: 120,
      }),
    );

    // obra_vinculada_id (relation to obras)
    addIfMissing(
      new RelationField({
        name: "obra_vinculada_id",
        required: false,
        maxSelect: 1,
        minSelect: 0,
        collectionId: obras.id,
        cascadeDelete: false,
      }),
    );

    // data_admissao
    addIfMissing(
      new DateField({
        name: "data_admissao",
        required: false,
      }),
    );

    // data_demissao
    addIfMissing(
      new DateField({
        name: "data_demissao",
        required: false,
      }),
    );

    // perfil_acesso (select)
    addIfMissing(
      new SelectField({
        name: "perfil_acesso",
        required: false,
        maxSelect: 1,
        values: [
          "Administrador",
          "Gerente",
          "Supervisor",
          "Engenheiro",
          "Mestre de Obras",
          "Almoxarife",
          "Comprador",
          "Financeiro",
          "RH",
          "Funcionário",
          "Cliente",
        ],
      }),
    );

    // observacoes
    addIfMissing(
      new TextField({
        name: "observacoes",
        required: false,
        max: 2000,
      }),
    );

    // ultimo_acesso
    addIfMissing(
      new DateField({
        name: "ultimo_acesso",
        required: false,
      }),
    );

    // data_criacao (autodate — distinto de `created` do sistema auth)
    addIfMissing(
      new AutodateField({
        name: "data_criacao",
        onCreate: true,
        onUpdate: false,
      }),
    );

    // data_atualizacao (autodate — distinto de `updated` do sistema auth)
    addIfMissing(
      new AutodateField({
        name: "data_atualizacao",
        onCreate: true,
        onUpdate: true,
      }),
    );

    app.save(users);

    // Index único parcial para cpf (ignora vazios) — adicionado após save
    // para garantir que a coluna exista no SQLite.
    try {
      users.addIndex(
        "idx_users_cpf_unique",
        true,
        "cpf",
        "cpf != ''",
      );
      app.save(users);
    } catch (e) {
      // ignora se o índice já existir
    }
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId("users");
      const removeIfExists = (name) => {
        try {
          users.fields.removeByName(name);
        } catch (_) {}
      };
      try {
        users.removeIndex("idx_users_cpf_unique");
      } catch (_) {}
      [
        "nome_completo",
        "cpf",
        "rg",
        "departamento",
        "centro_custo",
        "obra_vinculada_id",
        "data_admissao",
        "data_demissao",
        "perfil_acesso",
        "observacoes",
        "ultimo_acesso",
        "data_criacao",
        "data_atualizacao",
      ].forEach(removeIfExists);
      app.save(users);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log("Collection not found, skipping revert");
        return;
      }
      throw e;
    }
  },
);
