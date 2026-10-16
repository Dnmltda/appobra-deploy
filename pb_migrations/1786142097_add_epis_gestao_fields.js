/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const fornecedores = app.findCollectionByNameOrId("fornecedores");

    const collection = app.findCollectionByNameOrId("epis");

    const hasField = (name) => {
      try {
        collection.fields.getByName(name);
        return true;
      } catch (_) {
        return false;
      }
    };

    const addIfMissing = (field) => {
      if (!hasField(field.name)) collection.fields.add(field);
    };

    // Identificação
    addIfMissing(new TextField({ name: "codigo", required: true, max: 100 }));
    addIfMissing(new TextField({ name: "nome", required: true, max: 200 }));
    addIfMissing(
      new SelectField({
        name: "categoria",
        required: true,
        maxSelect: 1,
        values: [
          "Capacete",
          "Botina",
          "Óculos",
          "Luva",
          "Máscara",
          "Respirador",
          "Protetor Auricular",
          "Cinto de Segurança",
          "Talabarte",
          "Uniforme",
          "Colete",
          "Avental",
          "Perneira",
          "Mangote",
          "Protetor Facial",
          "Outros",
        ],
      }),
    );
    addIfMissing(new TextField({ name: "marca", max: 120 }));
    addIfMissing(new TextField({ name: "modelo", max: 120 }));
    addIfMissing(new TextField({ name: "fabricante", max: 120 }));
    addIfMissing(
      new RelationField({
        name: "fornecedor_id",
        collectionId: fornecedores.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );

    // CA e norma
    addIfMissing(new TextField({ name: "numero_ca", max: 60 }));
    addIfMissing(new DateField({ name: "validade_ca" }));
    addIfMissing(new TextField({ name: "norma_regulamentadora", max: 120 }));

    // Características físicas
    addIfMissing(new TextField({ name: "tamanho", max: 60 }));
    addIfMissing(new TextField({ name: "cor", max: 60 }));
    addIfMissing(new TextField({ name: "material", max: 120 }));

    // Estoque
    addIfMissing(new NumberField({ name: "quantidade_estoque", required: true, min: 0 }));
    addIfMissing(new NumberField({ name: "estoque_minimo", min: 0 }));
    addIfMissing(new TextField({ name: "unidade", max: 20 }));

    // Valores
    addIfMissing(new NumberField({ name: "valor_unitario", min: 0 }));
    addIfMissing(new NumberField({ name: "valor_medio", min: 0 }));

    // Localização
    addIfMissing(new TextField({ name: "local_armazenamento", max: 200 }));

    // Anexos
    addIfMissing(
      new FileField({
        name: "foto",
        maxSelect: 1,
        maxSize: 10485760,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      }),
    );
    addIfMissing(
      new FileField({
        name: "manual",
        maxSelect: 1,
        maxSize: 20971520,
        mimeTypes: ["application/pdf"],
      }),
    );
    addIfMissing(
      new FileField({
        name: "ficha_tecnica",
        maxSelect: 1,
        maxSize: 20971520,
        mimeTypes: ["application/pdf"],
      }),
    );

    // Observações e auditoria
    addIfMissing(new TextField({ name: "observacoes", max: 2000 }));
    addIfMissing(
      new RelationField({
        name: "criado_por",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addIfMissing(
      new RelationField({
        name: "atualizado_por",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addIfMissing(new DateField({ name: "data_criacao" }));
    addIfMissing(new DateField({ name: "data_atualizacao" }));

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("epis");
    const removeIfExists = (name) => {
      try {
        collection.fields.removeByName(name);
      } catch (_) {}
    };
    [
      "codigo",
      "nome",
      "categoria",
      "marca",
      "modelo",
      "fabricante",
      "fornecedor_id",
      "numero_ca",
      "validade_ca",
      "norma_regulamentadora",
      "tamanho",
      "cor",
      "material",
      "quantidade_estoque",
      "estoque_minimo",
      "unidade",
      "valor_unitario",
      "valor_medio",
      "local_armazenamento",
      "foto",
      "manual",
      "ficha_tecnica",
      "observacoes",
      "criado_por",
      "atualizado_por",
      "data_criacao",
      "data_atualizacao",
    ].forEach(removeIfExists);
    app.save(collection);
  },
);
