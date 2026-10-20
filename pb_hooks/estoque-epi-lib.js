// Saldo de EPI (usado por estoque-epi.pb.js). Módulo à parte porque cada
// handler do JSVM roda isolado e só enxerga o que carrega com require().

// Soma "delta" ao estoque do EPI de forma atômica; recusa se ficaria negativo
// ou se o EPI não é da empresa do registro.
function somarEpi(app, epiId, empresa, delta, nome) {
  let epi;
  try { epi = app.findRecordById("epis", epiId); } catch (_) {}
  if (!epi || epi.get("company_id") !== empresa) throw new BadRequestError("EPI não encontrado.");
  const res = app.db()
    .newQuery("UPDATE epis SET quantidade_estoque = COALESCE(quantidade_estoque, 0) + {:d} " +
      "WHERE id = {:id} AND COALESCE(quantidade_estoque, 0) + {:d} >= 0")
    .bind({ d: delta, id: epiId })
    .execute();
  if (res.rowsAffected() === 0) {
    throw new BadRequestError(`Estoque insuficiente de ${epi.get("nome") || nome || "EPI"}: há ` +
      `${Number(epi.get("quantidade_estoque") || 0)} e foram pedidos ${-delta}.`);
  }
}

module.exports = { somarEpi };
