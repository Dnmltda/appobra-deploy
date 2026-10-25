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

// Campos escondidos na resposta para quem não trabalha com eles (usado pelo
// onRecordEnrich de acesso-dados.pb.js e pela trava de busca, item A5).
const PESSOAS = ["Diretoria", "Gerência", "RH", "Mestre de Obras"];
const VALORES = ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador", "Financeiro"];
const CAMPOS = {
  funcionarios: [PESSOAS, ["cpf", "salario", "data_nascimento", "endereco", "cep", "contato_emergencia"]],
  users: [["RH"], ["cpf"]],
  materiais: [VALORES, ["unit_cost"]],
  equipamentos: [VALORES, ["acquisition_cost", "valor_compra", "valor_atual"]],
  equipamentos_manutencao: [VALORES, ["custos"]],
  epis: [VALORES.concat(["RH"]), ["valor_unitario", "valor_medio"]],
  obras: [["Diretoria", "Gerência", "Engenheiro", "Financeiro"], ["budget", "actual_cost"]],
  saldo_funcionario: [VALORES, ["valor_unitario", "valor_total"]],
};
// Nomes comuns em outras tabelas (compras, movimentações): só contam na própria tabela.
const COMUNS = ["valor_unitario", "valor_total", "custos"];

function ehAdmin(auth) {
  const cargo = auth.get("cargo") || auth.get("role");
  return auth.get("dono_sistema") === true || auth.get("role") === "admin" || auth.get("role") === "Administrador" || cargo === "Administrador";
}

// Campos que esta pessoa não vê nesta tabela ([] = vê tudo).
function escondidos(auth, tabela) {
  if (!auth || auth.isSuperuser() || ehAdmin(auth)) return [];
  const regra = CAMPOS[tabela];
  if (!regra || regra[0].includes(auth.get("cargo") || auth.get("role"))) return [];
  return regra[1];
}

// A5: busca/ordenação que usa um campo escondido para esta pessoa. Devolve o
// nome do campo, ou "" quando a busca pode seguir.
function buscaProibida(auth, tabela, texto) {
  if (!auth || !texto || auth.isSuperuser() || ehAdmin(auth)) return "";
  const t = String(texto);
  const tabelas = Object.keys(CAMPOS);
  for (let i = 0; i < tabelas.length; i++) {
    const campos = escondidos(auth, tabelas[i]);
    for (let j = 0; j < campos.length; j++) {
      const c = campos[j];
      if (tabelas[i] === tabela && new RegExp("(^|[^.\\w])" + c + "\\b").test(t)) return c;
      if (!COMUNS.includes(c) && new RegExp("\\." + c + "\\b").test(t)) return c;
    }
  }
  return "";
}

module.exports = { TABELAS, pode, CAMPOS, escondidos, buscaProibida };
