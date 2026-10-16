/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("manutencoes");
  collection.indexes.push("CREATE UNIQUE INDEX idx_manutencoes_id_unico ON manutencoes (id_unico)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("manutencoes");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_manutencoes_id_unico"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})