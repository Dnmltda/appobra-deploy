// Limites por empresa (limites-empresa.pb.js). Módulo à parte porque cada
// handler do JSVM roda isolado.

const LIMITES = {
  users: { campo: "limite_usuarios", nome: "logins" },
  funcionarios: { campo: "limite_funcionarios", nome: "funcionários" },
  materiais: { campo: "limite_materiais", nome: "materiais" },
  obras: { campo: "limite_obras", nome: "obras" },
};
// Empresa nova criada pelo cadastro do site (empresa de teste).
const PADRAO_TESTE = { limite_usuarios: 10, limite_funcionarios: 30, limite_materiais: 300, limite_obras: 5 };

function conferir(e) {
  const a = e.auth;
  if (a && (a.isSuperuser() || a.get("dono_sistema") === true)) return e.next();
  const nome = e.collection.name;
  const l = LIMITES[nome];
  const companyId = e.record.get("company_id") || (a ? a.get("company_id") : "");
  if (l && companyId) {
    let empresa = null;
    try { empresa = e.app.findRecordById("companies", companyId); } catch (_) {}
    const max = empresa ? Number(empresa.get(l.campo) || 0) : 0;
    if (max > 0) {
      const temArquivo = !!e.collection.fields.getByName("deleted_at");
      const rows = arrayOf(new DynamicModel({ n: 0 }));
      e.app.db().newQuery(`SELECT COUNT(*) AS n FROM ${nome} WHERE company_id = {:c}` + (temArquivo ? " AND COALESCE(deleted_at, '') = ''" : ""))
        .bind({ c: companyId }).all(rows);
      if (rows.length && rows[0].n >= max) {
        throw new BadRequestError(`Esta empresa de teste chegou ao limite de ${max} ${l.nome}. Fale com a DNM&LTDA para aumentar.`);
      }
    }
  }
  return e.next();
}

module.exports = { LIMITES, PADRAO_TESTE, conferir };
