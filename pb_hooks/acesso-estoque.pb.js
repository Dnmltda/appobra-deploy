/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Quem vê o estoque (pedido do Diego, 20/10/2026).
//
// Estoque geral, estoque das obras, movimentações e o saldo de todos os
// funcionários: só administração, diretoria, gerência, engenheiro, mestre de
// obras, almoxarife, comprador e financeiro. Os demais cargos (pedreiro,
// servente, encanador, eletricista, faxina, funcionário...) veem só o próprio
// saldo (o material que está com eles) e os pedidos deles.
//   - Cadastrar ou alterar material: só quem cuida do estoque/compras.
//   - Na lista de materiais (usada para pedir), quem não vê o estoque recebe
//     o material sem a quantidade e o mínimo.
// O nome do arquivo começa com "acesso" para este onBootstrap rodar depois dos
// outros (no PocketBase o primeiro registrado é o último a terminar).
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  const VE = '(@request.auth.cargo = "Administrador" || @request.auth.cargo = "Diretoria" || @request.auth.cargo = "Gerência" || ' +
    '@request.auth.cargo = "Engenheiro" || @request.auth.cargo = "Mestre de Obras" || @request.auth.cargo = "Almoxarife" || ' +
    '@request.auth.cargo = "Comprador" || @request.auth.cargo = "Financeiro" || ' +
    '@request.auth.role = "admin" || @request.auth.role = "Administrador" || @request.auth.email = "dnmltda@hotmail.com")';
  const CUIDA = '(@request.auth.cargo = "Administrador" || @request.auth.cargo = "Diretoria" || @request.auth.cargo = "Gerência" || ' +
    '@request.auth.cargo = "Engenheiro" || @request.auth.cargo = "Mestre de Obras" || @request.auth.cargo = "Almoxarife" || ' +
    '@request.auth.cargo = "Comprador" || ' +
    '@request.auth.role = "admin" || @request.auth.role = "Administrador" || @request.auth.email = "dnmltda@hotmail.com")';
  const SAME = '@request.auth.id != "" && @request.auth.company_id = company_id';
  const ajustar = (nome, fn) => {
    let col;
    // No primeiro boot estoque_obra ainda não existe: estoque-obra.pb.js a cria
    // logo depois já com esta regra.
    try { col = app.findCollectionByNameOrId(nome); } catch (_) { return; }
    try {
      fn(col);
      app.save(col);
    } catch (err) {
      console.log(`[acesso-estoque] Erro em ${nome}:`, err);
    }
  };

  ajustar("saldo_funcionario", (col) => {
    col.listRule = `${SAME} && (${VE} || (@request.auth.funcionario_id != "" && funcionario_id = @request.auth.funcionario_id))`;
    col.viewRule = col.listRule;
  });
  ajustar("movimentacoes", (col) => {
    col.listRule = `${SAME} && ${VE}`;
    col.viewRule = col.listRule;
    col.createRule = `${SAME} && ${CUIDA}`;
    col.updateRule = `${SAME} && ${CUIDA}`;
  });
  ajustar("estoque_obra", (col) => {
    col.listRule = `${SAME} && ${VE}`;
    col.viewRule = col.listRule;
  });
  ajustar("materiais", (col) => {
    col.createRule = `${SAME} && ${CUIDA}`;
    col.updateRule = `${SAME} && ${CUIDA}`;
  });
  console.log("[acesso-estoque] Estoque visível só para quem cuida dele.");
});

// Quem não vê o estoque recebe o material sem quantidade e mínimo.
onRecordEnrich((e) => {
  const info = e.requestInfo;
  const a = info && info.auth;
  if (a && !a.isSuperuser()) {
    const VE = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador", "Financeiro"];
    const admin = a.get("role") === "admin" || a.get("role") === "Administrador" || a.get("email") === "dnmltda@hotmail.com";
    if (!admin && !VE.includes(a.get("cargo") || a.get("role"))) {
      e.record.hide("quantity_in_stock", "min_quantity");
    }
  }
  e.next();
}, "materiais");
