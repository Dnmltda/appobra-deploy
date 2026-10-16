/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("emprestimos");
  collection.listRule = "@request.auth.company_id = company_id";
  collection.viewRule = "@request.auth.company_id = company_id";
  collection.createRule = "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"";
  collection.updateRule = "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"";
  collection.deleteRule = "@request.auth.role = \"admin\"";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("emprestimos");
  collection.listRule = "tenant_id = @request.auth.tenant_id";
  collection.viewRule = "tenant_id = @request.auth.tenant_id";
  collection.createRule = "@request.auth.role != \"viewer\"";
  collection.updateRule = "@request.auth.role != \"viewer\"";
  collection.deleteRule = "@request.auth.role = \"admin\"";
  return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})