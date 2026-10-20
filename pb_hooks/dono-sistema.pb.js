/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Dono do sistema como campo (users.dono_sistema) — ver dono-lib.js.
//  - No boot: cria o campo, marca a conta Master e troca, em todas as regras
//    já gravadas no banco, a condição antiga por e-mail pela do campo.
//  - Pela API ninguém liga nem desliga o campo (nem o próprio dono): só o
//    superusuário, pelo painel do PocketBase.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    const dono = require(`${__hooks}/dono-lib.js`);
    dono.garantir(app);
    const antigo = `@request.auth.email = "${dono.EMAIL_ANTIGO}"`;
    let trocadas = 0;
    app.findAllCollections().forEach((c) => {
      let mudou = false;
      ["listRule", "viewRule", "createRule", "updateRule", "deleteRule", "manageRule"].forEach((k) => {
        const r = c[k] ? String(c[k]) : "";
        if (r.includes(antigo)) {
          c[k] = r.split(antigo).join(dono.REGRA);
          mudou = true;
        }
      });
      if (mudou) { app.save(c); trocadas++; }
    });
    if (trocadas) console.log(`[dono-sistema] ${trocadas} coleção(ões) passaram a usar o campo dono_sistema.`);
  } catch (err) {
    console.log("[dono-sistema] Erro:", err);
  }
});

onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) e.record.set("dono_sistema", false);
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) e.record.set("dono_sistema", e.record.original().get("dono_sistema"));
  e.next();
}, "users");
