/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Página da obra com foto e mural da equipe (pedido do Diego, 19/10/2026).
//
//  - obras ganha "fotos" (a primeira é a capa).
//  - obra_mensagens: recados da equipe de cada obra ("fiz o serviço do 3º
//    andar", "achei um alicate no 7º andar"), com até 4 fotos.
//    * quem está na obra (users.funcionario_id → funcionarios.obraId) lê e
//      escreve no mural dela; a gestão lê e escreve em todas da empresa;
//    * ninguém edita recado; apaga só quem escreveu ou a gestão;
//    * recado novo avisa no sininho quem está na obra.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    const obras = app.findCollectionByNameOrId("obras");
    if (!obras.fields.getByName("fotos")) {
      obras.fields.add(new FileField({
        name: "fotos", maxSelect: 10, maxSize: 10485760,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
      }));
      app.save(obras);
      console.log("[obra-mural] obras: campo fotos criado.");
    }

    const GESTAO = '(@request.auth.cargo = "Administrador" || @request.auth.cargo = "Diretoria" || @request.auth.cargo = "Gerência" || ' +
      '@request.auth.cargo = "Engenheiro" || @request.auth.cargo = "Mestre de Obras" || @request.auth.cargo = "Almoxarife" || ' +
      '@request.auth.role = "admin" || @request.auth.role = "Administrador" || @request.auth.email = "dnmltda@hotmail.com")';
    const SAME = '@request.auth.id != "" && @request.auth.company_id = company_id';
    const DA_OBRA = '@request.auth.funcionario_id.obraId = obra_id';
    let col = null;
    try { col = app.findCollectionByNameOrId("obra_mensagens"); } catch (_) {}
    if (!col) {
      col = new Collection({
        type: "base",
        name: "obra_mensagens",
        fields: [
          { name: "company_id", type: "relation", collectionId: app.findCollectionByNameOrId("companies").id, maxSelect: 1, required: true },
          { name: "obra_id", type: "relation", collectionId: obras.id, maxSelect: 1, required: true, cascadeDelete: true },
          { name: "autor_id", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
          { name: "tipo", type: "select", maxSelect: 1, values: ["Recado", "Serviço feito", "Problema", "Achei um objeto", "Falta material", "Segurança"] },
          { name: "texto", type: "text", max: 2000 },
          { name: "local", type: "text", max: 120 },
          { name: "fotos", type: "file", maxSelect: 4, maxSize: 10485760,
            mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      });
    }
    col.listRule = `${SAME} && (${DA_OBRA} || ${GESTAO})`;
    col.viewRule = col.listRule;
    col.createRule = '@request.auth.id != ""';
    col.updateRule = null;
    col.deleteRule = `${SAME} && (autor_id = @request.auth.id || ${GESTAO})`;
    app.save(col);
  } catch (err) {
    console.log("[obra-mural] Erro ao preparar o mural da obra:", err);
  }
});

// Recado novo: dono, empresa e permissão vêm do servidor.
onRecordCreateRequest((e) => {
  const a = e.auth;
  if (!a) throw new UnauthorizedError("Entre no sistema para continuar.");
  const r = e.record;
  if (!a.isSuperuser()) {
    const lib = require(`${__hooks}/uso-material-lib.js`);
    let obra = null;
    try { obra = e.app.findRecordById("obras", r.get("obra_id")); } catch (_) {}
    if (!obra || obra.get("company_id") !== a.get("company_id")) throw new BadRequestError("Obra inválida.");
    let minhaObra = "";
    try { minhaObra = a.get("funcionario_id") ? e.app.findRecordById("funcionarios", a.get("funcionario_id")).get("obraId") : ""; } catch (_) {}
    if (minhaObra !== obra.id && !lib.ehGestao(a)) {
      throw new ForbiddenError("Você só pode escrever no mural da obra em que trabalha.");
    }
    r.set("company_id", a.get("company_id"));
    r.set("autor_id", a.id);
  }
  r.set("texto", String(r.get("texto") || "").trim());
  if (!r.get("tipo")) r.set("tipo", "Recado");
  // Sem texto, só passa se vier foto (as fotos enviadas já estão no registro).
  if (!r.get("texto") && !(r.get("fotos") || []).length) throw new BadRequestError("Escreva o recado ou mande uma foto.");
  e.next();
}, "obra_mensagens");

// Avisa no sininho quem está na obra (menos quem escreveu).
onRecordAfterCreateSuccess((e) => {
  e.next();
  try {
    const lib = require(`${__hooks}/uso-material-lib.js`);
    const r = e.record;
    const obra = e.app.findRecordById("obras", r.get("obra_id"));
    let autor = "Alguém";
    try { const u = e.app.findRecordById("users", r.get("autor_id")); autor = u.get("name") || u.get("username") || autor; } catch (_) {}
    const equipe = e.app.findRecordsByFilter("users",
      "company_id = {:c} && funcionario_id.obraId = {:o} && id != {:a} && status = 'Ativo'", "", 200, 0,
      { c: r.get("company_id"), o: obra.id, a: r.get("autor_id") || "" });
    const resumo = String(r.get("texto") || "foto").slice(0, 80);
    equipe.forEach((u) => lib.notificar(e.app, u.id, `${obra.get("nome")}: ${autor} — ${resumo}`, `obra:${obra.id}`, "projeto"));
  } catch (err) {
    console.log("[obra-mural] Aviso do recado não enviado:", err);
  }
}, "obra_mensagens");
