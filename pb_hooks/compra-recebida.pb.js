/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Compra "Recebido" só por quem pode lançar movimentação (auditoria de
// 24/10/2026, item M3, aprovado pelo Diego em 25/10/2026). Marcar "Recebido"
// dá entrada no estoque (estoque-servidor.pb.js); antes, quem só editava
// compras (ex.: Financeiro) fazia essa entrada sem poder lançar movimentação.
// A lista é a mesma da regra de criar movimentação (acesso-estoque.pb.js).
// A tentativa é gravada com $app: o pedido de compra pode estar numa transação
// que é desfeita com a recusa.
// ============================================================

onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser() && e.record.get("status") === "Recebido" && e.record.original().get("status") !== "Recebido") {
    const PODE = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador"];
    const admin = a.get("role") === "admin" || a.get("role") === "Administrador" || a.get("dono_sistema") === true;
    if (!admin && !PODE.includes(a.get("cargo") || a.get("role"))) {
      require(`${__hooks}/nada-se-apaga-lib.js`).registrarTentativa($app, a, "receber compra", "compras", e.record.id,
        "Tentou marcar uma compra como Recebido (entrada no estoque) sem poder lançar movimentação");
      throw new ForbiddenError("Só quem lança movimentação de estoque pode marcar a compra como Recebido. Peça ao almoxarife.");
    }
  }
  e.next();
}, "compras");

