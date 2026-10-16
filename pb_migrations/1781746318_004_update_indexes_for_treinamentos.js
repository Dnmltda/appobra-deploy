/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("treinamentos");
  collection.indexes.push("CREATE UNIQUE INDEX idx_treinamentos_id_unico ON treinamentos (id_unico)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("treinamentos");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_treinamentos_id_unico"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})