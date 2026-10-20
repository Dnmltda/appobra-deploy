// Funções do empréstimo de equipamento (emprestimo-equipamento.pb.js).
// Carregado com require() dentro de cada handler.

const GESTAO = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife"];

function exigirGestao(auth) {
  if (!auth) throw new UnauthorizedError("Entre no sistema para continuar.");
  if (auth.isSuperuser()) return;
  const cargo = auth.get("cargo") || auth.get("role");
  if (GESTAO.includes(cargo) || auth.get("role") === "admin" || auth.get("dono_sistema") === true) return;
  throw new ForbiddenError("Só a gestão de equipamentos pode emprestar e receber equipamentos.");
}

function equipamentoDaEmpresa(app, id, auth) {
  let eq;
  try { eq = app.findRecordById("equipamentos", id); } catch (_) {}
  if (!eq || eq.getString("deleted_at") || (!auth.isSuperuser() && eq.get("company_id") !== auth.get("company_id"))) {
    throw new BadRequestError("Equipamento não encontrado.");
  }
  return eq;
}

function emprestimoAberto(app, equipamentoId) {
  const lista = app.findRecordsByFilter("emprestimos", "equipment_id = {:e} && status = 'active'", "", 1, 0, { e: equipamentoId });
  return lista.length ? lista[0] : null;
}

function historico(app, eq, usuarioId, texto, antes, detalhes) {
  const agora = new Date();
  const h = new Record(app.findCollectionByNameOrId("equipamentos_historico"));
  h.set("company_id", eq.get("company_id"));
  h.set("equipamento_id", eq.id);
  h.set("data", agora.toISOString().replace("T", " "));
  h.set("hora", agora.toISOString().slice(11, 16));
  h.set("usuario_id", usuarioId);
  h.set("criado_por", usuarioId);
  h.set("alteracao_realizada", texto);
  h.set("status_anterior", antes.sit || "");
  h.set("novo_status", eq.get("situacao") || "");
  h.set("local_anterior", antes.local || "");
  h.set("local_atual", eq.get("local_atual") || "");
  h.set("obra_anterior_id", antes.obra || "");
  h.set("nova_obra_id", eq.get("obra_atual_id") || "");
  h.set("detalhes", detalhes || "");
  app.save(h);
}

module.exports = { GESTAO, exigirGestao, equipamentoDaEmpresa, emprestimoAberto, historico };
