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
// do Fly); sem ela, o próprio servidor do Fly (ver email-lib.js). O e-mail
// mostra um botão com a frase "Criar nova senha", não o endereço comprido.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    const lib = require(`${__hooks}/email-lib.js`);
    const settings = app.settings();
    const base = lib.enderecoApp();
    if (settings.meta.appURL !== base) {
      settings.meta.appURL = base;
      app.save(settings);
    }

    const users = app.findCollectionByNameOrId("users");
    users.passwordAuth.identityFields = ["email", "username"];
    // Datas das últimas trocas de senha (senha-limite-lib.js).
    if (!users.fields.getByName("trocas_senha")) {
      users.fields.add(new TextField({ name: "trocas_senha", hidden: true }));
    }
    users.resetPasswordTemplate.subject = "Criar nova senha - DNM&LTDA OBRAS";
    users.resetPasswordTemplate.body = lib.corpo(
      "Criar nova senha",
      '<p style="margin:0 0 12px">Olá,</p>' +
        '<p style="margin:0 0 8px">Recebemos um pedido para criar uma nova senha de acesso ao APP OBRA.</p>',
      "Criar nova senha",
      "{APP_URL}/reset-password?token={TOKEN}",
      "O botão vale por pouco tempo e só uma vez. Se você não pediu, ignore este e-mail: sua senha continua a mesma."
    );
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
      const limite = require(`${__hooks}/senha-limite-lib.js`);
      const conviteToken = String(u.get("password_reset_token") || "");
      if (!limite.podeTrocar(u)) {
        // Já pediu o limite da semana: não manda nada. A resposta continua a
        // mesma (não revela se a conta existe); o administrador ainda pode
        // trocar a senha pela Gestão de Acessos.
        console.log("[login-e-senha] Limite de trocas de senha atingido:", u.id);
      } else if (u.get("status") === "Inativo" && conviteToken && u.get("email")) {
        // Convite ainda não aceito: trocar a senha não ativa a conta (quem
        // ativa é o "Criar minha senha" do convite) e a pessoa ficava presa em
        // "Conta inativa". Manda o convite de novo, com link novo de 7 dias.
        try {
          const lib = require(`${__hooks}/email-lib.js`);
          const token = $security.randomString(40);
          u.set("password_reset_token", token);
          u.set("password_reset_expires", new Date(Date.now() + 7 * 86400000).toISOString().replace("T", " "));
          limite.registrar(u);
          $app.save(u);
          const m = lib.mensagemConvite(u.get("username"), u.get("id_unico"), `${lib.enderecoApp()}/ativar-conta?token=${token}`);
          $app.newMailClient().send(new MailerMessage({
            from: { address: $app.settings().meta.senderAddress, name: lib.REMETENTE },
            to: [{ address: u.get("email") }],
            subject: m.subject,
            text: m.text,
            html: m.html,
          }));
        } catch (err) {
          console.log("[login-e-senha] Erro ao reenviar convite:", err);
        }
      } else if (u.get("status") !== "Bloqueado" && u.get("email")) {
        try {
          limite.registrar(u);
          $app.save(u);
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

// Troca de senha pelo perfil (a própria pessoa): no máximo 2 por semana,
// somando com o "Esqueci minha senha" (senha-limite-lib.js). O administrador
// trocando a senha de outra pessoa não conta.
onRecordUpdateRequest((e) => {
  const body = e.requestInfo().body || {};
  if (body.password && e.auth && !e.auth.isSuperuser() && e.auth.id === e.record.id) {
    const limite = require(`${__hooks}/senha-limite-lib.js`);
    if (!limite.podeTrocar(e.record)) {
      throw new BadRequestError(
        `Você já trocou a senha ${limite.LIMITE} vezes nos últimos ${limite.JANELA_DIAS} dias. ` +
        `Tente de novo a partir de ${limite.liberaEm(e.record)} ou fale com o administrador.`
      );
    }
    limite.registrar(e.record);
  }
  e.next();
}, "users");

routerAdd("POST", "/api/custom/login-id", (e) => {
  const data = new DynamicModel({ id_unico: "", password: "" });
  e.bindBody(data);
  const id = String(data.id_unico || "").trim();
  const senha = String(data.password || "");
  if (!id || !senha) throw new BadRequestError("Informe o ID e a senha.");

  // "1", "01" e "001" são o mesmo ID (o número é guardado com 2 dígitos).
  const n = /^\d+$/.test(id) ? String(parseInt(id, 10)) : id;
  let candidatos = [];
  try {
    candidatos = $app.findRecordsByFilter(
      "users", "id_unico = {:a} || id_unico = {:b} || id_unico = {:c}", "", 50, 0,
      { a: id, b: n, c: n.padStart(2, "0") }
    );
  } catch (_) {}
  // Limite de tentativas (login-limite-lib.js): conta travada não entra.
  const lim = require(`${__hooks}/login-limite-lib.js`);
  if (candidatos.length === 1) lim.conferir(candidatos[0]);
  // ID repetido em várias empresas: trava de tentativas pelo próprio ID (A7).
  if (candidatos.length > 1) lim.idConferir($app, n.padStart(2, "0"));
  const certos = [];
  for (let i = 0; i < candidatos.length; i++) {
    if (candidatos[i].validatePassword(senha)) certos.push(candidatos[i]);
  }
  if (!certos.length) {
    // Só conta a tentativa quando o ID aponta para uma pessoa só.
    if (candidatos.length === 1) lim.errou($app, candidatos[0]);
    if (candidatos.length > 1) lim.idErrou($app, n.padStart(2, "0"));
    throw new BadRequestError("ID ou senha incorretos.");
  }
  // Mesmo ID e mesma senha em empresas diferentes: não adivinha qual é.
  if (certos.length > 1) {
    throw new BadRequestError("Este ID existe em mais de uma empresa. Entre com o e-mail ou o usuário.");
  }
  const certo = certos[0];
  lim.conferir(certo);
  lim.acertou($app, certo);
  if (candidatos.length > 1) lim.idAcertou($app, n.padStart(2, "0"));

  return $apis.recordAuthResponse(e, certo, "password", null);
});

// Login pela aba "Telefone" (Bloco 4, aprovado pelo Diego em 26/10/2026).
// Compara só os números: "(11) 98888-7777", "11988887777" e "+55 11 98888-7777"
// são o mesmo telefone. Mesmo telefone e senha em mais de um acesso: não
// adivinha quem é e pede o ID ou o e-mail.
routerAdd("POST", "/api/custom/login-telefone", (e) => {
  const data = new DynamicModel({ telefone: "", password: "" });
  e.bindBody(data);
  let n = String(data.telefone || "").replace(/\D/g, "");
  if (n.length >= 12 && n.startsWith("55")) n = n.slice(2);
  const senha = String(data.password || "");
  if (n.length < 10 || !senha) throw new BadRequestError("Informe o telefone com DDD e a senha.");
  const limpo = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(telefone,' ',''),'(',''),')',''),'-',''),'+',''),'.','')";
  const ids = arrayOf(new DynamicModel({ id: "" }));
  try {
    $app.db().newQuery(`SELECT id FROM users WHERE ${limpo} = {:n} OR ${limpo} = {:c} LIMIT 20`).bind({ n, c: "55" + n }).all(ids);
  } catch (_) {}
  const candidatos = ids.map((r) => $app.findRecordById("users", r.id));
  const lim = require(`${__hooks}/login-limite-lib.js`);
  if (candidatos.length === 1) lim.conferir(candidatos[0]);
  const certos = candidatos.filter((u) => u.validatePassword(senha));
  if (!certos.length) {
    if (candidatos.length === 1) lim.errou($app, candidatos[0]);
    throw new BadRequestError("Telefone ou senha incorretos.");
  }
  if (certos.length > 1) {
    throw new BadRequestError("Este telefone está em mais de um acesso. Entre com o ID, o e-mail ou o usuário.");
  }
  lim.conferir(certos[0]);
  lim.acertou($app, certos[0]);
  return $apis.recordAuthResponse(e, certos[0], "password", null);
});

// Login pela aba "Usuário". Não diferencia maiúscula de minúscula: contas
// antigas foram gravadas com maiúscula ("Diego") e a tela manda minúsculo,
// então o login nativo do PocketBase (comparação exata) não as achava.
routerAdd("POST", "/api/custom/login-usuario", (e) => {
  const data = new DynamicModel({ username: "", password: "" });
  e.bindBody(data);
  const lib = require(`${__hooks}/usuario-lib.js`);
  const username = lib.normaliza(data.username);
  const senha = String(data.password || "");
  if (!username || !senha) throw new BadRequestError("Informe o usuário e a senha.");

  let candidatos = [];
  try {
    candidatos = $app.findRecordsByFilter("users", "username ~ {:u}", "", 20, 0, { u: username });
  } catch (_) {}
  const lim = require(`${__hooks}/login-limite-lib.js`);
  const mesmos = candidatos.filter((u) => lib.normaliza(u.get("username")) === username);
  for (let i = 0; i < mesmos.length; i++) {
    const u = mesmos[i];
    lim.conferir(u);
    if (u.validatePassword(senha)) {
      lim.acertou($app, u);
      return $apis.recordAuthResponse(e, u, "password", null);
    }
  }
  if (mesmos.length === 1) lim.errou($app, mesmos[0]);
  throw new BadRequestError("Usuário ou senha incorretos.");
});

// Nome de usuário: sempre minúsculo, formato válido e sem repetir (sem
// diferenciar maiúscula). Só confere quando o nome muda, para contas antigas
// salvarem outros dados sem tropeçar no nome gravado antes desta regra.
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/usuario-lib.js`);
  const u = lib.normaliza(e.record.get("username"));
  e.record.set("username", u);
  lib.confere($app, u, "");
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/usuario-lib.js`);
  const antes = String(e.record.original().get("username") || "");
  const agora = String(e.record.get("username") || "");
  if (agora !== antes) {
    const u = lib.normaliza(agora);
    e.record.set("username", u);
    if (u !== lib.normaliza(antes)) lib.confere($app, u, e.record.id);
  }
  e.next();
}, "users");
