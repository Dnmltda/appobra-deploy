/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Login por e-mail, usuário ou ID e "Esqueci minha senha" feitos no
// SERVIDOR (Etapa 3 da auditoria).
//
// Antes, as telas procuravam o usuário na lista ANTES de fazer login. Um
// visitante nunca pôde ler essa lista, então:
//  - login pelas abas "ID" e "Usuário" respondia "Usuário não encontrado";
//  - "Esqueci minha senha" não achava ninguém e nenhum e-mail saía (o token
//    era gerado no navegador e gravado direto no cadastro).
//
// Agora:
//  - "Usuário" usa o login nativo do PocketBase (identityFields).
//  - "ID" passa por /api/custom/login-id: o ID curto (01, 02...) é por
//    empresa, então o servidor testa a senha em cada usuário com aquele ID.
//  - "Esqueci minha senha" passa por /api/custom/esqueci-senha, que usa o
//    envio nativo do PocketBase (token seguro, expira) com o e-mail em
//    português abaixo. A resposta é sempre a mesma, exista ou não a conta.
//
// O link do e-mail usa o endereço das telas: variável FRONT_URL (Secrets
// do Fly). Sem ela, fica o appURL já configurado.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    const settings = app.settings();
    const front = String($os.getenv("FRONT_URL") || "").trim().replace(/\/+$/, "");
    if (front && settings.meta.appURL !== front) {
      settings.meta.appURL = front;
      app.save(settings);
    }

    const users = app.findCollectionByNameOrId("users");
    users.passwordAuth.identityFields = ["email", "username"];
    users.resetPasswordTemplate.subject = "Redefinir sua senha - {APP_NAME}";
    users.resetPasswordTemplate.body =
      "<p>Olá,</p>" +
      "<p>Recebemos um pedido para criar uma nova senha de acesso ao {APP_NAME}.</p>" +
      '<p><a href="{APP_URL}/reset-password?token={TOKEN}">Clique aqui para criar a nova senha</a></p>' +
      "<p>Se o botão não abrir, copie este endereço no navegador:<br>{APP_URL}/reset-password?token={TOKEN}</p>" +
      "<p>O link vale por pouco tempo. Se você não pediu, ignore este e-mail: sua senha continua a mesma.</p>";
    app.save(users);
  } catch (err) {
    console.log("[login-e-senha] Erro ao configurar login/recuperação:", err);
  }
});

routerAdd("POST", "/api/custom/esqueci-senha", (e) => {
  const data = new DynamicModel({ identificador: "" });
  e.bindBody(data);
  const ident = String(data.identificador || "").trim();

  if (ident) {
    let users = [];
    try {
      users = $app.findRecordsByFilter(
        "users",
        "email = {:i} || username = {:u} || id_unico = {:i}",
        "", 2, 0,
        { i: ident.toLowerCase().includes("@") ? ident.toLowerCase() : ident, u: ident.toLowerCase() }
      );
    } catch (_) {}
    // ID curto repetido em empresas diferentes: não dá para saber quem é.
    if (users.length === 1) {
      const u = users[0];
      if (u.get("status") !== "Bloqueado" && u.get("email")) {
        try {
          $mails.sendRecordPasswordReset($app, u);
        } catch (err) {
          console.log("[login-e-senha] Erro ao enviar e-mail de recuperação:", err);
        }
      }
    }
  }
  // Mesma resposta sempre: não revela se a conta existe.
  return e.json(200, { success: true });
});

routerAdd("POST", "/api/custom/login-id", (e) => {
  const data = new DynamicModel({ id_unico: "", password: "" });
  e.bindBody(data);
  const id = String(data.id_unico || "").trim();
  const senha = String(data.password || "");
  if (!id || !senha) throw new BadRequestError("Informe o ID e a senha.");

  let candidatos = [];
  try {
    candidatos = $app.findRecordsByFilter("users", "id_unico = {:id}", "", 50, 0, { id });
  } catch (_) {}
  const certos = [];
  for (let i = 0; i < candidatos.length; i++) {
    if (candidatos[i].validatePassword(senha)) certos.push(candidatos[i]);
  }
  if (!certos.length) throw new BadRequestError("ID ou senha incorretos.");
  // Mesmo ID e mesma senha em empresas diferentes: não adivinha qual é.
  if (certos.length > 1) {
    throw new BadRequestError("Este ID existe em mais de uma empresa. Entre com o e-mail ou o usuário.");
  }
  const certo = certos[0];

  return $apis.recordAuthResponse(e, certo, "password", null);
});
