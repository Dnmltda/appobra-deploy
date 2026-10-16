/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("funcionarios");
  collection.indexes.push("CREATE UNIQUE INDEX idx_funcionarios_id_unico ON funcionarios (id_unico)");
  collection.indexes.push("CREATE UNIQUE INDEX idx_funcionarios_cpf ON funcionarios (cpf)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("funcionarios");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_funcionarios_id_unico"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_funcionarios_cpf"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})