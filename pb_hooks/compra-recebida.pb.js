/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Compra "Recebido" só por quem pode lançar movimentação (auditoria de
// 24/10/2026, item M3, aprovado pelo Diego em 25/10/2026). Marcar "Recebido"
// dá entrada no estoque (estoque-servidor.pb.js); antes, quem só editava
// compras (ex.: Financeiro) fazia essa entrada sem poder lançar movimentação.
// A lista é a mesma da regra de criar movimentação (acesso-estoque.pb.js).
//
// A conferência roda antes de o pedido chegar ao registro: a edição de compra
// roda numa transação (estoque-servidor.pb.js) que é desfeita com a recusa, e a
// tentativa gravada lá dentro sumiria junto. Pelo mesmo motivo a trava por
// cargo (gravacao-cargo) em compras também é conferida aqui.
// ============================================================

routerUse((e) => {
  let recusa = null;
  try {
    const m = e.request && e.request.method === "PATCH" && /^\/api\/collections\/(compras|[a-z0-9]{15})\/records\/([^/]+)$/.exec(e.request.url.path);
    const a = e.auth;
    if (m && a && !a.isSuperuser()) {
      const col = $app.findCollectionByNameOrId(decodeURIComponent(m[1]));
      if (col.name === "compras") {
        const o = $app.findRecordById("compras", decodeURIComponent(m[2]));
        const corpo = e.requestInfo().body || {};
        const nada = require(`${__hooks}/nada-se-apaga-lib.js`);
        const cargo = require(`${__hooks}/gravacao-cargo-lib.js`);
        if (o.get("company_id") === a.get("company_id") && !cargo.pode(a, "compras")) {
          nada.registrarTentativa($app, a, "gravar sem permissão", "compras", o.id, "Cargo sem permissão tentou gravar em compras");
          recusa = cargo.recusa("compras");
        } else if (corpo.status === "Recebido" && o.get("status") !== "Recebido" && o.get("company_id") === a.get("company_id")) {
          const PODE = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador"];
          const admin = a.get("role") === "admin" || a.get("role") === "Administrador" || a.get("dono_sistema") === true;
          if (!admin && !PODE.includes(a.get("cargo") || a.get("role"))) {
            nada.registrarTentativa($app, a, "receber compra", "compras", o.id,
              "Tentou marcar uma compra como Recebido (entrada no estoque) sem poder lançar movimentação");
            recusa = "Só quem lança movimentação de estoque pode marcar a compra como Recebido. Peça ao almoxarife.";
          }
        }
      }
    }
  } catch (_) {
    // registro não encontrado etc.: a rota normal responde
  }
  if (recusa) throw new ForbiddenError(recusa);
  return e.next();
});

// Reforço na própria gravação (ex.: corpo enviado de outro jeito).
onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser() && e.record.get("status") === "Recebido" && e.record.original().get("status") !== "Recebido") {
    const PODE = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador"];
    const admin = a.get("role") === "admin" || a.get("role") === "Administrador" || a.get("dono_sistema") === true;
    if (!admin && !PODE.includes(a.get("cargo") || a.get("role"))) {
      throw new ForbiddenError("Só quem lança movimentação de estoque pode marcar a compra como Recebido. Peça ao almoxarife.");
    }
  }
  e.next();
}, "compras");
