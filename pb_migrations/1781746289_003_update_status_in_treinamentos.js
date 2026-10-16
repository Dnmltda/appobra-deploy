/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("treinamentos");
  const field = collection.fields.getByName("status");
  field.values = ["V\u00e1lido", "Vencido", "Pr\u00f3ximo de vencer"];
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("treinamentos");
  const field = collection.fields.getByName("status");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["V\u00e1lido", "Vencido", "Expirando em 30 dias"];
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})