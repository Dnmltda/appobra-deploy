/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Empresa travada nas gravações pela API (auditoria de 24/10/2026, itens A2 e
// A4, aprovado pelo Diego).
//  A4: editar não troca a empresa do registro (só o suporte; o titular ainda
//      move usuários entre empresas).
//  A2: material, funcionário, obra, equipamento etc. ligados a um registro têm
//      de ser da mesma empresa. Antes, com o ID de um material de outra empresa,
//      uma movimentação mexia no estoque dela.
// Só pedidos pela API; as gravações internas do servidor não passam por aqui.
// ============================================================

onRecordCreateRequest((e) => {
  if (e.auth && !e.auth.isSuperuser() && !e.collection.system) {
    require(`${__hooks}/empresa-trava-lib.js`).conferirVinculos(e, true);
  }
  e.next();
});

onRecordUpdateRequest((e) => {
  if (e.auth && !e.auth.isSuperuser() && !e.collection.system) {
    const lib = require(`${__hooks}/empresa-trava-lib.js`);
    lib.conferirTroca(e);
    lib.conferirVinculos(e, false);
  }
  e.next();
});
