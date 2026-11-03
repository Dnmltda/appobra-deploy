/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Devolução em duas etapas (pedido do Diego, 03/11/2026): o espelho do aceite
// da retirada (aceite-retirada.pb.js), na direção contrária.
//   1. O FUNCIONÁRIO informa, pelo app, que está devolvendo X de um material
//      do saldo dele (POST /api/custom/devolucao/informar). Nada muda ainda:
//      fica uma movimentação "Devolução de Funcionário" Pendente, com
//      aceite_status "Aguardando".
//   2. A gestão do estoque confirma que o material voltou de fato
//      (POST /api/custom/devolucao/confirmar): confirmar | diferenca (chegou
//      menos) | recusar (motivo). Só aí o saldo dele é debitado (lançamento
//      criado pelo servidor) e o estoque é creditado — no geral ou no estoque
//      da obra de onde o material saiu (a gestão pode trocar).
// Funcionário SEM acesso ao app: a gestão registra a devolução já confirmada,
// como antes (uso-material-lib.conferirLancamentoDireto). Para quem tem
// acesso, a devolução direta pela tela é recusada: sempre as duas pontas.
// ============================================================

onBootstrap((e) => {
  e.next();
  try {
    const col = e.app.findCollectionByNameOrId("movimentacoes");
    if (!col.fields.getByName("quantidade_informada")) {
      col.fields.add(new NumberField({ name: "quantidade_informada" }));
      e.app.save(col);
      console.log("[devolucao-funcionario] movimentacoes: campo quantidade_informada criado.");
    }
  } catch (err) {
    console.log("[devolucao-funcionario] Erro:", err);
  }
});

// Devolução direta pela tela (já "Aprovado") só para quem não tem acesso ao app.
onRecordCreateRequest((e) => {
  const r = e.record;
  r.set("quantidade_informada", null);
  if (r.get("tipo") === "Devolução de Funcionário" && e.auth && !e.auth.isSuperuser()) {
    const lib = require(`${__hooks}/uso-material-lib.js`);
    if (lib.temAcesso(e.app, r.get("funcionario_id"))) {
      throw new BadRequestError("Este funcionário tem acesso ao app: ele mesmo informa a devolução no app (Meu Material) e o almoxarifado confirma quando o material chegar.");
    }
  }
  e.next();
}, "movimentacoes");
onRecordUpdateRequest((e) => {
  e.record.set("quantidade_informada", e.record.original().get("quantidade_informada"));
  e.next();
}, "movimentacoes");

// 1. Funcionário informa a devolução.
routerAdd("POST", "/api/custom/devolucao/informar", (e) => {
  const a = e.auth;
  const lib = require(`${__hooks}/uso-material-lib.js`);
  const d = new DynamicModel({ material_id: "", quantidade: 0, observacoes: "" });
  e.bindBody(d);
  const funcId = String(a.get("funcionario_id") || "");
  if (!funcId) throw new ForbiddenError("Seu acesso não está ligado a um cadastro de funcionário.");
  const matId = String(d.material_id || "");
  let mat;
  try { mat = $app.findRecordById("materiais", matId); } catch (_) { throw new BadRequestError("Escolha o material."); }
  if (mat.get("company_id") !== a.get("company_id")) throw new BadRequestError("Escolha o material.");
  const qtd = Number(d.quantidade || 0);
  if (!(qtd > 0)) throw new BadRequestError("Informe a quantidade que está devolvendo.");
  // O que já está informado e ainda não foi confirmado não pode ser devolvido de novo.
  const pend = $app.findRecordsByFilter("movimentacoes",
    "funcionario_id = {:f} && material_id = {:m} && tipo = 'Devolução de Funcionário' && aceite_status = 'Aguardando'", "", 0, 0, { f: funcId, m: matId })
    .reduce((s, m) => s + Number(m.get("quantidade") || 0), 0);
  const posse = lib.saldoEmPosse($app, funcId, matId) - pend;
  if (qtd > posse + 1e-9) throw new BadRequestError(`Quantidade maior do que a que está com você${pend ? " (descontando devoluções ainda não confirmadas)" : ""}: ${Math.max(0, posse)}.`);

  // Volta para o estoque de onde saiu: obra da última retirada dele, se houver.
  let obraEstoque = "";
  try {
    const ult = $app.findRecordsByFilter("movimentacoes",
      "funcionario_id = {:f} && material_id = {:m} && tipo = 'Retirada por Funcionário' && status != 'Cancelado'", "-created", 1, 0, { f: funcId, m: matId });
    if (ult.length) obraEstoque = ult[0].get("estoque_obra_id") || "";
  } catch (_) {}

  const mov = new Record($app.findCollectionByNameOrId("movimentacoes"));
  const agora = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  mov.set("company_id", a.get("company_id"));
  mov.set("material_id", matId);
  mov.set("tipo", "Devolução de Funcionário");
  mov.set("quantidade", qtd);
  mov.set("quantidade_informada", qtd);
  mov.set("unidade", mat.get("unit") || "");
  mov.set("funcionario_id", funcId);
  mov.set("estoque_obra_id", obraEstoque);
  mov.set("obra_id", obraEstoque);
  mov.set("origem", "Funcionário");
  mov.set("destino", obraEstoque ? "Estoque da obra" : "Almoxarifado");
  mov.set("status", "Pendente");
  mov.set("aceite_status", "Aguardando");
  mov.set("observacoes", String(d.observacoes || "").slice(0, 500));
  mov.set("data", agora.slice(0, 10) + " 12:00:00.000Z");
  mov.set("hora", agora.slice(11, 16));
  mov.set("criado_por", a.id);
  mov.set("solicitante_id", a.id);
  $app.save(mov);

  // Sino de quem cuida do estoque na empresa.
  try {
    const av = require(`${__hooks}/avisos-lib.js`);
    const CUIDA = ["Administrador", "Gerência", "Almoxarife"];
    const destino = {};
    $app.findRecordsByFilter("users", "company_id = {:c} && status = 'Ativo'", "", 0, 0, { c: a.get("company_id") }).forEach((u) => {
      if (CUIDA.includes(u.get("cargo")) || u.get("role") === "admin") destino[u.id] = true;
    });
    const msg = `${a.get("name") || a.get("username")} está devolvendo ${qtd} ${mat.get("unit") || ""} de ${mat.get("name")}. Confirme na tela Estoque quando o material chegar.`;
    Object.keys(destino).forEach((id) => av.notificar($app, id, msg, "/estoque", "estoque"));
  } catch (_) {}
  return e.json(200, { ok: true, id: mov.id });
}, $apis.requireAuth("users"));

// Devoluções que eu informei e ainda não foram confirmadas.
routerAdd("GET", "/api/custom/devolucao/minhas", (e) => {
  const f = String(e.auth.get("funcionario_id") || "");
  if (!f) return e.json(200, { items: [] });
  const lista = $app.findRecordsByFilter("movimentacoes",
    "funcionario_id = {:f} && tipo = 'Devolução de Funcionário' && aceite_status = 'Aguardando'", "-created", 100, 0, { f });
  return e.json(200, { items: lista.map((m) => {
    let nome = "";
    try { nome = $app.findRecordById("materiais", m.get("material_id")).get("name") || ""; } catch (_) {}
    return { id: m.id, material: nome, material_id: m.get("material_id"), quantidade: Number(m.get("quantidade") || 0), unidade: m.get("unidade") || "", data: String(m.get("created") || "").slice(0, 16) };
  }) });
}, $apis.requireAuth("users"));

// 2. Gestão do estoque confirma (ou não) que o material voltou.
routerAdd("POST", "/api/custom/devolucao/confirmar", (e) => {
  const a = e.auth;
  const CUIDA = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador"];
  const admin = a.get("role") === "admin" || a.get("role") === "Administrador" || a.get("dono_sistema") === true;
  if (!admin && !CUIDA.includes(a.get("cargo") || a.get("role"))) throw new ForbiddenError("Só quem cuida do estoque confirma a devolução.");
  const d = new DynamicModel({ movimentacao_id: "", acao: "", quantidade_recebida: 0, motivo: "", estoque_obra_id: "__manter__" });
  e.bindBody(d);
  let mov;
  try { mov = $app.findRecordById("movimentacoes", String(d.movimentacao_id || "")); } catch (_) { throw new NotFoundError("Devolução não encontrada."); }
  if (mov.get("company_id") !== a.get("company_id") || mov.get("tipo") !== "Devolução de Funcionário") throw new NotFoundError("Devolução não encontrada.");
  if (mov.get("aceite_status") !== "Aguardando") throw new BadRequestError("Esta devolução já foi resolvida.");
  const acao = String(d.acao || "");
  if (!["confirmar", "diferenca", "recusar"].includes(acao)) throw new BadRequestError("Escolha confirmar, chegou menos ou recusar.");
  const informado = Number(mov.get("quantidade") || 0);
  const motivo = String(d.motivo || "").trim().slice(0, 500);
  let recebido = informado;
  if (acao === "diferenca") {
    recebido = Number(d.quantidade_recebida || 0);
    if (!(recebido > 0 && recebido < informado)) throw new BadRequestError(`Informe quanto chegou: mais que zero e menos que ${informado}.`);
    if (!motivo) throw new BadRequestError("Explique a diferença.");
  }
  if (acao === "recusar" && !motivo) throw new BadRequestError("Diga o motivo da recusa.");
  const status = acao === "confirmar" ? "Aceito" : acao === "diferenca" ? "Aceito com diferença" : "Recusado";

  $app.runInTransaction((tx) => {
    const m = tx.findRecordById("movimentacoes", mov.id);
    m.set("aceite_status", status);
    m.set("quantidade_recebida", acao === "recusar" ? 0 : recebido);
    m.set("aceite_motivo", motivo);
    m.set("aceito_por", a.id);
    m.set("aceito_em", new Date().toISOString().replace("T", " "));
    m.set("responsavel_id", a.id);
    if (acao === "recusar") {
      m.set("status", "Cancelado");
      m.set("motivo_cancelamento", "Devolução recusada: " + motivo);
      tx.save(m);
      return;
    }
    if (String(d.estoque_obra_id) !== "__manter__") {
      m.set("estoque_obra_id", String(d.estoque_obra_id || ""));
      m.set("obra_id", String(d.estoque_obra_id || ""));
    }
    m.set("quantidade", recebido);
    m.set("status", "Aprovado"); // o estoque (geral ou da obra) é creditado aqui (estoque-servidor.pb.js)
    tx.save(m);
    const s = new Record(tx.findCollectionByNameOrId("saldo_funcionario"));
    const agora = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    s.set("company_id", m.get("company_id"));
    s.set("funcionario_id", m.get("funcionario_id"));
    s.set("material_id", m.get("material_id"));
    s.set("tipo_operacao", "Devolução");
    s.set("quantidade", recebido);
    s.set("data_operacao", agora.slice(0, 10) + " 12:00:00.000Z");
    s.set("hora_operacao", agora.slice(11, 16));
    s.set("obra_id", m.get("obra_id") || "");
    s.set("movimentacao_id", m.id);
    s.set("responsavel_id", a.id);
    s.set("criado_por", a.id);
    s.set("observacoes", status === "Aceito" ? "Devolução confirmada pelo almoxarifado" : `Informou ${informado}, chegou ${recebido}: ${motivo}`);
    tx.save(s);
  });

  // Sino do funcionário com o resultado.
  try {
    const av = require(`${__hooks}/avisos-lib.js`);
    let nome = "";
    try { nome = $app.findRecordById("materiais", mov.get("material_id")).get("name") || ""; } catch (_) {}
    const un = mov.get("unidade") || "";
    const msg = status === "Aceito" ? `Sua devolução de ${informado} ${un} de ${nome} foi confirmada.`
      : status === "Recusado" ? `Sua devolução de ${informado} ${un} de ${nome} foi recusada: ${motivo}. O material continua no seu saldo.`
        : `Sua devolução de ${nome}: chegaram ${recebido} de ${informado} ${un} (${motivo}). Saiu do seu saldo só o que chegou.`;
    $app.findRecordsByFilter("users", "funcionario_id = {:f} && status = 'Ativo'", "", 5, 0, { f: mov.get("funcionario_id") })
      .forEach((u) => av.notificar($app, u.id, msg, "/saldo-funcionario", "estoque"));
  } catch (_) {}
  return e.json(200, { ok: true, status, recebido: acao === "recusar" ? 0 : recebido });
}, $apis.requireAuth("users"));
