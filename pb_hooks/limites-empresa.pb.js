/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Limites por empresa (pedido do Diego, 21/10/2026): empresa de teste criada
// pelo cadastro do site nasce com até 10 logins, 30 funcionários, 300
// materiais e 5 obras — para não encher o banco e já servir de base para os
// planos (um plano só muda os números). 0 = sem limite (a DNM&LTDA OBRAS e a
// empresa de teste do Diego). Os números só o titular ou o superusuário mudam.
// Regras em limites-lib.js.
// ============================================================

onBootstrap((e) => {
  e.next();
  try {
    const col = e.app.findCollectionByNameOrId("companies");
    let mudou = false;
    ["limite_usuarios", "limite_funcionarios", "limite_materiais", "limite_obras"].forEach((n) => {
      if (!col.fields.getByName(n)) { col.fields.add(new NumberField({ name: n, min: 0, onlyInt: true })); mudou = true; }
    });
    if (mudou) { e.app.save(col); console.log("[limites-empresa] campos de limite criados em companies."); }
  } catch (err) {
    console.log("[limites-empresa] Erro:", err);
  }
});

onRecordCreateRequest((e) => require(`${__hooks}/limites-lib.js`).conferir(e), "users", "funcionarios", "materiais", "obras");

// Os limites só mudam pelo titular ou pelo superusuário.
onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (!(a && (a.isSuperuser() || a.get("dono_sistema") === true))) {
    const o = e.record.original();
    ["limite_usuarios", "limite_funcionarios", "limite_materiais", "limite_obras"].forEach((n) => e.record.set(n, o.get(n)));
  }
  e.next();
}, "companies");
