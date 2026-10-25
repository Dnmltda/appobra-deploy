// Avisos da regra "nada se apaga" e o resumo "Movimentações do dia/semana"
// (pedido do Diego, 25/10/2026). Usado por avisos.pb.js e nada-se-apaga-lib.js.

function ehAdmin(u) {
  const cargo = u.get("cargo") || u.get("role");
  return u.get("dono_sistema") === true || u.get("role") === "admin" || u.get("role") === "Administrador" || cargo === "Administrador";
}

// Responsável da empresa: o primeiro Administrador cadastrado (quem criou a empresa no app).
function responsavel(app, companyId) {
  if (!companyId) return null;
  try {
    const us = app.findRecordsByFilter("users", "company_id = {:c} && status = 'Ativo'", "created", 50, 0, { c: companyId });
    return us.find((u) => ehAdmin(u) && u.get("dono_sistema") !== true && !u.getString("deleted_at")) || null;
  } catch (_) { return null; }
}

function titulares(app) {
  try { return app.findRecordsByFilter("users", "dono_sistema = true", "", 5, 0); } catch (_) { return []; }
}

function notificar(app, usuarioId, mensagem, referencia, tipo) {
  if (!usuarioId) return;
  try {
    const agora = new Date();
    const n = new Record(app.findCollectionByNameOrId("notificacoes"));
    n.set("usuarioId", usuarioId);
    n.set("tipo", tipo || "seguranca");
    n.set("mensagem", mensagem);
    n.set("lida", false);
    n.set("data", agora.toISOString().replace("T", " "));
    n.set("hora", agora.toISOString().slice(11, 16));
    n.set("referencia", referencia || "");
    app.save(n);
  } catch (err) {
    console.log("[avisos] Notificação não gravada:", err);
  }
}

// Tentativa barrada: sino do titular e do responsável da empresa, na hora.
function avisarTentativa(app, companyId, quem, texto) {
  const destino = {};
  titulares(app).forEach((u) => { destino[u.id] = true; });
  const r = responsavel(app, companyId);
  if (r) destino[r.id] = true;
  let empresa = "";
  try { empresa = app.findRecordById("companies", companyId).get("name"); } catch (_) {}
  const msg = `Tentativa barrada${empresa ? ` em ${empresa}` : ""}: ${texto}${quem ? ` (login de ${quem})` : ""}.`;
  Object.keys(destino).forEach((id) => notificar(app, id, msg, "/minhas-movimentacoes", "seguranca"));
}

// Horário de Brasília (UTC-3) → intervalo em UTC no formato do banco.
function intervalo(de, ate) {
  const ini = new Date(`${de}T03:00:00.000Z`);
  const fim = new Date(new Date(`${ate}T03:00:00.000Z`).getTime() + 24 * 3600 * 1000 - 1);
  const f = (d) => d.toISOString().replace("T", " ");
  return { ini: f(ini), fim: f(fim) };
}

function hora(r) {
  const s = String(r.get("created") || "");
  const d = new Date(s.replace(" ", "T"));
  if (isNaN(d.getTime())) return { data: "", hora: "" };
  const br = new Date(d.getTime() - 3 * 3600 * 1000).toISOString();
  return { data: br.slice(0, 10), hora: br.slice(11, 16) };
}

function nomeDe(app, col, id, campo) {
  if (!id) return "";
  try { return app.findRecordById(col, id).get(campo || "name") || ""; } catch (_) { return ""; }
}

// Resumo de uma pessoa num período: o que movimentou, cadastrou, recebeu e as tentativas barradas.
function resumo(app, u, de, ate) {
  const { ini, fim } = intervalo(de, ate);
  const p = { u: u.id, ini, fim, c: u.get("company_id") };
  const busca = (col, filtro) => { try { return app.findRecordsByFilter(col, filtro, "created", 500, 0, p); } catch (_) { return []; } };
  const no = "created >= {:ini} && created <= {:fim}";
  const out = { movimentei: [], cadastrei: [], recebi: [], tentativas: [] };
  const add = (lista, r, texto, extra) => lista.push(Object.assign({ ...hora(r), texto }, extra || {}));

  busca("movimentacoes", `criado_por = {:u} && ${no}`).forEach((r) => {
    const obra = nomeDe(app, "obras", r.get("obra_id"), "nome");
    add(out.movimentei, r, `${r.get("tipo") || "Movimentação"} · ${nomeDe(app, "materiais", r.get("material_id"))} · ${r.get("quantidade")} ${r.get("unidade") || ""}`.trim() + (obra ? ` · ${obra}` : ""));
  });
  busca("epis_entregas", `criado_por = {:u} && ${no}`).forEach((r) =>
    add(out.movimentei, r, `Entrega de EPI · ${nomeDe(app, "epis", r.get("epi_id"), "nome")} · ${nomeDe(app, "funcionarios", r.get("funcionario_id"), "nome")}`));
  busca("emprestimos", `entregue_por = {:u} && ${no}`).forEach((r) =>
    add(out.movimentei, r, `Empréstimo · ${nomeDe(app, "equipamentos", r.get("equipment_id"), "nome")} · ${nomeDe(app, "funcionarios", r.get("funcionario_id"), "nome")}`));
  busca("saldo_funcionario", `criado_por = {:u} && tipo_operacao = 'Utilização' && ${no}`).forEach((r) =>
    add(out.movimentei, r, `Uso · ${nomeDe(app, "materiais", r.get("material_id"))} · ${r.get("quantidade")}${r.get("local_uso") ? ` · ${r.get("local_uso")}` : ""}`));
  busca("historico_alteracoes", `usuario_id = {:u} && campo = '(novo cadastro)' && ${no}`).forEach((r) =>
    add(out.cadastrei, r, `${require(`${__hooks}/nada-se-apaga-lib.js`).nomeTabela(r.get("tabela"))} · ${String(r.get("depois") || "").replace(/^"|"$/g, "")}`));
  busca("notificacoes", `usuarioId = {:u} && tipo != 'seguranca' && ${no}`).forEach((r) => add(out.recebi, r, r.get("mensagem")));
  const todas = ehAdmin(u);
  busca("tentativas_bloqueadas", `${todas ? (u.get("dono_sistema") === true ? "id != ''" : "company_id = {:c}") : "usuario_id = {:u}"} && ${no}`).forEach((r) =>
    add(out.tentativas, r, r.get("detalhe") || `${r.get("acao")} em ${require(`${__hooks}/nada-se-apaga-lib.js`).nomeTabela(r.get("tabela"))}`, { quem: r.get("usuario_nome") || "" }));
  Object.keys(out).forEach((k) => out[k].sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)));
  return out;
}

module.exports = { ehAdmin, responsavel, titulares, notificar, avisarTentativa, intervalo, resumo };
