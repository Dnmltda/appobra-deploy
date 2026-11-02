/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Funcionário confirma o material antes de ele entrar no saldo dele (pedido
// do Diego, 02/11/2026). Na tela Estoque, a "Retirada por Funcionário" baixa o
// estoque na hora (como antes), mas o saldo do funcionário só recebe o
// material depois que ELE confirma:
//   - Aceitar: entra a quantidade enviada;
//   - Recebi menos: informa quanto chegou (ex.: 18 de 22) e entra só isso;
//   - Recusar: informa o motivo e nada entra.
// Aceitar e "recebi menos" exigem a foto do que chegou (a prova que o Diego
// queria). Diferença ou recusa avisam no sino quem enviou e o responsável da
// empresa; nada volta ao estoque sozinho (pode ser extravio): a gestão resolve
// com Devolução ou Perda. O envio fica "Aguardando" até a resposta.
// Só vale para envios novos: o que já estava no saldo não muda. E só para
// funcionário com acesso ativo ao app (quem não tem login não tem como
// confirmar: para ele o saldo entra na hora, como antes).
//
// movimentacoes ganha: aceite_status, quantidade_recebida, aceite_motivo,
// aceito_por, aceito_em, foto_aceite (protegida). Quem responde é só o próprio
// funcionário, pela rota POST /api/custom/retirada/responder; a lista dele vem
// de GET /api/custom/retirada/pendentes (o funcionário não lê movimentações).
// ============================================================

onBootstrap((e) => {
  e.next();
  try {
    const app = e.app;
    const col = app.findCollectionByNameOrId("movimentacoes");
    let mudou = false;
    const add = (f) => { if (!col.fields.getByName(f.name)) { col.fields.add(f); mudou = true; } };
    add(new SelectField({ name: "aceite_status", maxSelect: 1, values: ["Aguardando", "Aceito", "Aceito com diferença", "Recusado"] }));
    add(new NumberField({ name: "quantidade_recebida" }));
    add(new TextField({ name: "aceite_motivo", max: 500 }));
    add(new RelationField({ name: "aceito_por", collectionId: "_pb_users_auth_", maxSelect: 1 }));
    add(new DateField({ name: "aceito_em" }));
    add(new FileField({ name: "foto_aceite", maxSelect: 1, maxSize: 8 * 1024 * 1024, protected: true, mimeTypes: ["image/jpeg", "image/png", "image/webp"] }));
    if (mudou) { app.save(col); console.log("[aceite-retirada] movimentacoes: campos do aceite do funcionário criados."); }
  } catch (err) {
    console.log("[aceite-retirada] Erro:", err);
  }
});

// Envio direto para funcionário com acesso ativo nasce "Aguardando"; a
// resposta é só dele.
onRecordCreateRequest((e) => {
  const r = e.record;
  ["aceite_status", "quantidade_recebida", "aceite_motivo", "aceito_por", "aceito_em", "foto_aceite"].forEach((f) => r.set(f, null));
  const f = String(r.get("funcionario_id") || "");
  if (r.get("tipo") === "Retirada por Funcionário" && f) {
    let comAcesso = [];
    try { comAcesso = e.app.findRecordsByFilter("users", "funcionario_id = {:f} && status = 'Ativo'", "", 1, 0, { f }); } catch (_) {}
    if (comAcesso.length) r.set("aceite_status", "Aguardando");
  }
  e.next();
}, "movimentacoes");

// A resposta do funcionário não muda depois, nem por outra pessoa.
onRecordUpdateRequest((e) => {
  const r = e.record;
  const o = r.original();
  ["aceite_status", "quantidade_recebida", "aceite_motivo", "aceito_por", "aceito_em", "foto_aceite"].forEach((f) => r.set(f, o.get(f)));
  e.next();
}, "movimentacoes");

// O saldo de um envio com aceite só é criado pelo servidor, na resposta do
// funcionário (a tela antiga criava na hora: avisa para atualizar a página).
onRecordCreateRequest((e) => {
  const m = String(e.record.get("movimentacao_id") || "");
  if (m && e.record.get("tipo_operacao") === "Retirada") {
    let mov = null;
    try { mov = e.app.findRecordById("movimentacoes", m); } catch (_) {}
    if (mov && mov.get("aceite_status")) {
      throw new BadRequestError("Atualize a página: agora o funcionário confirma o recebimento antes de o material entrar no saldo dele.");
    }
  }
  e.next();
}, "saldo_funcionario");

// Sino do funcionário: chegou material para ele confirmar.
onRecordAfterCreateSuccess((e) => {
  const m = e.record;
  if (m.get("aceite_status") === "Aguardando") {
    try {
      const av = require(`${__hooks}/avisos-lib.js`);
      let material = "";
      try { material = e.app.findRecordById("materiais", m.get("material_id")).get("name") || ""; } catch (_) {}
      e.app.findRecordsByFilter("users", "funcionario_id = {:f} && status = 'Ativo'", "", 5, 0, { f: m.get("funcionario_id") }).forEach((u) =>
        av.notificar(e.app, u.id, `Chegou ${m.get("quantidade")} ${m.get("unidade") || ""} de ${material} para você. Confira e confirme o recebimento no Painel.`, "/dashboard", "estoque"));
    } catch (err) {
      console.log("[aceite-retirada] Erro ao avisar o funcionário:", err);
    }
  }
  e.next();
}, "movimentacoes");

// Envios aguardando a confirmação de quem está logado.
routerAdd("GET", "/api/custom/retirada/pendentes", (e) => {
  const f = String(e.auth.get("funcionario_id") || "");
  if (!f) return e.json(200, { items: [] });
  const lista = $app.findRecordsByFilter("movimentacoes",
    "funcionario_id = {:f} && company_id = {:c} && aceite_status = 'Aguardando' && status != 'Cancelado'", "-created", 100, 0,
    { f, c: e.auth.get("company_id") });
  const nome = (col, id, campo) => { try { return $app.findRecordById(col, id).get(campo) || ""; } catch (_) { return ""; } };
  return e.json(200, {
    items: lista.map((m) => ({
      id: m.id,
      numero: m.get("numero_movimentacao") || "",
      material: nome("materiais", m.get("material_id"), "name"),
      quantidade: Number(m.get("quantidade") || 0),
      unidade: m.get("unidade") || "",
      data: String(m.get("created") || "").slice(0, 16),
      enviado_por: nome("users", m.get("criado_por") || m.get("responsavel_id"), "name"),
      observacoes: m.get("observacoes") || "",
    })),
  });
}, $apis.requireAuth("users"));

// Resposta do funcionário (multipart: acao, quantidade_recebida, motivo, foto).
routerAdd("POST", "/api/custom/retirada/responder", (e) => {
  const a = e.auth;
  const info = e.requestInfo();
  const corpo = info.body || {};
  const movId = String(corpo.movimentacao_id || "");
  const acao = String(corpo.acao || "");
  let mov;
  try { mov = $app.findRecordById("movimentacoes", movId); } catch (_) { throw new NotFoundError("Envio não encontrado."); }
  if (!a.get("funcionario_id") || mov.get("funcionario_id") !== a.get("funcionario_id") || mov.get("company_id") !== a.get("company_id")) {
    throw new NotFoundError("Envio não encontrado.");
  }
  if (mov.get("aceite_status") !== "Aguardando" || mov.get("status") === "Cancelado") throw new BadRequestError("Este envio já foi respondido.");
  if (!["aceitar", "diferenca", "recusar"].includes(acao)) throw new BadRequestError("Escolha aceitar, recebi menos ou recusar.");
  const enviado = Number(mov.get("quantidade") || 0);
  const motivo = String(corpo.motivo || "").trim().slice(0, 500);
  let recebido = enviado;
  if (acao === "diferenca") {
    recebido = Number(String(corpo.quantidade_recebida || "").replace(",", "."));
    if (!(recebido > 0 && recebido < enviado)) throw new BadRequestError(`Informe quanto chegou: mais que zero e menos que ${enviado}.`);
    if (!motivo) throw new BadRequestError("Explique a diferença (o que aconteceu).");
  }
  if (acao === "recusar") {
    recebido = 0;
    if (!motivo) throw new BadRequestError("Diga o motivo da recusa.");
  }
  let fotos = [];
  try { fotos = e.findUploadedFiles("foto") || []; } catch (_) {} // sem arquivo no pedido
  if (acao !== "recusar" && !fotos.length) throw new BadRequestError("Tire a foto do material que chegou.");

  const status = acao === "aceitar" ? "Aceito" : acao === "diferenca" ? "Aceito com diferença" : "Recusado";
  $app.runInTransaction((tx) => {
    const m = tx.findRecordById("movimentacoes", mov.id);
    m.set("aceite_status", status);
    m.set("quantidade_recebida", recebido);
    m.set("aceite_motivo", motivo);
    m.set("aceito_por", a.id);
    m.set("aceito_em", new Date().toISOString().replace("T", " "));
    if (fotos.length) m.set("foto_aceite", fotos[0]);
    tx.save(m);
    if (recebido > 0) {
      const s = new Record(tx.findCollectionByNameOrId("saldo_funcionario"));
      const agora = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      s.set("company_id", m.get("company_id"));
      s.set("funcionario_id", m.get("funcionario_id"));
      s.set("material_id", m.get("material_id"));
      s.set("tipo_operacao", "Retirada");
      s.set("quantidade", recebido);
      s.set("data_operacao", agora.slice(0, 10) + " 12:00:00.000Z");
      s.set("hora_operacao", agora.slice(11, 16));
      s.set("obra_id", m.get("obra_id") || "");
      s.set("movimentacao_id", m.id);
      s.set("responsavel_id", m.get("responsavel_id") || m.get("criado_por") || "");
      s.set("criado_por", a.id);
      s.set("observacoes", status === "Aceito" ? "Recebimento confirmado pelo funcionário" : `Recebeu ${recebido} de ${enviado}: ${motivo}`);
      tx.save(s);
    }
  });

  // Diferença ou recusa: sino de quem enviou e do responsável da empresa.
  if (status !== "Aceito") {
    try {
      const av = require(`${__hooks}/avisos-lib.js`);
      let material = "";
      try { material = $app.findRecordById("materiais", mov.get("material_id")).get("name") || ""; } catch (_) {}
      const quem = a.get("name") || a.get("username") || "";
      const msg = status === "Recusado"
        ? `${quem} recusou o envio ${mov.get("numero_movimentacao") || ""} (${enviado} ${mov.get("unidade") || ""} de ${material}): ${motivo}. O material saiu do estoque e não entrou no saldo dele.`
        : `${quem} recebeu ${recebido} de ${enviado} ${mov.get("unidade") || ""} de ${material} (envio ${mov.get("numero_movimentacao") || ""}): ${motivo}.`;
      const destino = {};
      [mov.get("criado_por"), mov.get("responsavel_id")].forEach((id) => { if (id) destino[id] = true; });
      const resp = av.responsavel($app, mov.get("company_id"));
      if (resp) destino[resp.id] = true;
      Object.keys(destino).forEach((id) => av.notificar($app, id, msg, "/estoque", "estoque"));
    } catch (err) {
      console.log("[aceite-retirada] Erro ao avisar a diferença:", err);
    }
  }
  return e.json(200, { ok: true, status, recebido });
}, $apis.requireAuth("users"));
