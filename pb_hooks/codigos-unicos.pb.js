/// <reference path="../pb_data/types.d.ts" />

// Códigos repetidos na mesma empresa são recusados (M7). Ver codigos-unicos-lib.js.
onRecordCreateRequest((e) => {
  if (e.auth && !e.auth.isSuperuser()) require(`${__hooks}/codigos-unicos-lib.js`).conferir(e, true);
  e.next();
}, "equipamentos", "solicitacoes", "compras", "epis", "clientes");

onRecordUpdateRequest((e) => {
  if (e.auth && !e.auth.isSuperuser()) require(`${__hooks}/codigos-unicos-lib.js`).conferir(e, false);
  e.next();
}, "equipamentos", "solicitacoes", "compras", "epis", "clientes");
