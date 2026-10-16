/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("app_users");
  collection.indexes.push("CREATE UNIQUE INDEX idx_app_users_tenant_email ON app_users (tenant_id, email)");
  collection.indexes.push("CREATE UNIQUE INDEX idx_app_users_tenant_username ON app_users (tenant_id, username)");
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("app_users");
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_app_users_tenant_email"));
  collection.indexes = collection.indexes.filter(idx => !idx.includes("idx_app_users_tenant_username"));
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})