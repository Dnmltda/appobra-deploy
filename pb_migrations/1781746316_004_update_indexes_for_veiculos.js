/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("veiculos");
  collection.indexes.push("CREATE UNIQUE INDEX idx_veiculos_id_unico ON veiculos (id_unico)");
  collection.indexes.push("CREATE UNIQUE INDEX idx_veiculos_placa ON veiculos (placa)");
  collection.indexes.push("CREATE UNIQUE INDEX idx_veiculos_chassi ON veiculos (chassi)");
  collection.indexes.push("CREATE UNIQUE INDEX idx_veiculos_renavam ON veiculos (renavam)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("veiculos");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_veiculos_id_unico"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_veiculos_placa"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_veiculos_chassi"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_veiculos_renavam"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})