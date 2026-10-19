// Lógica de saldo de estoque usada por estoque-servidor.pb.js.
// Fica num módulo à parte porque cada handler do JSVM roda isolado e só
// enxerga o que carrega com require().

const SOMA = ["Entrada", "Devolução", "Retorno ao Almoxarifado", "Devolução de Funcionário"];
const SUBTRAI = ["Saída", "Consumo de Obra", "Retirada por Funcionário", "Perda"];
const SALDO_PASSA_A_SER = ["Inventário", "Ajuste de Estoque"];
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

function aplicar(app, r) {
  const materialId = r.get("material_id");
  if (!materialId) throw new BadRequestError("Selecione o material da movimentação.");
  const tipo = tipoDe(r);
  const qtd = Number(r.get("quantidade") || 0);
  if (!(qtd >= 0)) throw new BadRequestError("Quantidade inválida.");

  const antes = saldoAtual(app, materialId);
  let delta = 0;
  if (SOMA.includes(tipo)) delta = qtd;
  else if (SUBTRAI.includes(tipo)) delta = -qtd;
  else if (SALDO_PASSA_A_SER.includes(tipo)) delta = qtd - antes;
  else if (tipo === "Transferência") delta = 0;
  else throw new BadRequestError("Tipo de movimentação desconhecido: " + (tipo || "(vazio)"));

  if (delta !== 0 && !somarAoSaldo(app, materialId, delta)) {
    throw new BadRequestError(
      "Saldo insuficiente: há " + antes + " em estoque e a movimentação pede " + qtd + "."
    );
  }
  r.set("estoque_aplicado", true);
  r.set("quantidade_aplicada", delta);
  r.set("saldo_anterior", antes);
  r.set("saldo_posterior", antes + delta);
}

function estornar(app, r) {
  const delta = -Number(r.get("quantidade_aplicada") || 0);
  const materialId = r.get("material_id");
  if (delta !== 0 && !somarAoSaldo(app, materialId, delta)) {
    throw new BadRequestError(
      "Não dá para cancelar: o estoque atual (" + saldoAtual(app, materialId) +
      ") é menor do que esta entrada. Registre uma saída ou um ajuste."
    );
  }
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

module.exports = { efetivo, aplicar, estornar, camposAlterados };
