/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");
  const record = new Record(collection);
  record.id = "cphicrrmwux4gyd";
  record.set("email", "admin@empresa.com");
  record.setPassword("Adm!nSecure2024#Pro");
  record.set("username", "admin");
  record.set("id_unico", "admin_001");
  record.set("role", "admin");
  record.set("status", "Ativo");
  record.set("is_active", true);
  record.set("login_attempts", 0);
  record.set("cargo", "Administrador");
  const record_company_idLookup = app.findFirstRecordByFilter("companies", "name='Empresa Principal'");
  if (!record_company_idLookup) { throw new Error("Lookup failed for company_id: no record in 'companies' matching \"name='Empresa Principal'\""); }
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
    const record = app.findRecordById("users", "cphicrrmwux4gyd");
    return app.delete(record);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Auth record not found, skipping rollback");
      return;
    }
    throw e;
  }
})