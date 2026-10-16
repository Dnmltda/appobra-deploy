/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("solicitacoes_compra");

  const existing = collection.fields.getByName("id_unico");
  if (existing) {
    if (existing.type === "text") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("id_unico"); // exists with wrong type, remove first
  }

  collection.fields.add(new TextField({
    name: "id_unico",
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("solicitacoes_compra");
    collection.fields.removeByName("id_unico");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})