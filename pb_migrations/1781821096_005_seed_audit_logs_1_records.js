/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("audit_logs");

  const record0 = new Record(collection);
    record0.set("usuario_id", null);
    record0.set("usuario", "system");
    record0.set("acao", "admin_user_created");
    record0.set("modulo", "authentication");
    record0.set("detalhes", "Primary admin user dnmltda created/corrected");
    record0.set("ip_address", "system");
    record0.set("user_agent", "system");
    record0.set("status", "success");
    record0.set("perfil", "system");
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
  // Rollback: record IDs not known, manual cleanup needed
})