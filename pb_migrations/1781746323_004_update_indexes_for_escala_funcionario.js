/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("escala_funcionario");
  // No index operations
  return app.save(collection);
}, (app) => {
  try {
  // Note: removed_index_definitions not provided — cannot restore removed indexes
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})