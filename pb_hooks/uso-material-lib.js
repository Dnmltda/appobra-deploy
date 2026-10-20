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

module.exports = { ehAdmin, ehGestao, saldoEmPosse, notificar, equipeDoEstoque };
