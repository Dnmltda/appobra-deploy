// Códigos que não se repetem dentro da mesma empresa (auditoria de 24/10/2026,
// item M7, aprovado pelo Diego em 25/10/2026). Usado por codigos-unicos.pb.js.
// Regra no servidor, e não índice no banco: se já houver repetidos antigos em
// produção, nada quebra; só o cadastro novo (ou a troca do código) é conferido.
// Maiúsculas/minúsculas e espaços nas pontas não contam. Arquivados não contam.
// O código do material (CON-001...) já é gerado pelo servidor e não muda
// (materiais-cor.pb.js); o código de barras é conferido em codigo-barras-lib.js.
// O "code" do equipamento é cópia do código interno/patrimônio (fix-schema-telas).

const CAMPOS = {
  equipamentos: [["numero_patrimonial", "número de patrimônio"], ["codigo_interno", "código interno"]],
  solicitacoes: [["numero_solicitacao", "número de pedido"]],
  compras: [["numero_compra", "número de compra"]],
  epis: [["codigo", "código"]],
  clientes: [["cpf_cnpj", "CPF/CNPJ"]],
};

function conferir(e, criando) {
  const col = e.collection;
  const r = e.record;
  const o = criando ? null : r.original();
  const empresa = r.get("company_id") || (e.auth ? e.auth.get("company_id") : "");
  if (!empresa) return;
  const temArquivo = !!col.fields.getByName("deleted_at");
  (CAMPOS[col.name] || []).forEach(([campo, rotulo]) => {
    if (!col.fields.getByName(campo)) return;
    const v = String(r.get(campo) || "").trim();
    if (!v) return;
    // Na edição só confere se o código mudou (repetidos antigos continuam editáveis).
    if (o && String(o.get(campo) || "").trim().toLowerCase() === v.toLowerCase()) return;
    const achou = arrayOf(new DynamicModel({ id: "" }));
    e.app.db().newQuery(
      `SELECT id FROM ${col.name} WHERE company_id = {:c} AND id != {:id} AND lower(trim(${campo})) = lower({:v})` +
      (temArquivo ? " AND (deleted_at = '' OR deleted_at IS NULL)" : "") + " LIMIT 1"
    ).bind({ c: empresa, id: r.id || "", v }).all(achou);
    if (achou.length) {
      throw new BadRequestError(`Já existe um cadastro com este ${rotulo} (${v}) na sua empresa. Use outro.`);
    }
  });
}

module.exports = { CAMPOS, conferir };
