// Regras de divergência de estoque (divergencia-estoque.pb.js).
// Carregado com require() dentro de cada handler.

const MOTIVOS = [
  "Contagem diferente do sistema",
  "Quebra ou dano",
  "Sumiço ou furto",
  "Vencido ou estragado",
  "Uso sem registro",
  "Erro de lançamento",
  "Outro",
];
const DIVERGENCIA = ["Inventário", "Ajuste de Estoque", "Perda"];
const GESTAO_ESTOQUE = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador"];
const AUTORIZA = ["Administrador", "Diretoria", "Gerência", "Engenheiro"];

function cargo(a) { return a.get("cargo") || a.get("role"); }
function mestre(a) { return a.get("role") === "admin" || a.get("email") === "dnmltda@hotmail.com"; }
function gestaoEstoque(a) { return mestre(a) || GESTAO_ESTOQUE.includes(cargo(a)); }
function autoriza(a) { return mestre(a) || AUTORIZA.includes(cargo(a)); }

// null = não é divergência; senão { saldo, diferenca } com o saldo de agora.
function calcularDiferenca(app, r) {
  const tipo = r.get("tipo") || (r.get("type") === "ajuste" ? "Ajuste de Estoque" : "");
  if (!DIVERGENCIA.includes(tipo) || !r.get("material_id")) return null;
  let saldo = 0;
  try {
    // Contagem no estoque de uma obra compara com o saldo daquela obra.
    saldo = r.get("estoque_obra_id")
      ? require(`${__hooks}/estoque-lib.js`).saldoObra(app, r.get("estoque_obra_id"), r.get("material_id"))
      : Number(app.findRecordById("materiais", r.get("material_id")).get("quantity_in_stock") || 0);
  } catch (_) { return null; }
  const qtd = Number(r.get("quantidade") || 0);
  const diferenca = tipo === "Perda" ? -qtd : qtd - saldo;
  return { saldo, diferenca: Math.round(diferenca * 10000) / 10000 };
}

module.exports = { MOTIVOS, DIVERGENCIA, GESTAO_ESTOQUE, AUTORIZA, gestaoEstoque, autoriza, calcularDiferenca };
