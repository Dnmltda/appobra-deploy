/// <reference path="../pb_data/types.d.ts" />

// Amplia os valores do select `status` da collection `epis` para incluir
// "Ativo" e "Inativo" (mantendo os valores históricos).

migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId("epis");
    const field = collection.fields.getByName("status");
    const existing = field.values || [];
    const desired = [
      "Ativo",
      "Inativo",
      "Disponível",
      "Em uso",
      "Vencido",
      "Descartado",
    ];
    // preserva quaisquer valores adicionais já presentes
    existing.forEach((v) => {
      if (!desired.includes(v)) desired.push(v);
    });
    field.values = desired;
    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("epis");
    const field = collection.fields.getByName("status");
    field.values = ["Disponível", "Em uso", "Vencido", "Descartado"];
    app.save(collection);
  },
);
