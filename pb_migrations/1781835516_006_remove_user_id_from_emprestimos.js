/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("emprestimos");
  collection.fields.removeByName("user_id");
  return app.save(collection);
}, (app) => {
  try {

  const pbc_9544101435Collection = app.findCollectionByNameOrId("pbc_9544101435");
  const collection = app.findCollectionByNameOrId("emprestimos");
  collection.fields.add(new RelationField({
    name: "user_id",
    required: true,
    collectionId: pbc_9544101435Collection.id,
    maxSelect: 1,
    cascadeDelete: false
  }));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})