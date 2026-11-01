/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Avisos e "Movimentações do dia/semana" (pedido do Diego, 25/10/2026; parte 2
// da regra "nada se apaga"). Regras em avisos-lib.js.
//  - Tentativa barrada: sino do titular e do responsável da empresa, na hora
//    (chamado por nada-se-apaga-lib.js).
//  - Cadastro novo entra no histórico ("(novo cadastro)") para o resumo.
//  - GET /api/custom/minhas-movimentacoes?de=AAAA-MM-DD&ate=AAAA-MM-DD: o
//    resumo da pessoa logada (a tela "Movimentações do dia" e o PDF da semana).
//  - Fim do expediente (18h de Brasília, seg a sáb): aviso no sino de quem
//    teve movimentação no dia.
//  - Fechamento da semana (sexta 18h30): UM e-mail por empresa com atividade,
//    para o responsável e para o titular (economiza a cota da Brevo).
// ============================================================

onBootstrap((e) => {
  e.next();
  try {
    const col = e.app.findCollectionByNameOrId("notificacoes");
    const tipo = col.fields.getByName("tipo");
    let mudou = false;
    if (tipo && tipo.values && !tipo.values.includes("seguranca")) {
      tipo.values = [...tipo.values, "seguranca", "resumo"];
      mudou = true;
    }
    // Aviso de convite que não saiu (convite-seguro.pb.js).
    if (tipo && tipo.values && !tipo.values.includes("acesso")) {
      tipo.values = [...tipo.values, "acesso"];
      mudou = true;
    }
    if (mudou) e.app.save(col);
  } catch (err) {
    console.log("[avisos] Erro ao preparar notificações:", err);
  }
});

// Cadastro novo → histórico (base do "O que eu cadastrei").
onRecordCreateRequest((e) => {
  e.next();
  try {
    const lib = require(`${__hooks}/nada-se-apaga-lib.js`);
    if (!lib.CADASTROS.includes(e.collection.name) || !e.auth || e.auth.isSuperuser()) return;
    const r = e.record;
    const nome = r.get("name") || r.get("nome") || r.get("nome_completo") || r.get("razao_social") || r.get("placa") || r.get("email") || r.id;
    // Depois do e.next() a transação do pedido já terminou: grava pelo $app.
    const h = new Record($app.findCollectionByNameOrId("historico_alteracoes"));
    h.set("company_id", r.get("company_id") || e.auth.get("company_id"));
    h.set("usuario_id", e.auth.id);
    h.set("usuario_nome", e.auth.get("name") || e.auth.get("email"));
    h.set("tabela", e.collection.name);
    h.set("registro_id", r.id);
    h.set("campo", "(novo cadastro)");
    h.set("antes", "");
    h.set("depois", JSON.stringify(String(nome)));
    $app.save(h);
  } catch (err) {
    console.log("[avisos] Erro ao registrar cadastro novo:", err);
  }
});

routerAdd("GET", "/api/custom/minhas-movimentacoes", (e) => {
  const lib = require(`${__hooks}/avisos-lib.js`);
  const q = e.requestInfo().query || {};
  const dia = /^\d{4}-\d{2}-\d{2}$/;
  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const de = dia.test(String(q.de || "")) ? String(q.de) : hoje;
  const ate = dia.test(String(q.ate || "")) ? String(q.ate) : de;
  if (ate < de || (new Date(ate) - new Date(de)) > 31 * 24 * 3600 * 1000) throw new BadRequestError("Período inválido (no máximo 31 dias).");
  return e.json(200, { de, ate, ...lib.resumo(e.app, e.auth, de, ate) });
}, $apis.requireAuth("users"));

// Fim do expediente: aviso no sino de quem teve movimentação no dia.
cronAdd("resumo-do-dia", "0 21 * * 1-6", () => {
  const lib = require(`${__hooks}/avisos-lib.js`);
  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  let n = 0;
  try {
    $app.findRecordsByFilter("users", "status = 'Ativo'", "", 0, 0).forEach((u) => {
      const r = lib.resumo($app, u, hoje, hoje);
      const total = r.movimentei.length + r.cadastrei.length + r.recebi.length + r.tentativas.length;
      if (!total) return;
      lib.notificar($app, u.id, `Suas movimentações de hoje estão prontas (${total} registro(s)). Toque para ver.`, "/minhas-movimentacoes", "resumo");
      n++;
    });
  } catch (err) {
    console.log("[avisos] Erro no resumo do dia:", err);
  }
  console.log(`[avisos] resumo do dia avisado a ${n} pessoa(s).`);
});

// Fechamento da semana: um e-mail por empresa com atividade.
cronAdd("resumo-da-semana", "30 21 * * 5", () => {
  const lib = require(`${__hooks}/avisos-lib.js`);
  const email = require(`${__hooks}/email-lib.js`);
  const fimSemana = new Date(Date.now() - 3 * 3600 * 1000);
  const ate = fimSemana.toISOString().slice(0, 10);
  const de = new Date(fimSemana.getTime() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { ini, fim } = lib.intervalo(de, ate);
  const conta = (col, c) => {
    try {
      const rows = arrayOf(new DynamicModel({ n: 0 }));
      $app.db().newQuery(`SELECT COUNT(*) AS n FROM ${col} WHERE company_id = {:c} AND created >= {:i} AND created <= {:f}`).bind({ c, i: ini, f: fim }).all(rows);
      return rows.length ? rows[0].n : 0;
    } catch (_) { return 0; }
  };
  const titulares = lib.titulares($app).map((u) => u.get("email")).filter(Boolean);
  let enviados = 0;
  $app.findAllRecords("companies").forEach((emp) => {
    try {
      const c = emp.id;
      const num = {
        "Movimentações de estoque": conta("movimentacoes", c),
        "Entregas de EPI": conta("epis_entregas", c),
        "Empréstimos de equipamento": conta("emprestimos", c),
        "Pedidos de material": conta("solicitacoes", c),
        "Tentativas barradas": conta("tentativas_bloqueadas", c),
      };
      if (!Object.values(num).some((v) => v > 0)) return;
      const resp = lib.responsavel($app, c);
      const para = [...new Set([resp && resp.get("email"), ...titulares].filter(Boolean))];
      if (!para.length) return;
      const tent = $app.findRecordsByFilter("tentativas_bloqueadas", "company_id = {:c} && created >= {:i} && created <= {:f}", "created", 30, 0, { c, i: ini, f: fim });
      const linhas = Object.keys(num).map((k) => `<tr><td style="padding:4px 8px">${email.esc(k)}</td><td style="padding:4px 8px;text-align:right"><b>${num[k]}</b></td></tr>`).join("");
      const lista = tent.map((t) => `<li>${email.esc(String(t.get("created")).slice(0, 16))} · ${email.esc(t.get("detalhe") || t.get("acao"))}${t.get("usuario_nome") ? ` (login de ${email.esc(t.get("usuario_nome"))})` : ""}</li>`).join("");
      const link = `${email.enderecoApp()}/minhas-movimentacoes`;
      $app.newMailClient().send(new MailerMessage({
        from: { address: $app.settings().meta.senderAddress, name: email.REMETENTE },
        to: para.map((a) => ({ address: a })),
        subject: `Movimentações da semana — ${emp.get("name")} (${de.split("-").reverse().join("/")} a ${ate.split("-").reverse().join("/")})`,
        text: Object.keys(num).map((k) => `${k}: ${num[k]}`).join("\n") + `\n\nVer e baixar o PDF da semana: ${link}`,
        html: email.corpo(
          `Movimentações da semana — ${email.esc(emp.get("name"))}`,
          `<table style="border-collapse:collapse;margin:0 0 12px">${linhas}</table>` +
          (lista ? `<p style="margin:0 0 6px"><b>Tentativas barradas</b></p><ul style="margin:0 0 12px">${lista}</ul>` : ""),
          "Ver e baixar o PDF da semana",
          link,
          "Resumo semanal do APP OBRA. Os registros são fixos: nada pode ser alterado ou apagado."
        ),
      }));
      enviados++;
    } catch (err) {
      console.log("[avisos] E-mail da semana não enviado:", err);
    }
  });
  console.log(`[avisos] resumo da semana: ${enviados} e-mail(s).`);
});
