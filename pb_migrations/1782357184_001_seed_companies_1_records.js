/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("companies");

  const record0 = new Record(collection);
    record0.id = "4invf1ipo09r83h";
    record0.set("name", "Empresa Principal");
    record0.set("is_active", true);
    record0.set("subscription_tier", "professional");
  try {
    app.save(record0);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }
}, (app) => {
  const seededRecordIds = ["4invf1ipo09r83h"];
  for (const seededRecordId of seededRecordIds) {
    try {
      app.delete(app.findRecordById("companies", seededRecordId));
    } catch (error) {
      if (error.message.includes("no rows in result set")) {
        continue;
      }
      throw error;
    }
  }
})