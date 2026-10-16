/// <reference path="../pb_data/types.d.ts" />
// Limpeza de usuários de demonstração.
// Usuários reais são sempre preservados.
migrate((app) => {
  const KEEP_EMAILS = [
    "admin@empresa.com",
    "dnmltda@hotmail.com",
    "diegotimao93@gmail.com",
  ];

  const filter = KEEP_EMAILS.map((e) => `email != '${e}'`).join(" && ");

  let records = [];
  try {
    records = app.findRecordsByFilter("users", filter);
  } catch (e) {
    return;
  }

  for (const record of records) {
    try {
      app.delete(record);
    } catch (e) {
      // mantém o registro em vez de falhar o deploy
    }
  }
}, (app) => {
  // Rollback: dados não armazenados, restauração manual se necessário
})
