// Quem pode criar e alterar cada tabela pela API (auditoria de 24/10/2026,
// item A3, aprovado pelo Diego). Antes qualquer pessoa logada da empresa
// gravava aqui pela API, mesmo sem ter a tela. Os grupos seguem quem abre a
// tela correspondente (frontend/src/lib/permissoes.js e as checagens de cada
// tela). Administrador e titular passam sempre. As tabelas do dia a dia da obra
// (pedido de material, empréstimo, entrega de EPI, saldo, ocorrências, mural,
// QR) ficam de fora: já têm regras próprias e a equipe grava nelas.

const FIN = ["Diretoria", "Gerência", "Financeiro"];
const COMPRAS = ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador", "Financeiro"];
const COMERCIAL = ["Diretoria", "Gerência"];
const OBRAS = ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife"];
const EQUIP = ["Diretoria", "Gerência", "Gerente", "Engenheiro", "Mestre de Obras", "Almoxarife"];
const EPI = ["Diretoria", "Gerência", "Gerente", "Mestre de Obras", "Almoxarife", "RH", "Técnico de Segurança"];
const FROTA = ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras"];
const DOCS = ["Diretoria", "Gerência", "Engenheiro", "RH"];
const RH = ["Diretoria", "Gerência", "RH"];
const PERDAS = ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife"];

const GRUPO = {
  contas_pagar: FIN, contas_receber: FIN, despesas: FIN, receitas: FIN, fluxo_caixa: FIN, notas_fiscais: FIN, centro_custos: FIN,
  compras: COMPRAS, compras_itens: COMPRAS, compras_aprovacao: COMPRAS, compras_recebimento: COMPRAS, compras_anexos: COMPRAS,
  fornecedores: COMPRAS,
  clientes: COMERCIAL, propostas: COMERCIAL, empresas: COMERCIAL,
  obras: OBRAS,
  equipamentos: EQUIP, equipamentos_manutencao: EQUIP,
  epis: EPI, epis_reposicoes: EPI,
  veiculos: FROTA, abastecimentos: FROTA, manutencoes: FROTA, licenciamentos: FROTA, quilometragem: FROTA, motoristas: FROTA,
  documentos: DOCS, documentos_central: DOCS,
  treinamentos: RH, equipes: RH, equipe_funcionario: RH, escalas: RH, escala_funcionario: RH,
  perdas_ganhos: PERDAS,
};
const TABELAS = Object.keys(GRUPO);

function ehAdmin(auth) {
  const cargo = auth.get("cargo") || auth.get("role");
  return auth.get("dono_sistema") === true || auth.get("role") === "admin" || auth.get("role") === "Administrador" || cargo === "Administrador";
}

function pode(auth, tabela) {
  if (!auth) return true; // sem login a regra da tabela já recusa
  if (auth.isSuperuser()) return true;
  if (ehAdmin(auth)) return true;
  return (GRUPO[tabela] || []).includes(auth.get("cargo") || auth.get("role"));
}

function recusa() {
  return "Seu cargo não tem permissão para alterar este cadastro. Fale com o administrador.";
}

module.exports = { TABELAS, pode, recusa };
