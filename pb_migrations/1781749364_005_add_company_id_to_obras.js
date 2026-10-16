/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const companiesCollection = app.findCollectionByNameOrId("companies");
  const collection = app.findCollectionByNameOrId("obras");

  const existing = collection.fields.getByName("company_id");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("company_id"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "company_id",
    required: true,
    collectionId: companiesCollection.id
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("obras");
    collection.fields.removeByName("company_id");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})