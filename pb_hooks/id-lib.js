// Funções do ID por tempo de casa (usadas por id-tempo-de-casa.pb.js).
// Módulo à parte porque cada handler do JSVM roda isolado.

// Próximo número da empresa, olhando acessos e funcionários (inclusive
// arquivados/inativos, para nunca repetir).
function proximoIdDaEmpresa(app, companyId) {
  let max = 0;
  ["users", "funcionarios"].forEach((col) => {
    let recs = [];
    try {
      recs = app.findRecordsByFilter(col, "company_id = {:c}", "", 0, 0, { c: companyId });
    } catch (_) {}
    for (let i = 0; i < recs.length; i++) {
      const v = String(recs[i].get("id_unico") || "");
      if (/^\d+$/.test(v)) max = Math.max(max, parseInt(v, 10));
    }
  });
  return String(max + 1).padStart(2, "0");
}

function idDaMesmaPessoa(app, outraColecao, companyId, email, idDireto) {
  try {
    if (idDireto) {
      const v = String(app.findRecordById(outraColecao, idDireto).get("id_unico") || "");
      if (/^\d+$/.test(v)) return v;
    }
  } catch (_) {}
  if (!email) return "";
  try {
    const r = app.findRecordsByFilter(outraColecao, "company_id = {:c} && email = {:e}", "", 1, 0,
      { c: companyId, e: String(email).toLowerCase() });
    const v = r.length ? String(r[0].get("id_unico") || "") : "";
    if (/^\d+$/.test(v)) return v;
  } catch (_) {}
  return "";
}

module.exports = { proximoIdDaEmpresa, idDaMesmaPessoa };
