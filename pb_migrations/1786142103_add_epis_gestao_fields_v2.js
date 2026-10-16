/// <reference path="../pb_data/types.d.ts" />

// Re-adiciona os campos de gestão à collection `epis`.
// A migração anterior (1786142097) foi marcada como aplicada mas os campos
// não foram persistidos (guard getByName retornou truthy). Esta migração
// adiciona os campos diretamente, ignorando os que já existirem.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const fornecedores = app.findCollectionByNameOrId("fornecedores");
    const collection = app.findCollectionByNameOrId("epis");

    const add = (field) => {
      try {
        collection.fields.getByName(field.name);
      } catch (_) {
        collection.fields.add(field);
      }
    };

    add(new TextField({ name: "codigo", required: true, max: 100 }));
    add(new TextField({ name: "nome", required: true, max: 200 }));
    add(
      new SelectField({
        name: "categoria",
        required: true,
        maxSelect: 1,
        values: [
          "Capacete", "Botina", "Óculos", "Luva", "Máscara", "Respirador",
          "Protetor Auricular", "Cinto de Segurança", "Talabarte", "Uniforme",
          "Colete", "Avental", "Perneira", "Mangote", "Protetor Facial", "Outros",
        ],
      }),
    );
    add(new TextField({ name: "marca", max: 120 }));
    add(new TextField({ name: "modelo", max: 120 }));
    add(new TextField({ name: "fabricante", max: 120 }));
    add(new RelationField({ name: "fornecedor_id", collectionId: fornecedores.id, maxSelect: 1, cascadeDelete: false }));
    add(new TextField({ name: "numero_ca", max: 60 }));
    add(new DateField({ name: "validade_ca" }));
    add(new TextField({ name: "norma_regulamentadora", max: 120 }));
    add(new TextField({ name: "tamanho", max: 60 }));
    add(new TextField({ name: "cor", max: 60 }));
    add(new TextField({ name: "material", max: 120 }));
    add(new NumberField({ name: "quantidade_estoque", required: true, min: 0 }));
    add(new NumberField({ name: "estoque_minimo", min: 0 }));
    add(new TextField({ name: "unidade", max: 20 }));
    add(new NumberField({ name: "valor_unitario", min: 0 }));
    add(new NumberField({ name: "valor_medio", min: 0 }));
    add(new TextField({ name: "local_armazenamento", max: 200 }));
    add(new FileField({ name: "foto", maxSelect: 1, maxSize: 10485760, mimeTypes: ["image/jpeg", "image/png", "image/webp"] }));
    add(new FileField({ name: "manual", maxSelect: 1, maxSize: 20971520, mimeTypes: ["application/pdf"] }));
    add(new FileField({ name: "ficha_tecnica", maxSelect: 1, maxSize: 20971520, mimeTypes: ["application/pdf"] }));
    add(new TextField({ name: "observacoes", max: 2000 }));
    add(new RelationField({ name: "criado_por", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
    add(new RelationField({ name: "atualizado_por", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
    add(new DateField({ name: "data_criacao" }));
    add(new DateField({ name: "data_atualizacao" }));

    app.save(collection);
  },
  (app) => {
    // noop (reversão tratada na migração original)
  },
);
