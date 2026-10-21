// Conferência do código de barras do material (codigo-barras.pb.js).
// Módulo à parte porque cada handler do JSVM roda isolado.

function conferir(e) {
  const r = e.record;
  const cod = String(r.get("codigo_barras") || "").trim();
  r.set("codigo_barras", cod);
  if (cod) {
    const iguais = e.app.findRecordsByFilter("materiais",
      "company_id = {:c} && codigo_barras = {:b} && id != {:id} && deleted_at = ''", "", 1, 0,
      { c: r.get("company_id") || (e.auth ? e.auth.get("company_id") : ""), b: cod, id: r.id || "" });
    if (iguais.length) {
      throw new BadRequestError(`Este código de barras já está no material "${iguais[0].get("name")}".`);
    }
  }
  e.next();
}

module.exports = { conferir };
