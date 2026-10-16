/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("licenciamentos");
  const field = collection.fields.getByName("tipo");
  field.values = ["IPVA", "Seguro", "Revis\u00e3o", "Inspe\u00e7\u00e3o", "Licenciamento"];
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("licenciamentos");
  const field = collection.fields.getByName("tipo");
  if (!field) { console.log("Field not found, skipping revert"); return; }
  field.values = ["IPVA", "Seguro", "Revis\u00e3o"];
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection or field not found, skipping revert");
      return;
    }
    throw e;
  }
})