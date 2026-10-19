/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Etapa 4.4 (documento mestre, módulo "Ocorrências" — não existia).
// Registro de acidentes, quase acidentes, danos, faltas, atrasos, furtos...
//
//  - Qualquer pessoa da empresa registra (com foto, pelo celular).
//  - Quem registrou vê as próprias; a gestão (Administrador, Diretoria,
//    Gerência, Engenheiro, Mestre de Obras, Almoxarife) vê todas da empresa.
//  - Número OCO-0001 por empresa, dado pelo servidor.
//  - Nasce sempre "Aberta". Só a gestão muda o andamento:
//      Aberta → Em andamento | Resolvida | Cancelada
//      Em andamento → Resolvida | Cancelada
//      Resolvida/Cancelada → Aberta (reabrir)
//    Para resolver ou cancelar é obrigatório dizer o que foi feito.
//  - Quem registrou pode corrigir o texto/fotos enquanto está "Aberta".
//  - Ninguém apaga ocorrência (é histórico).
//  - Gravidade "Alta": e-mail para Administrador/Diretoria/Gerência/Engenheiro.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    let col = null;
    try { col = app.findCollectionByNameOrId("ocorrencias"); } catch (_) {}
    const GESTAO = '(@request.auth.cargo = "Administrador" || @request.auth.cargo = "Diretoria" || @request.auth.cargo = "Gerência" || ' +
      '@request.auth.cargo = "Engenheiro" || @request.auth.cargo = "Mestre de Obras" || @request.auth.cargo = "Almoxarife" || ' +
      '@request.auth.role = "admin" || @request.auth.email = "dnmltda@hotmail.com")';
    const SAME = '@request.auth.id != "" && @request.auth.company_id = company_id';
    const VER = `${SAME} && (registrado_por = @request.auth.id || ${GESTAO})`;
    if (!col) {
      col = new Collection({
        type: "base",
        name: "ocorrencias",
        fields: [
          { name: "company_id", type: "relation", collectionId: app.findCollectionByNameOrId("companies").id, maxSelect: 1, required: true },
          { name: "numero", type: "text" },
          { name: "tipo", type: "select", maxSelect: 1, required: true, values: [
            "Acidente", "Quase acidente", "Dano a equipamento ou material", "Problema na obra", "Falta de material",
            "Atraso", "Clima", "Furto ou sumiço", "Outro"] },
          { name: "gravidade", type: "select", maxSelect: 1, required: true, values: ["Baixa", "Média", "Alta"] },
          { name: "descricao", type: "text", required: true },
          { name: "local", type: "text" },
          { name: "obra_id", type: "relation", collectionId: app.findCollectionByNameOrId("obras").id, maxSelect: 1 },
          { name: "envolvido_id", type: "relation", collectionId: app.findCollectionByNameOrId("funcionarios").id, maxSelect: 1 },
          { name: "equipamento_id", type: "relation", collectionId: app.findCollectionByNameOrId("equipamentos").id, maxSelect: 1 },
          { name: "data_ocorrencia", type: "date" },
          { name: "fotos", type: "file", maxSelect: 5, maxSize: 10485760,
            mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] },
          { name: "status", type: "select", maxSelect: 1, values: ["Aberta", "Em andamento", "Resolvida", "Cancelada"] },
          { name: "providencia", type: "text" },
          { name: "registrado_por", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
          { name: "resolvido_por", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
          { name: "data_resolucao", type: "date" },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_ocorrencias_numero ON ocorrencias (company_id, numero)"],
      });
    }
    col.listRule = VER;
    col.viewRule = VER;
    col.createRule = '@request.auth.id != "" && (@request.body.company_id:isset = false || @request.body.company_id = @request.auth.company_id)';
    col.updateRule = `${SAME} && (registrado_por = @request.auth.id || ${GESTAO})`;
    col.deleteRule = null;
    app.save(col);
  } catch (err) {
    console.log("[ocorrencias] Erro ao preparar:", err);
  }
});

onRecordCreateRequest((e) => {
  const a = e.auth;
  if (!a) throw new UnauthorizedError("Entre no sistema para continuar.");
  const r = e.record;
  if (!a.isSuperuser()) {
    r.set("company_id", a.get("company_id"));
    r.set("registrado_por", a.id);
  }
  r.set("status", "Aberta");
  r.set("providencia", "");
  r.set("resolvido_por", "");
  r.set("data_resolucao", "");
  if (!r.get("data_ocorrencia")) r.set("data_ocorrencia", new Date().toISOString().replace("T", " "));
  if (!String(r.get("descricao") || "").trim()) throw new BadRequestError("Conte o que aconteceu.");
  // Obra/pessoa/equipamento têm de ser da mesma empresa.
  [["obra_id", "obras"], ["envolvido_id", "funcionarios"], ["equipamento_id", "equipamentos"]].forEach(([f, c]) => {
    if (!r.get(f)) return;
    let x = null;
    try { x = e.app.findRecordById(c, r.get(f)); } catch (_) {}
    if (!x || x.get("company_id") !== r.get("company_id")) throw new BadRequestError("Item escolhido não encontrado.");
  });
  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    const row = new DynamicModel({ n: 0 });
    txApp.db().newQuery("SELECT COUNT(*) AS n FROM ocorrencias WHERE company_id = {:c}").bind({ c: r.get("company_id") }).one(row);
    r.set("numero", "OCO-" + String(row.n + 1).padStart(4, "0"));
    e.next();
  });
}, "ocorrencias");

onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser()) {
    const r = e.record;
    const o = r.original();
    ["company_id", "numero", "registrado_por", "resolvido_por", "data_resolucao"].forEach((f) => r.set(f, o.get(f)));
    const cargo = a.get("cargo") || a.get("role");
    const gestao = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife"].includes(cargo)
      || a.get("role") === "admin" || a.get("email") === "dnmltda@hotmail.com";
    const antes = o.get("status");
    const depois = r.get("status");
    if (!gestao) {
      if (depois !== antes) throw new ForbiddenError("Só a gestão muda o andamento da ocorrência.");
      if (antes !== "Aberta") throw new ForbiddenError("A ocorrência já está sendo tratada; fale com a gestão para corrigir.");
      r.set("providencia", o.get("providencia"));
    } else if (depois !== antes) {
      const PODE = {
        "Aberta": ["Em andamento", "Resolvida", "Cancelada"],
        "Em andamento": ["Resolvida", "Cancelada", "Aberta"],
        "Resolvida": ["Aberta"],
        "Cancelada": ["Aberta"],
      };
      if (!(PODE[antes] || []).includes(depois)) throw new BadRequestError(`Não dá para ir de "${antes}" para "${depois}".`);
      if (["Resolvida", "Cancelada"].includes(depois)) {
        if (!String(r.get("providencia") || "").trim()) throw new BadRequestError("Diga o que foi feito para fechar a ocorrência.");
        r.set("resolvido_por", a.id);
        r.set("data_resolucao", new Date().toISOString().replace("T", " "));
      } else if (depois === "Aberta") {
        r.set("resolvido_por", "");
        r.set("data_resolucao", "");
      }
    }
  }
  e.next();
}, "ocorrencias");

// Gravidade alta: avisa a chefia por e-mail (falha no envio não impede o registro).
onRecordAfterCreateSuccess((e) => {
  e.next();
  const r = e.record;
  if (r.get("gravidade") !== "Alta") return;
  try {
    const lib = require(`${__hooks}/email-lib.js`);
    const chefes = $app.findRecordsByFilter("users",
      "company_id = {:c} && (cargo = 'Administrador' || cargo = 'Diretoria' || cargo = 'Gerência' || cargo = 'Engenheiro' || role = 'admin') && status != 'Inativo'",
      "", 20, 0, { c: r.get("company_id") });
    if (!chefes.length) return;
    let quem = "";
    try { quem = $app.findRecordById("users", r.get("registrado_por")).get("name") || ""; } catch (_) {}
    let obra = "";
    try { if (r.get("obra_id")) obra = $app.findRecordById("obras", r.get("obra_id")).get("nome") || ""; } catch (_) {}
    const link = `${lib.enderecoApp()}/ocorrencias`;
    const resumo = `${r.get("tipo")}${obra ? " · " + obra : ""}`;
    $app.newMailClient().send(new MailerMessage({
      from: { address: $app.settings().meta.senderAddress, name: lib.REMETENTE },
      to: chefes.filter((u) => u.get("email")).map((u) => ({ address: u.get("email") })),
      subject: `Ocorrência grave ${r.get("numero")}: ${resumo}`,
      text: `Ocorrência grave registrada (${r.get("numero")})\n${resumo}\n\n${r.get("descricao")}\n\nRegistrada por: ${quem}\n${link}`,
      html: lib.corpo(
        `Ocorrência grave ${lib.esc(r.get("numero"))}`,
        `<p style="margin:0 0 8px"><strong>${lib.esc(resumo)}</strong></p>` +
          `<p style="margin:0 0 12px">${lib.esc(r.get("descricao"))}</p>` +
          `<p style="margin:0 0 8px;color:#555555">Registrada por: ${lib.esc(quem)}</p>`,
        "Ver a ocorrência",
        link,
        "Você recebeu este aviso porque é da gestão da empresa no APP OBRA."
      ),
    }));
  } catch (err) {
    console.log("[ocorrencias] Aviso por e-mail não enviado:", err);
  }
}, "ocorrencias");
