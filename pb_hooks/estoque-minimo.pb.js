/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Etapa 4.5 (documento mestre): alerta de estoque mínimo.
// Depois de qualquer movimentação gravada (tela, entrega de pedido, compra
// recebida, cancelamento) e de qualquer mudança no cadastro do material
// (ex.: mínimo alterado), confere se o saldo chegou ao mínimo. Se chegou,
// avisa no sininho a gestão do estoque e manda e-mail para Administrador,
// Almoxarife e Comprador — uma vez por "descida" (ver estoque-minimo-lib.js).
// Os avisos rodam depois que a gravação terminou: se falharem, a
// movimentação continua valendo.
// ============================================================

onBootstrap((e) => {
  e.next();
  try {
    const col = e.app.findCollectionByNameOrId("materiais");
    if (!col.fields.getByName("alerta_minimo_enviado")) {
      col.fields.add(new BoolField({ name: "alerta_minimo_enviado", hidden: true }));
      e.app.save(col);
    }
  } catch (err) {
    console.log("[estoque-minimo] Erro ao preparar:", err);
  }
});

onRecordAfterCreateSuccess((e) => {
  e.next();
  try { require(`${__hooks}/estoque-minimo-lib.js`).verificar(e.app, e.record.get("material_id")); } catch (err) { console.log("[estoque-minimo]", err); }
}, "movimentacoes");

onRecordAfterUpdateSuccess((e) => {
  e.next();
  try { require(`${__hooks}/estoque-minimo-lib.js`).verificar(e.app, e.record.get("material_id")); } catch (err) { console.log("[estoque-minimo]", err); }
}, "movimentacoes");

onRecordAfterUpdateSuccess((e) => {
  e.next();
  try { require(`${__hooks}/estoque-minimo-lib.js`).verificar(e.app, e.record.id); } catch (err) { console.log("[estoque-minimo]", err); }
}, "materiais");
