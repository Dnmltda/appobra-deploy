// Regra do Diego (25/10/2026): durante o uso nada se apaga, e toda tentativa
// de adulterar fica registrada (aviso ao titular e ao responsável da empresa
// vem depois, no sino e no resumo do dia/semana). Usado por nada-se-apaga.pb.js
// e por outros hooks que barram gravações.

// Nome de cada tabela como aparece para as pessoas (sino, resumo, e-mail).
const NOMES = {
  materiais: "Materiais", movimentacoes: "Movimentações", funcionarios: "Funcionários", users: "Acessos",
  empresas: "Empresas", obras: "Obras", epis: "EPIs", epis_entregas: "Entregas de EPI", equipamentos: "Equipamentos",
  emprestimos: "Empréstimos", fornecedores: "Fornecedores", clientes: "Clientes", veiculos: "Veículos",
  solicitacoes: "Pedidos de material", solicitacoes_itens: "Itens de pedido", compras: "Compras",
  compras_itens: "Itens de compra", propostas: "Propostas", contas_pagar: "Contas a pagar",
  contas_receber: "Contas a receber", treinamentos: "Treinamentos", saldo_funcionario: "Saldo por funcionário",
  notificacoes: "Notificações", obra_mensagens: "Mural da obra", historico_alteracoes: "Histórico de alterações",
  tentativas_bloqueadas: "Tentativas barradas", ocorrencias: "Ocorrências", divergencias: "Divergências de estoque",
  obras_andares: "Andares da obra", obras_unidades: "Unidades da obra", obras_unidade_servicos: "Serviços da unidade",
  servicos_padrao: "Catálogo de serviços",
};
function nomeTabela(t) {
  return NOMES[t] || String(t || "").replace(/_/g, " ");
}

// Registra uma tentativa barrada. Nunca derruba o pedido principal.
function registrarTentativa(app, auth, acao, tabela, registroId, detalhe) {
  try {
    // Texto para as pessoas: "registro de materiais" vira "registro de Materiais".
    detalhe = String(detalhe || "").replace(new RegExp(`\\b${String(tabela).replace(/[^\w]/g, "")}\\b`, "g"), nomeTabela(tabela));
    const t = new Record(app.findCollectionByNameOrId("tentativas_bloqueadas"));
    t.set("company_id", (auth && auth.get && auth.get("company_id")) || "");
    t.set("usuario_id", (auth && auth.id && !auth.isSuperuser()) ? auth.id : "");
    t.set("usuario_nome", (auth && auth.get && (auth.get("name") || auth.get("email"))) || "");
    t.set("acao", acao);
    t.set("tabela", tabela);
    t.set("registro_id", registroId || "");
    t.set("detalhe", String(detalhe || "").slice(0, 500));
    app.save(t);
    // Sino do titular e do responsável da empresa, na hora (avisos-lib.js).
    require(`${__hooks}/avisos-lib.js`).avisarTentativa(app, t.get("company_id"), t.get("usuario_nome"), t.get("detalhe") || `${acao} em ${nomeTabela(tabela)}`);
  } catch (err) {
    console.log("[nada-se-apaga] Erro ao registrar tentativa:", err);
  }
}

// Material que está com algum funcionário (saldo em posse > 0) não muda.
function materialEmSaldo(app, materialId) {
  if (!materialId) return false;
  const rows = arrayOf(new DynamicModel({ s: 0 }));
  app.db().newQuery(
    "SELECT SUM(CASE WHEN tipo_operacao = 'Retirada' THEN quantidade ELSE -quantidade END) AS s " +
    "FROM saldo_funcionario WHERE material_id = {:m} GROUP BY funcionario_id HAVING s > 0.0001 LIMIT 1"
  ).bind({ m: materialId }).all(rows);
  return rows.length > 0;
}

// Cadastros com histórico de edição (quem, quando, antes e depois).
const CADASTROS = ["materiais", "funcionarios", "equipamentos", "epis", "fornecedores", "clientes", "veiculos", "obras", "empresas", "users",
  "servicos_padrao", "obras_andares", "obras_unidades"];
const FORA_DO_HISTORICO = ["updated", "updated_at", "password", "passwordConfirm", "tokenKey", "password_reset_token",
  "password_reset_expires", "remember_token", "last_login", "login_attempts", "locked_until", "atualizado_por", "data_atualizacao"];

function diferencas(r) {
  const o = r.original();
  const out = [];
  const fields = r.collection().fields;
  for (let i = 0; i < fields.length; i++) {
    const n = fields[i].name;
    if (FORA_DO_HISTORICO.includes(n)) continue;
    const a = JSON.stringify(o.get(n));
    const d = JSON.stringify(r.get(n));
    if (a !== d) out.push({ campo: n, antes: a.slice(0, 300), depois: d.slice(0, 300) });
  }
  return out;
}

module.exports = { registrarTentativa, nomeTabela, materialEmSaldo, CADASTROS, diferencas };
