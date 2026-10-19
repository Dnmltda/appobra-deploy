// Lógica de saldo de estoque usada por estoque-servidor.pb.js.
// Fica num módulo à parte porque cada handler do JSVM roda isolado e só
// enxerga o que carrega com require().

const SOMA = ["Entrada", "Devolução", "Retorno ao Almoxarifado", "Devolução de Funcionário"];
const SUBTRAI = ["Saída", "Consumo de Obra", "Retirada por Funcionário", "Perda"];
const SALDO_PASSA_A_SER = ["Inventário", "Ajuste de Estoque"];
// Estoque por obra (pedido do Diego, 19/10/2026): compra entra no estoque
// geral e é distribuída para o estoque de cada obra.
const PARA_OBRA = "Transferência para Obra"; // geral − q, obra + q
const DA_OBRA = "Devolução da Obra";          // obra − q, geral + q
// campo antigo "type" (inglês), usado se "tipo" vier vazio
const TYPE_ANTIGO = { entrada: "Entrada", saida: "Saída", devolucao: "Devolução", ajuste: "Ajuste de Estoque" };

function efetivo(status) {
  return status === "Aprovado" || status === "Finalizado";
}

function tipoDe(r) {
  return r.get("tipo") || TYPE_ANTIGO[r.get("type")] || "";
}

function saldoAtual(app, materialId) {
  const m = app.findRecordById("materiais", materialId);
  return Number(m.get("quantity_in_stock") || 0);
}

// Soma "delta" ao saldo de forma atômica; recusa se ficaria negativo.
function somarAoSaldo(app, materialId, delta) {
  const res = app.db()
    .newQuery(
      "UPDATE materiais SET quantity_in_stock = COALESCE(quantity_in_stock, 0) + {:d}, " +
      "updated = strftime('%Y-%m-%d %H:%M:%fZ', 'now') " +
      "WHERE id = {:id} AND COALESCE(quantity_in_stock, 0) + {:d} >= 0"
    )
    .bind({ d: delta, id: materialId })
    .execute();
  return res.rowsAffected() > 0;
}

// ---- estoque da obra (coleção estoque_obra: um registro por obra e material)
function saldoObra(app, obraId, materialId) {
  const recs = app.findRecordsByFilter("estoque_obra", "obra_id = {:o} && material_id = {:m}", "", 1, 0, { o: obraId, m: materialId });
  return recs.length ? Number(recs[0].get("quantidade") || 0) : 0;
}

function somarAoSaldoDaObra(app, companyId, obraId, materialId, delta) {
  const recs = app.findRecordsByFilter("estoque_obra", "obra_id = {:o} && material_id = {:m}", "", 1, 0, { o: obraId, m: materialId });
  if (!recs.length) {
    if (delta < 0) return false;
    const novo = new Record(app.findCollectionByNameOrId("estoque_obra"));
    novo.set("company_id", companyId);
    novo.set("obra_id", obraId);
    novo.set("material_id", materialId);
    novo.set("quantidade", delta);
    app.save(novo);
    return true;
  }
  const res = app.db()
    .newQuery(
      "UPDATE estoque_obra SET quantidade = COALESCE(quantidade, 0) + {:d}, " +
      "updated = strftime('%Y-%m-%d %H:%M:%fZ', 'now') " +
      "WHERE id = {:id} AND COALESCE(quantidade, 0) + {:d} >= 0"
    )
    .bind({ d: delta, id: recs[0].id })
    .execute();
  return res.rowsAffected() > 0;
}

function nomeDaObra(app, obraId) {
  try { return app.findRecordById("obras", obraId).get("nome") || "da obra"; } catch (_) { return "da obra"; }
}

function aplicar(app, r) {
  const materialId = r.get("material_id");
  if (!materialId) throw new BadRequestError("Selecione o material da movimentação.");
  const tipo = tipoDe(r);
  const qtd = Number(r.get("quantidade") || 0);
  if (!(qtd >= 0)) throw new BadRequestError("Quantidade inválida.");

  // Transferências usam a obra do lançamento se o estoque da obra não veio.
  if ((tipo === PARA_OBRA || tipo === DA_OBRA) && !r.get("estoque_obra_id")) r.set("estoque_obra_id", r.get("obra_id") || "");
  const obraId = r.get("estoque_obra_id") || "";
  if ((tipo === PARA_OBRA || tipo === DA_OBRA) && !obraId) throw new BadRequestError("Escolha a obra da transferência.");
  if (obraId) {
    let obra = null;
    try { obra = app.findRecordById("obras", obraId); } catch (_) {}
    if (!obra || obra.get("company_id") !== r.get("company_id")) throw new BadRequestError("Obra inválida.");
  }

  // delta no estoque geral e no estoque da obra
  let geral = 0;
  let naObra = 0;
  const antesGeral = saldoAtual(app, materialId);
  const antesObra = obraId ? saldoObra(app, obraId, materialId) : 0;
  const antes = obraId && tipo !== PARA_OBRA && tipo !== DA_OBRA ? antesObra : antesGeral;
  let delta = 0;
  if (tipo === PARA_OBRA) { geral = -qtd; naObra = qtd; }
  else if (tipo === DA_OBRA) { geral = qtd; naObra = -qtd; }
  else {
    if (SOMA.includes(tipo)) delta = qtd;
    else if (SUBTRAI.includes(tipo)) delta = -qtd;
    else if (SALDO_PASSA_A_SER.includes(tipo)) delta = qtd - antes;
    else if (tipo === "Transferência") delta = 0;
    else throw new BadRequestError("Tipo de movimentação desconhecido: " + (tipo || "(vazio)"));
    if (obraId) naObra = delta; else geral = delta;
  }

  if (naObra < 0 && !somarAoSaldoDaObra(app, r.get("company_id"), obraId, materialId, naObra)) {
    throw new BadRequestError(
      "Saldo insuficiente no estoque da obra " + nomeDaObra(app, obraId) + ": há " + antesObra + " e a movimentação pede " + qtd + "."
    );
  }
  if (geral !== 0 && !somarAoSaldo(app, materialId, geral)) {
    throw new BadRequestError(
      "Saldo insuficiente: há " + antesGeral + " em estoque e a movimentação pede " + qtd + "."
    );
  }
  if (naObra > 0) somarAoSaldoDaObra(app, r.get("company_id"), obraId, materialId, naObra);
  r.set("estoque_aplicado", true);
  r.set("quantidade_aplicada", geral);
  r.set("quantidade_aplicada_obra", naObra);
  r.set("saldo_anterior", antes);
  r.set("saldo_posterior", antes + (obraId && tipo !== PARA_OBRA && tipo !== DA_OBRA ? naObra : geral));
}

function estornar(app, r) {
  const delta = -Number(r.get("quantidade_aplicada") || 0);
  const deltaObra = -Number(r.get("quantidade_aplicada_obra") || 0);
  const materialId = r.get("material_id");
  const obraId = r.get("estoque_obra_id") || "";
  if (deltaObra < 0 && !somarAoSaldoDaObra(app, r.get("company_id"), obraId, materialId, deltaObra)) {
    throw new BadRequestError(
      "Não dá para cancelar: o estoque da obra " + nomeDaObra(app, obraId) + " (" + saldoObra(app, obraId, materialId) +
      ") é menor do que este lançamento. Registre uma saída ou um ajuste."
    );
  }
  if (delta !== 0 && !somarAoSaldo(app, materialId, delta)) {
    throw new BadRequestError(
      "Não dá para cancelar: o estoque atual (" + saldoAtual(app, materialId) +
      ") é menor do que esta entrada. Registre uma saída ou um ajuste."
    );
  }
  if (deltaObra > 0) somarAoSaldoDaObra(app, r.get("company_id"), obraId, materialId, deltaObra);
  r.set("estoque_aplicado", false);
}

function camposAlterados(r, o) {
  const out = [];
  const fields = r.collection().fields;
  for (let i = 0; i < fields.length; i++) {
    const n = fields[i].name;
    if (JSON.stringify(r.get(n)) !== JSON.stringify(o.get(n))) out.push(n);
  }
  return out;
}

module.exports = { efetivo, aplicar, estornar, camposAlterados, saldoObra, PARA_OBRA, DA_OBRA };
