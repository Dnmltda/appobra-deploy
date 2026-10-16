/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("funcionarios");

  const existing = collection.fields.getByName("data_demissao");
  if (existing) {
    if (existing.type === "date") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("data_demissao"); // exists with wrong type, remove first
  }

  collection.fields.add(new DateField({
    name: "data_demissao"
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("funcionarios");
    collection.fields.removeByName("data_demissao");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})