/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// "Registrar uso" no Saldo por Funcionário (pedido do Diego, 19/10/2026).
// O funcionário que está com material em posse diz onde usou (obra + local,
// ex.: "3º andar"). O saldo dele baixa sem voltar ao estoque (o estoque já
// baixou na retirada) e o valor passa a contar como gasto daquela obra
// (tela Materiais por Obra).
//
// saldo_funcionario ganha:
//   - tipo_operacao "Utilização";
//   - local_uso (texto), valor_unitario e valor_total (custo na hora do uso).
// Regras no servidor:
//   - Utilização exige obra e local, e não passa do que a pessoa tem em posse;
//   - a gestão lança para qualquer funcionário; o próprio funcionário só no
//     seu saldo (users.funcionario_id);
//   - quem não é da gestão não lança retirada/devolução nem altera/apaga
//     lançamentos (antes a regra deixava qualquer pessoa da empresa).
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    const col = app.findCollectionByNameOrId("saldo_funcionario");
    let mudou = false;
    const tipo = col.fields.getByName("tipo_operacao");
    const valores = [];
    for (let i = 0; i < tipo.values.length; i++) valores.push(String(tipo.values[i]));
    if (!valores.includes("Utilização")) { valores.push("Utilização"); tipo.values = valores; mudou = true; }
    const qtd = col.fields.getByName("quantidade");
    // "min: 1" barrava meio rolo, 0,5 m³ etc.
    // (min é ponteiro no Go: compara pelo JSON do campo)
    if (qtd && Number(JSON.parse(JSON.stringify(qtd)).min) !== 0.0001) { qtd.min = 0.0001; mudou = true; }
    if (!col.fields.getByName("local_uso")) { col.fields.add(new TextField({ name: "local_uso", max: 300 })); mudou = true; }
    if (!col.fields.getByName("valor_unitario")) { col.fields.add(new NumberField({ name: "valor_unitario" })); mudou = true; }
    if (!col.fields.getByName("valor_total")) { col.fields.add(new NumberField({ name: "valor_total" })); mudou = true; }
    if (mudou) {
      app.save(col);
      console.log("[uso-material] saldo_funcionario pronto para \"Registrar uso\".");
    }
  } catch (err) {
    console.log("[uso-material] Erro ao preparar saldo_funcionario:", err);
  }
});

onRecordCreateRequest((e) => {
  const a = e.auth;
  if (!a || a.isSuperuser()) return e.next();
  const lib = require(`${__hooks}/uso-material-lib.js`);
  const r = e.record;
  const gestao = lib.ehGestao(a);

  if (r.get("tipo_operacao") !== "Utilização") {
    if (!gestao) throw new ForbiddenError("Só o almoxarifado ou a gestão registra retirada e devolução.");
    return e.next();
  }

  const funcId = r.get("funcionario_id");
  if (!gestao && a.get("funcionario_id") !== funcId) {
    throw new ForbiddenError("Você só pode registrar o uso do material que está com você.");
  }
  if (!r.get("obra_id")) throw new BadRequestError("Escolha a obra onde o material foi usado.");
  const local = String(r.get("local_uso") || "").trim();
  if (!local) throw new BadRequestError("Diga onde o material foi usado (ex.: 3º andar, apartamento 302).");
  r.set("local_uso", local);

  const qtd = Number(r.get("quantidade") || 0);
  if (!(qtd > 0)) throw new BadRequestError("A quantidade usada precisa ser maior que zero.");
  const emPosse = lib.saldoEmPosse(e.app, funcId, r.get("material_id"));
  if (qtd > emPosse + 1e-9) {
    throw new BadRequestError(`Quantidade maior do que a que está com o funcionário (em posse: ${emPosse}).`);
  }

  const mat = e.app.findRecordById("materiais", r.get("material_id"));
  const unit = Number(mat.get("unit_cost") || 0);
  r.set("valor_unitario", unit);
  r.set("valor_total", Number((unit * qtd).toFixed(2)));
  r.set("movimentacao_id", "");
  r.set("responsavel_id", a.id);
  r.set("criado_por", a.id);
  if (!r.get("data_operacao")) r.set("data_operacao", new Date().toISOString().replace("T", " "));
  e.next();
}, "saldo_funcionario");

onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser() && !require(`${__hooks}/uso-material-lib.js`).ehGestao(a)) {
    throw new ForbiddenError("Lançamentos do saldo não podem ser alterados.");
  }
  e.next();
}, "saldo_funcionario");

onRecordDeleteRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser() && !require(`${__hooks}/uso-material-lib.js`).ehGestao(a)) {
    throw new ForbiddenError("Lançamentos do saldo não podem ser apagados.");
  }
  e.next();
}, "saldo_funcionario");
