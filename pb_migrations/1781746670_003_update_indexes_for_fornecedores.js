/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("fornecedores");
  collection.indexes.push("CREATE UNIQUE INDEX idx_fornecedores_id_unico ON fornecedores (id_unico)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("fornecedores");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_fornecedores_id_unico"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})