/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const obrasCollection = app.findCollectionByNameOrId("obras");
  const collection = app.findCollectionByNameOrId("equipamentos");

  const existing = collection.fields.getByName("obra_id");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("obra_id"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "obra_id",
    collectionId: obrasCollection.id
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("equipamentos");
    collection.fields.removeByName("obra_id");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})