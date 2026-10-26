/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Conta a pagar paga fica fechada (Bloco 4, aprovado pelo Diego em
// 26/10/2026; regra "nada se apaga": registro fechado não muda). Depois da
// baixa ninguém altera valor, vencimento ou situação; a tentativa vai para o
// sino do titular e do responsável da empresa.
// ============================================================

onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser() && e.record.original().get("status") === "Paga") {
    require(`${__hooks}/nada-se-apaga-lib.js`).registrarTentativa($app, a, "editar", "contas_pagar", e.record.id,
      `Tentou alterar a conta paga "${e.record.original().get("descricao")}"`);
    throw new ForbiddenError("Esta conta já foi paga e não pode mais ser alterada.");
  }
  e.next();
}, "contas_pagar");
