/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("documentos");
  const field = collection.fields.getByName("tipo");
  field.values = ["CPF", "RG", "CNH", "Carteira de trabalho", "Certificados", "Outros"];
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("documentos");
  const field = collection.fields.getByName("tipo");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["CPF", "RG", "Carteira de trabalho", "Certificados", "Outros"];
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})