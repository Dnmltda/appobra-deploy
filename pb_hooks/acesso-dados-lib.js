// Grupos de cargos por tabela (acesso-dados.pb.js). Módulo à parte porque cada
// handler do JSVM roda isolado. Os grupos seguem quem abre a tela correspondente
// (frontend/src/lib/permissoes.js).

const FIN = ["Diretoria", "Gerência", "Financeiro"];
const COMPRAS = ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador", "Financeiro"];
const GRUPO = {
  contas_pagar: FIN, contas_receber: FIN, despesas: FIN, receitas: FIN, fluxo_caixa: FIN, financeiro: FIN, notas_fiscais: FIN,
  compras: COMPRAS, compras_itens: COMPRAS, compras_aprovacao: COMPRAS, compras_recebimento: COMPRAS, compras_anexos: COMPRAS,
  pedidos_compra: COMPRAS,
  fornecedores: COMPRAS.concat(["RH"]),
  clientes: ["Diretoria", "Gerência"], propostas: ["Diretoria", "Gerência"],
  abastecimentos: ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras"],
  licenciamentos: ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras"],
  manutencoes: ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras"],
  documentos: ["Diretoria", "Gerência", "Engenheiro", "RH"], documentos_central: ["Diretoria", "Gerência", "Engenheiro", "RH"],
  perdas_ganhos: ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife"],
};
const TABELAS = Object.keys(GRUPO);

function pode(auth, tabela) {
  if (!auth) return true; // sem login a regra da tabela já recusa
  if (auth.isSuperuser()) return true;
  const cargo = auth.get("cargo") || auth.get("role");
  if (auth.get("dono_sistema") === true || auth.get("role") === "admin" || auth.get("role") === "Administrador" || cargo === "Administrador") return true;
  return (GRUPO[tabela] || []).includes(cargo);
}

module.exports = { TABELAS, pode };
