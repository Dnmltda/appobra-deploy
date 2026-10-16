/// <reference path="../pb_data/types.d.ts" />

// Módulo Cadastro de Empresas — APP OBRA
// Cria a collection `empresas` (registro administrativo de empresas) com
// isolamento por autenticação, escrita restrita a Administradores/Gerência e
// leitura para qualquer usuário autenticado. Não altera collections existentes.

migrate(
  (app) => {
    let collection;
    try {
      collection = app.findCollectionByNameOrId("empresas");
    } catch (_) {
      collection = new Collection({
        type: "base",
        name: "empresas",
        // Leitura para qualquer usuário autenticado (admin/gerente/funcionário).
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        // Criação/exclusão restritas a Administradores.
        createRule:
          '@request.auth.cargo = "Administrador" || @request.auth.role = "admin" || @request.auth.role = "Administrador"',
        // Atualização permitida para Administradores e Gerência (campos limitados pela UI).
        updateRule:
          '@request.auth.cargo = "Administrador" || @request.auth.role = "admin" || @request.auth.role = "Administrador" || @request.auth.cargo = "Gerência" || @request.auth.role = "Gerência"',
        deleteRule:
          '@request.auth.cargo = "Administrador" || @request.auth.role = "admin" || @request.auth.role = "Administrador"',
        fields: [
          { name: "razao_social", type: "text", required: true, max: 200 },
          { name: "nome_fantasia", type: "text", required: true, max: 200 },
          { name: "cnpj", type: "text", required: true, max: 20 },
          { name: "inscricao_estadual", type: "text", max: 30 },
          { name: "inscricao_municipal", type: "text", max: 30 },
          { name: "cep", type: "text", required: true, max: 10 },
          { name: "endereco", type: "text", required: true, max: 200 },
          { name: "numero", type: "text", required: true, max: 20 },
          { name: "complemento", type: "text", max: 100 },
          { name: "bairro", type: "text", required: true, max: 100 },
          { name: "cidade", type: "text", required: true, max: 100 },
          { name: "estado", type: "text", required: true, max: 2, min: 2 },
          { name: "pais", type: "text", max: 60 },
          { name: "telefone", type: "text", required: true, max: 20 },
          { name: "whatsapp", type: "text", max: 20 },
          { name: "email", type: "email", required: true },
          { name: "website", type: "url", max: 200 },
          { name: "responsavel_legal", type: "text", required: true, max: 150 },
          { name: "cpf_responsavel", type: "text", required: true, max: 20 },
          {
            name: "logo",
            type: "file",
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
            thumbs: ["100x100", "300x300"],
          },
          {
            name: "plano",
            type: "select",
            maxSelect: 1,
            values: ["Básico", "Profissional", "Empresarial", "Enterprise"],
          },
          {
            name: "status",
            type: "select",
            maxSelect: 1,
            values: ["Ativo", "Inativo"],
          },
          { name: "observacoes", type: "text", max: 2000 },
          {
            name: "criado_por",
            type: "relation",
            maxSelect: 1,
            collectionId: "_pb_users_auth_",
            cascadeDelete: false,
          },
          {
            name: "atualizado_por",
            type: "relation",
            maxSelect: 1,
            collectionId: "_pb_users_auth_",
            cascadeDelete: false,
          },
          { name: "data_criacao", type: "autodate", onCreate: true, onUpdate: false },
          { name: "data_atualizacao", type: "autodate", onCreate: true, onUpdate: true },
          { name: "created", type: "autodate", onCreate: true, onUpdate: false },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_empresas_cnpj ON empresas (cnpj) WHERE cnpj != ''",
          "CREATE UNIQUE INDEX idx_empresas_razao ON empresas (razao_social) WHERE razao_social != ''",
          "CREATE INDEX idx_empresas_status ON empresas (status)",
          "CREATE INDEX idx_empresas_estado ON empresas (estado)",
        ],
      });
      app.save(collection);
    }
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("empresas");
      app.delete(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        console.log("Collection empresas not found, skipping revert");
        return;
      }
      throw e;
    }
  },
);
