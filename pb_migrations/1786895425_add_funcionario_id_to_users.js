/// <reference path="../pb_data/types.d.ts" />

// ETAPA 4 — Vínculo funcionário ↔ usuário.
//
// O fluxo de cadastro de funcionários com "Criar acesso ao sistema"
// (EmployeeManagement.jsx -> AuthContext.createUser) envia o campo
// `funcionario_id` ao criar o usuário em `users`, e o painel de auditoria
// registra o vínculo. Porém a collection `users` NÃO possuía o campo
// `funcionario_id` em seu schema — o PocketBase silenciosamente descarta
// campos que não existem na collection, de modo que o vínculo nunca era
// persistido. Esta migração adiciona o campo `funcionario_id` como uma
// relação (maxSelect 1, opcional, sem cascade) para `funcionarios`,
// corrigindo o vínculo users.funcionario_id = funcionarios.id.
//
// Segurança/integridade:
// - Campo opcional (required: false): não quebra usuários existentes.
// - cascadeDelete: false: excluir um funcionário NÃO exclui o usuário
//   vinculado (a conta de acesso permanece; o vínculo fica vazio).
// - Não altera regras de acesso existentes da collection `users` (as
//   regras atuais são exigidas pelo fluxo de login pré-autenticação).
// - Não altera dados reais existentes: apenas adiciona a coluna; usuários
//   já criados ficam com `funcionario_id` vazio (sem backfill, conforme
//   regra de não alterar dados reais existentes).

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const funcionarios = app.findCollectionByNameOrId("funcionarios");

    const existing = users.fields.getByName("funcionario_id");
    if (existing) {
      // Já existe — garante apenas que aponta para `funcionarios`.
      if (existing.type !== "relation") {
        users.fields.removeByName("funcionario_id");
        users.fields.add(
          new RelationField({
            name: "funcionario_id",
            required: false,
            maxSelect: 1,
            minSelect: 0,
            collectionId: funcionarios.id,
            cascadeDelete: false,
          }),
        );
        app.save(users);
      }
      return;
    }

    users.fields.add(
      new RelationField({
        name: "funcionario_id",
        required: false,
        maxSelect: 1,
        minSelect: 0,
        collectionId: funcionarios.id,
        cascadeDelete: false,
      }),
    );

    app.save(users);
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId("users");
      users.fields.removeByName("funcionario_id");
      app.save(users);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        return;
      }
      throw e;
    }
  },
);
