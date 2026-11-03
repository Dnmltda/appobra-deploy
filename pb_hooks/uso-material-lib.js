// Funções usadas por uso-material.pb.js e fluxo-material.pb.js (cada handler
// do JSVM roda isolado e só enxerga o que carrega com require()).

const CARGOS_GESTAO = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador"];

function ehAdmin(u) {
  if (!u) return false;
  return u.get("role") === "admin" || u.get("role") === "Administrador" || u.get("cargo") === "Administrador" ||
    u.get("dono_sistema") === true;
}

function ehGestao(u) {
  if (!u) return false;
  return ehAdmin(u) || CARGOS_GESTAO.includes(u.get("cargo") || u.get("role"));
}

// Saldo em posse do funcionário: retiradas menos devoluções e usos.
function saldoEmPosse(app, funcionarioId, materialId) {
  const recs = app.findRecordsByFilter("saldo_funcionario",
    "funcionario_id = {:f} && material_id = {:m}", "", 0, 0, { f: funcionarioId, m: materialId });
  let s = 0;
  recs.forEach((r) => {
    const q = Number(r.get("quantidade") || 0);
    s += r.get("tipo_operacao") === "Retirada" ? q : -q;
  });
  return Math.round(s * 10000) / 10000;
}

// Aviso no sininho. Nunca derruba a operação principal.
function notificar(app, usuarioId, mensagem, referencia, tipo) {
  if (!usuarioId) return;
  try {
    const agora = new Date();
    const n = new Record(app.findCollectionByNameOrId("notificacoes"));
    n.set("usuarioId", usuarioId);
    n.set("tipo", tipo || "solicitacao");
    n.set("mensagem", mensagem);
    n.set("lida", false);
    n.set("data", agora.toISOString().replace("T", " "));
    n.set("hora", agora.toISOString().slice(11, 16));
    n.set("referencia", referencia || "");
    app.save(n);
  } catch (err) {
    console.log("[uso-material] Notificação não gravada:", err);
  }
}

// Quem cuida do estoque na empresa (recebe o aviso de pedido novo).
function equipeDoEstoque(app, companyId) {
  const users = app.findRecordsByFilter("users", "company_id = {:c} && status != 'Inativo'", "", 200, 0, { c: companyId });
  return users.filter((u) => !u.getString("deleted_at") &&
    (ehAdmin(u) || ["Almoxarife", "Mestre de Obras"].includes(u.get("cargo") || u.get("role"))));
}

// Funcionário com acesso ativo ao app (ele confirma o que recebe/devolve).
function temAcesso(app, funcionarioId) {
  if (!funcionarioId) return false;
  try {
    return app.findRecordsByFilter("users", "funcionario_id = {:f} && status = 'Ativo'", "", 1, 0, { f: funcionarioId }).length > 0;
  } catch (_) { return false; }
}

// Retirada/Devolução criada pela tela (só para funcionário SEM acesso ao app,
// que não tem como confirmar): tem de vir de uma movimentação de estoque do
// mesmo tipo, funcionário, material e quantidade, que ainda não gerou saldo.
// Fora isso, quem cria o lançamento é o servidor, na confirmação
// (aceite-retirada.pb.js / devolucao-funcionario.pb.js). Devolve o motivo da
// recusa, ou "".
function conferirLancamentoDireto(app, r) {
  const tipo = r.get("tipo_operacao");
  const tipoMov = tipo === "Retirada" ? "Retirada por Funcionário" : "Devolução de Funcionário";
  const movId = String(r.get("movimentacao_id") || "");
  if (!movId) return "Retirada e devolução só entram no saldo a partir de uma movimentação do estoque.";
  let mov;
  try { mov = app.findRecordById("movimentacoes", movId); } catch (_) { return "Movimentação de estoque não encontrada."; }
  if (mov.get("tipo") !== tipoMov || mov.get("funcionario_id") !== r.get("funcionario_id") || mov.get("material_id") !== r.get("material_id")
    || Math.abs(Number(mov.get("quantidade") || 0) - Number(r.get("quantidade") || 0)) > 1e-9 || mov.get("company_id") !== r.get("company_id")) {
    return "O lançamento não confere com a movimentação de estoque (tipo, funcionário, material ou quantidade).";
  }
  if (mov.get("status") === "Cancelado") return "A movimentação de estoque foi cancelada.";
  if (mov.get("aceite_status")) return "Este envio passa pela confirmação: o saldo entra quando ela for feita.";
  if (temAcesso(app, r.get("funcionario_id"))) return "Este funcionário tem acesso ao app: ele mesmo confirma (o saldo entra na confirmação).";
  if (app.findRecordsByFilter("saldo_funcionario", "movimentacao_id = {:m}", "", 1, 0, { m: movId }).length) return "Esta movimentação já gerou lançamento no saldo.";
  return "";
}

module.exports = { temAcesso, conferirLancamentoDireto, ehAdmin, ehGestao, saldoEmPosse, notificar, equipeDoEstoque };
