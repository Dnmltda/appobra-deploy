/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("qr_codes");
  collection.fields.removeByName("tenant_id");
  return app.save(collection);
}, (app) => {
  try {

  const pbc_4536498964Collection = app.findCollectionByNameOrId("pbc_4536498964");
  const collection = app.findCollectionByNameOrId("qr_codes");
  collection.fields.add(new RelationField({
    name: "tenant_id",
    required: true,
    collectionId: pbc_4536498964Collection.id,
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