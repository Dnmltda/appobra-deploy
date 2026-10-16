/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  const record = new Record(collection);
  record.set("email", "dnmltda@hotmail.com");
  record.setPassword("Admin@123456");
  record.set("id_unico", "06061993");
  record.set("username", "dnmltda");
  record.set("cargo", "Administrador");
  record.set("status", "Ativo");
  record.set("role", "Administrador");
  record.set("is_blocked", false);
  record.set("is_active", true);
  record.set("login_attempts", 0);
  record.set("verified", true);
  const record_company_idLookup = app.findFirstRecordByFilter("companies", "name='Default Company'");
  if (!record_company_idLookup) { throw new Error("Lookup failed for company_id: no record in 'companies' matching \"name='Default Company'\""); }
  record.set("company_id", record_company_idLookup.id);
  try {
    return app.save(record);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
      return;
    }
    throw e;
  }
}, (app) => {
  try {
    const record = app.findFirstRecordByData("users", "email", "dnmltda@hotmail.com");
    app.delete(record);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Auth record not found, skipping rollback");
      return;
    }
    throw e;
  }
})