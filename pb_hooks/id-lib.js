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

// Mesma pessoa na outra coleção (para dar o MESMO id_unico): por id direto
// (funcionario_id, sempre confiável) ou, na falta dele, pelo e-mail — mas SÓ
// entre candidatos que ainda estão ativos. Sem isso, um cadastro antigo já
// excluído "trava" o número pra sempre: o e-mail bate, devolve o id_unico
// dele, e esse número nunca mais pode ser salvo por ninguém, porque o
// registro excluído continua ocupando o lugar no índice único mesmo
// escondido da tela. Corrigido em 19/10/2026.
function idDaMesmaPessoa(app, outraColecao, companyId, email, idDireto) {
  try {
    if (idDireto) {
      const v = String(app.findRecordById(outraColecao, idDireto).get("id_unico") || "");
      if (/^\d+$/.test(v)) return v;
    }
  } catch (_) {}
  if (!email) return "";
  try {
    const candidatos = app.findRecordsByFilter(outraColecao, "company_id = {:c} && email = {:e}", "", 10, 0,
      { c: companyId, e: String(email).toLowerCase() });
    for (let i = 0; i < candidatos.length; i++) {
      const rec = candidatos[i];
      const arquivado = !!rec.getString("deleted_at") || rec.get("is_active") === false;
      if (arquivado) continue;
      const v = String(rec.get("id_unico") || "");
      if (/^\d+$/.test(v)) return v;
    }
  } catch (_) {}
  return "";
}

module.exports = { proximoIdDaEmpresa, idDaMesmaPessoa };
