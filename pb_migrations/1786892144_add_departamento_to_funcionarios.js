/// <reference path="../pb_data/types.d.ts" />

// Adiciona o campo "departamento" à collection "funcionarios".
// Necessário para o fluxo de cadastro de funcionários (Etapa 1), onde o
// usuário lista "Departamento" como um dos campos do formulário. O campo
// é opcional (texto livre) — não quebra registros existentes.

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("funcionarios");

    const existing = collection.fields.getByName("departamento");
    if (existing) {
      if (existing.type === "text") {
        return; // já existe com o tipo correto
      }
      collection.fields.removeByName("departamento");
    }

    collection.fields.add(
      new TextField({
        name: "departamento",
        max: 120,
      }),
    );

    return app.save(collection);
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId("funcionarios");
      collection.fields.removeByName("departamento");
      return app.save(collection);
    } catch (e) {
      if (e.message.includes("no rows in result set")) {
        return;
      }
      throw e;
    }
  },
);
