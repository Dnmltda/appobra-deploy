/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Etapa 4.3 (documento mestre): divergência de estoque com motivo e
// autorização. Também fecha o pendente da Etapa 3: o SERVIDOR decide quem
// aprova movimentação (antes só a tela restringia).
//
//  - Aprovar/lançar movimentação (status Aprovado ou Finalizado): só a gestão
//    do estoque (Administrador, Diretoria, Gerência, Engenheiro, Mestre de
//    Obras, Almoxarife, Comprador). De outra pessoa, nasce "Pendente".
//  - Inventário, Ajuste de Estoque e Perda são "divergência" quando mudam o
//    saldo. Nesse caso:
//      * o motivo é obrigatório (lista fixa, campo motivo_divergencia);
//      * só Administrador, Diretoria, Gerência ou Engenheiro autorizam; de
//        outra pessoa da gestão, a contagem fica "Pendente" esperando
//        autorização;
//      * fica gravado: saldo do sistema na hora da contagem, diferença, quem
//        autorizou e quando.
//    Inventário que bate com o sistema não precisa de motivo nem autorização.
// Lançamentos automáticos do servidor (compra recebida, entrega de pedido,
// saldo inicial) não passam por aqui: não são requisições de tela.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    const col = app.findCollectionByNameOrId("movimentacoes");
    const lib = require(`${__hooks}/divergencia-lib.js`);
    const add = (f) => { if (!col.fields.getByName(f.name)) col.fields.add(f); };
    add(new SelectField({ name: "motivo_divergencia", maxSelect: 1, values: lib.MOTIVOS }));
    add(new NumberField({ name: "saldo_sistema" }));
    add(new NumberField({ name: "diferenca_contagem" }));
    add(new RelationField({ name: "autorizado_por", collectionId: "_pb_users_auth_", maxSelect: 1 }));
    add(new DateField({ name: "data_autorizacao" }));
    app.save(col);
  } catch (err) {
    console.log("[divergencia-estoque] Erro ao preparar:", err);
  }
});

onRecordCreateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser()) {
    const lib = require(`${__hooks}/divergencia-lib.js`);
    const r = e.record;
    ["autorizado_por", "data_autorizacao", "saldo_sistema", "diferenca_contagem"].forEach((f) => r.set(f, null));
    const efetiva = ["Aprovado", "Finalizado"].includes(r.get("status"));
    if (efetiva && !lib.gestaoEstoque(a)) r.set("status", "Pendente");

    const dif = lib.calcularDiferenca(e.app, r);
    if (dif !== null) {
      r.set("saldo_sistema", dif.saldo);
      r.set("diferenca_contagem", dif.diferenca);
      if (dif.diferenca !== 0) {
        if (!r.get("motivo_divergencia")) {
          throw new BadRequestError("Diga o motivo da diferença no estoque (ex.: quebra, sumiço, erro de lançamento).");
        }
        if (["Aprovado", "Finalizado"].includes(r.get("status"))) {
          if (lib.autoriza(a)) {
            r.set("autorizado_por", a.id);
            r.set("data_autorizacao", new Date().toISOString().replace("T", " "));
          } else {
            r.set("status", "Pendente"); // espera autorização
          }
        }
      }
    }
  }
  e.next();
}, "movimentacoes");

onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser()) {
    const lib = require(`${__hooks}/divergencia-lib.js`);
    const r = e.record;
    const o = r.original();
    ["autorizado_por", "data_autorizacao", "saldo_sistema", "diferenca_contagem"].forEach((f) => r.set(f, o.get(f)));
    const efetiva = (s) => ["Aprovado", "Finalizado"].includes(s);
    if (efetiva(r.get("status")) && !efetiva(o.get("status")) && o.get("status") !== "Cancelado") {
      if (!lib.gestaoEstoque(a)) throw new ForbiddenError("Só a gestão do estoque aprova movimentação.");
      const dif = lib.calcularDiferenca(e.app, r); // saldo de agora
      if (dif !== null && dif.diferenca !== 0) {
        if (!lib.autoriza(a)) {
          throw new ForbiddenError("Ajuste com diferença no estoque precisa da autorização de Administrador, Diretoria, Gerência ou Engenheiro.");
        }
        if (!r.get("motivo_divergencia")) throw new BadRequestError("Diga o motivo da diferença no estoque antes de autorizar.");
        r.set("saldo_sistema", dif.saldo);
        r.set("diferenca_contagem", dif.diferenca);
        r.set("autorizado_por", a.id);
        r.set("data_autorizacao", new Date().toISOString().replace("T", " "));
      }
    }
  }
  e.next();
}, "movimentacoes");
