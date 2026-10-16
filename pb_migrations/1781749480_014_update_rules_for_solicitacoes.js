/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("solicitacoes");
  collection.listRule = "@request.auth.company_id = company_id";
  collection.viewRule = "@request.auth.company_id = company_id";
  collection.createRule = "@request.auth.company_id = company_id";
  collection.updateRule = "@request.auth.company_id = company_id && (@request.auth.role = \"admin\" || @request.auth.role = \"almoxarife\" || @request.auth.role = \"engenheiro\" || @request.auth.role = \"mestre_obras\")";
  collection.deleteRule = "@request.auth.role = \"admin\"";
  return app.save(collection);
}, (app) => {
  try {
  const collection = app.findCollectionByNameOrId("solicitacoes");
  collection.listRule = "tenant_id = @request.auth.tenant_id";
  collection.viewRule = "tenant_id = @request.auth.tenant_id";
  collection.createRule = "@request.auth.role != \"viewer\"";
  collection.updateRule = "@request.auth.role != \"viewer\" || requester_id = @request.auth.id";
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