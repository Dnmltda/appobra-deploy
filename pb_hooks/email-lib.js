// Padrão único dos e-mails do APP OBRA (convite, boas-vindas, senha).
// Carregado com require() dentro de cada handler.
//
// - Quem recebe vê o NOME "DNM&LTDA OBRAS" como remetente e um BOTÃO com
//   uma frase ("Criar minha senha"), sem o endereço comprido do link.
// - O endereço das telas vem de FRONT_URL (Secrets do Fly). Sem ela, usa o
//   servidor do Fly, que também serve as telas. O endereço antigo da
//   Hostinger (midnightblue-chamois...) não funciona mais e é ignorado.

const REMETENTE = "DNM&LTDA OBRAS";
const PADRAO = "https://appobra-backend.fly.dev";

function enderecoApp() {
  const front = String($os.getenv("FRONT_URL") || "").trim().replace(/\/+$/, "");
  if (front) return front;
  let atual = "";
  try { atual = String($app.settings().meta.appURL || "").trim().replace(/\/+$/, ""); } catch (_) {}
  if (/^https:\/\//.test(atual) && !/hostingersite\.com|localhost|127\.0\.0\.1/.test(atual)) return atual;
  return PADRAO;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Botão que funciona no Gmail, Outlook e celular (tabela + link).
function botao(frase, link) {
  return '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr>' +
    '<td style="background:#1a3a52;border-radius:6px">' +
    `<a href="${link}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:bold;text-decoration:none;font-family:Arial,Helvetica,sans-serif">${frase}</a>` +
    "</td></tr></table>";
}

// Moldura comum. "paragrafos" já vem em HTML.
function corpo(titulo, paragrafos, frase, link, rodape) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#222222;max-width:520px;margin:0 auto;font-size:15px;line-height:1.5">' +
    `<p style="font-size:18px;font-weight:bold;margin:0 0 16px">${titulo}</p>` +
    paragrafos +
    (link ? botao(frase, link) : "") +
    (rodape ? `<p style="margin:0 0 16px;font-size:13px;color:#555555">${rodape}</p>` : "") +
    '<p style="margin:0;font-size:13px;color:#555555">Atenciosamente,<br>Equipe DNM&amp;LTDA OBRAS</p>' +
    "</div>";
}

// Convite de acesso (send-welcome-email.pb.js e "Esqueci minha senha" de quem
// ainda não aceitou o convite, em login-e-senha.pb.js).
function mensagemConvite(username, idUnico, link) {
  return {
    subject: "Seu acesso ao APP OBRA - DNM&LTDA OBRAS",
    text:
`Olá,

Um acesso ao APP OBRA foi criado para você.
Usuário: ${username} (você pode trocar ao criar a senha)${idUnico ? `\nSeu ID: ${idUnico}` : ""}

Para começar, abra o endereço abaixo, confira seus dados e crie a sua senha:
${link}

O convite vale por 7 dias. Se tiver dúvidas, fale com o administrador da sua empresa.

Atenciosamente,
Equipe DNM&LTDA OBRAS`,
    html: corpo(
      "Seu acesso ao APP OBRA",
      '<p style="margin:0 0 12px">Olá,</p>' +
        '<p style="margin:0 0 12px">Um acesso ao APP OBRA foi criado para você.</p>' +
        `<p style="margin:0 0 16px">Usuário: <strong>${esc(username)}</strong> (você pode trocar ao criar a senha)` +
        (idUnico ? `<br>Seu ID: <strong>${esc(idUnico)}</strong>` : "") + "</p>" +
        '<p style="margin:0 0 8px">Toque no botão para conferir seus dados e criar a sua senha:</p>',
      "Criar minha senha",
      link,
      "O convite vale por 7 dias. Se tiver dúvidas, fale com o administrador da sua empresa."
    ),
  };
}

// Manda o e-mail de convite ("Criar minha senha") com o código atual do
// acesso. Devolve "" se saiu, ou o motivo da falha (para avisar quem convidou:
// antes uma falha no envio ficava só no registro do servidor e a tela dizia
// "convite enviado").
function enviarConvite(app, u) {
  const token = String(u.get("password_reset_token") || "");
  const email = String(u.get("email") || "");
  if (!token || !email) return "acesso sem convite pendente ou sem e-mail";
  try {
    const m = mensagemConvite(u.get("username"), u.get("id_unico"), `${enderecoApp()}/ativar-conta?token=${token}`);
    app.newMailClient().send(new MailerMessage({
      from: { address: app.settings().meta.senderAddress, name: REMETENTE },
      to: [{ address: email }],
      subject: m.subject,
      text: m.text,
      html: m.html,
    }));
    return "";
  } catch (err) {
    console.log("[convite] Erro ao enviar o convite para", email, ":", err);
    return String(err && err.message ? err.message : err).slice(0, 200);
  }
}

// Sino de quem convidou quando o e-mail de convite não saiu.
function avisarFalhaConvite(app, u, quemId, motivo) {
  try {
    require(`${__hooks}/avisos-lib.js`).notificar(app, quemId,
      `O e-mail de convite para ${u.get("email")} não saiu (${motivo}). Abra o acesso em Gestão de Acessos e toque em "Reenviar convite".`,
      `/usuarios/${u.id}`, "acesso");
  } catch (_) {}
}

module.exports = { REMETENTE, enderecoApp, esc, botao, corpo, mensagemConvite, enviarConvite, avisarFalhaConvite };
