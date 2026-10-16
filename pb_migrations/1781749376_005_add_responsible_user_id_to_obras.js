/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const _pb_users_auth_Collection = app.findCollectionByNameOrId("_pb_users_auth_");
  const collection = app.findCollectionByNameOrId("obras");

  const existing = collection.fields.getByName("responsible_user_id");
  if (existing) {
    if (existing.type === "relation") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("responsible_user_id"); // exists with wrong type, remove first
  }

  collection.fields.add(new RelationField({
    name: "responsible_user_id",
    collectionId: _pb_users_auth_Collection.id
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("obras");
    collection.fields.removeByName("responsible_user_id");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})