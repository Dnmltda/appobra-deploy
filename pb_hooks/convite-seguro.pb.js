/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Convite gerado no servidor (auditoria de 24/10/2026, item D9, aprovado pelo
// Diego em 25/10/2026). Antes o código do convite e a senha descartável eram
// feitos no navegador (a senha com Math.random, que não é seguro).
// Agora, ao criar um acesso com convite, o servidor troca o código por um
// aleatório seguro com validade de 7 dias e põe uma senha descartável que
// ninguém vê (a pessoa cria a dela pelo link do e-mail, activate-invite.pb.js).
// O e-mail sai com o código do servidor (send-welcome-email.pb.js).
// ============================================================

onRecordCreateRequest((e) => {
  const a = e.auth;
  if (!(a && a.isSuperuser()) && String(e.record.get("password_reset_token") || "")) {
    e.record.set("password_reset_token", $security.randomString(40));
    e.record.set("password_reset_expires", new Date(Date.now() + 7 * 86400000).toISOString().replace("T", " "));
    e.record.setPassword($security.randomString(40));
  }
  e.next();
}, "users");

// Reenvio/edição pela API: código novo sempre vem do servidor e o e-mail sai
// junto (antes só trocava o código, sem mandar nada). Só pedidos da API: o
// "Reenviar convite" e o "Esqueci minha senha" mandam o e-mail eles mesmos.
onRecordUpdateRequest((e) => {
  const a = e.auth;
  let trocou = false;
  if (!(a && a.isSuperuser())) {
    const novo = String(e.record.get("password_reset_token") || "");
    const antes = String(e.record.original().get("password_reset_token") || "");
    if (novo && novo !== antes) {
      e.record.set("password_reset_token", $security.randomString(40));
      e.record.set("password_reset_expires", new Date(Date.now() + 7 * 86400000).toISOString().replace("T", " "));
      trocou = true;
    }
  }
  e.next();
  if (trocou && e.record.get("status") === "Inativo") {
    const lib = require(`${__hooks}/email-lib.js`);
    const motivo = lib.enviarConvite($app, e.record);
    if (motivo) lib.avisarFalhaConvite($app, e.record, a ? a.id : "", motivo);
  }
}, "users");

// ============================================================
// "Reenviar convite" (01/11/2026). Antes não havia como reenviar pela Gestão
// de Acessos, e trocar o código pela API (acima) não mandava e-mail. Agora:
//   POST /api/custom/reenviar-convite { user_id }
// Quem pode: Administrador, RH e Mestre de Obras da mesma empresa (os mesmos
// que criam acessos pela tela Funcionários) e o titular. Só para convite não
// aceito (acesso "Inativo" que nunca entrou). Gera código novo de 7 dias e
// manda o e-mail; responde se saiu ou por que não saiu (limite da semana ou
// erro do servidor de e-mail) — antes a falha ficava escondida.
// ============================================================
routerAdd("POST", "/api/custom/reenviar-convite", (e) => {
  const a = e.auth;
  const d = new DynamicModel({ user_id: "" });
  e.bindBody(d);
  const cargo = a.get("cargo") || a.get("role");
  const dono = a.get("dono_sistema") === true;
  const pode = dono || ["Administrador", "admin", "RH", "Mestre de Obras"].includes(cargo);
  if (!pode) throw new ForbiddenError("Seu cargo não envia convites.");
  let u;
  try { u = $app.findRecordById("users", String(d.user_id || "")); } catch (_) { throw new NotFoundError("Acesso não encontrado."); }
  if (!dono && u.get("company_id") !== a.get("company_id")) throw new NotFoundError("Acesso não encontrado.");
  if (u.get("dono_sistema") === true) throw new ForbiddenError("A conta do titular não recebe convite.");
  const email = String(u.get("email") || "");
  if (!email || /@arquivado\.invalid$/.test(email)) throw new BadRequestError("Este acesso não tem e-mail válido. Corrija o e-mail no cadastro.");
  // (data vazia vem como objeto: confere pelo texto)
  if (u.get("status") !== "Inativo" || String(u.get("last_login") || "").trim()) {
    throw new BadRequestError("Esta pessoa já criou a senha. Se esqueceu, use \"Esqueci minha senha\" na tela de entrada.");
  }
  const limite = require(`${__hooks}/senha-limite-lib.js`);
  if (!limite.podeTrocar(u)) {
    throw new BadRequestError(`Já foram enviados 2 convites para este acesso nos últimos 7 dias. O próximo libera em ${limite.liberaEm(u)}.`);
  }
  u.set("password_reset_token", $security.randomString(40));
  u.set("password_reset_expires", new Date(Date.now() + 7 * 86400000).toISOString().replace("T", " "));
  limite.registrar(u);
  $app.save(u);
  const motivo = require(`${__hooks}/email-lib.js`).enviarConvite($app, u);
  if (motivo) {
    throw new BadRequestError(`O servidor de e-mail não enviou o convite (${motivo}). Tente de novo mais tarde ou confira o e-mail cadastrado.`);
  }
  console.log(`[convite] reenviado para ${email} por ${a.id}.`);
  return e.json(200, { enviado: true, email });
}, $apis.requireAuth("users"));
