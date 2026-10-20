/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Estoque de EPI calculado pelo SERVIDOR (pendente da auditoria, 20/10/2026).
//
// Antes, a tela de EPIs lia o saldo, fazia a conta e gravava
// epis.quantidade_estoque depois de cada entrega, reposição e devolução: duas
// pessoas ao mesmo tempo (ou uma tela desatualizada) erravam o saldo, e dava
// para gravar qualquer número por fora.
//
// Agora, numa transação (tudo ou nada):
//  - Entrega (epis_entregas) e reposição (epis_reposicoes): tiram a quantidade
//    do estoque do EPI; sem saldo, o registro é recusado ("Estoque
//    insuficiente…") e nada muda.
//  - Devolução (epis_devolucoes) aprovada para reutilizar: devolve ao estoque
//    a quantidade da entrega. A entrega fica "Devolvido" e não pode ser
//    devolvida duas vezes.
//  - O EPI tem de ser da mesma empresa do registro.
//  - Editar a quantidade do EPI direto (ajuste/inventário) só a gestão:
//    Administrador, Diretoria, Gerência, Engenheiro, Mestre de Obras,
//    Almoxarife e RH. De outra pessoa, a quantidade enviada é ignorada.
// Conta do saldo em estoque-epi-lib.js (cada handler do JSVM roda isolado).
// ============================================================

// Entrega e reposição: tira do estoque.
onRecordCreateRequest((e) => {
  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    const r = e.record;
    const qtd = Number(r.get("quantidade") || 0);
    if (!(qtd > 0)) throw new BadRequestError("Informe a quantidade.");
    const empresa = r.get("company_id") || (e.auth ? e.auth.get("company_id") : "");
    let epiSaida = null;
    try { epiSaida = txApp.findRecordById("epis", r.get("epi_id")); } catch (_) {}
    require(`${__hooks}/estoque-epi-lib.js`).somarEpi(txApp, r.get("epi_id"), empresa, -qtd, epiSaida ? epiSaida.get("nome") : "");
    e.next();
  });
}, "epis_entregas", "epis_reposicoes");

// Devolução: aprovada para reutilizar volta ao estoque; a entrega fica "Devolvido".
onRecordCreateRequest((e) => {
  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    const r = e.record;
    let ent;
    try { ent = txApp.findRecordById("epis_entregas", r.get("entrega_id")); } catch (_) {}
    const empresa = r.get("company_id") || (e.auth ? e.auth.get("company_id") : "");
    if (!ent || ent.get("company_id") !== empresa) throw new BadRequestError("Entrega não encontrada.");
    if (ent.get("situacao") === "Devolvido") throw new BadRequestError("Esta entrega já foi devolvida.");
    if (r.get("aprovado_reutilizacao")) {
      require(`${__hooks}/estoque-epi-lib.js`).somarEpi(txApp, ent.get("epi_id"), empresa, Number(ent.get("quantidade") || 0), "");
    }
    ent.set("situacao", "Devolvido");
    txApp.save(ent);
    e.next();
  });
}, "epis_devolucoes");

// Quantidade do EPI: só a gestão ajusta direto (inventário); entregas,
// reposições e devoluções passam pelos hooks acima.
onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser()) {
    const cargo = a.get("cargo") || a.get("role");
    const gestao = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "RH"].includes(cargo)
      || a.get("role") === "admin" || a.get("email") === "dnmltda@hotmail.com";
    if (!gestao) e.record.set("quantidade_estoque", e.record.original().get("quantidade_estoque"));
  }
  e.next();
}, "epis");
