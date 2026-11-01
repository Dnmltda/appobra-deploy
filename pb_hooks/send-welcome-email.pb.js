/// <reference path="../pb_data/types.d.ts" />
// E-mail para quem acabou de ganhar acesso.
//  - Convite (ver activate-invite.pb.js): o funcionário foi criado SEM senha
//    utilizável e cria a própria senha pelo botão do e-mail.
//  - Sem convite: boas-vindas com o botão para abrir o app.
// Padrão visual e endereço das telas: email-lib.js. (Antes os links iam
// fixos para o endereço antigo da Hostinger, que não funciona mais.)
//
// Texto sóbrio, com versão "text" junto do "html": e-mail só-HTML com cara
// de propaganda tende a cair em Promoções/Spam.
onRecordAfterCreateSuccess((e) => {
  const lib = require(`${__hooks}/email-lib.js`);
  const email = e.record.get("email");
  const username = e.record.get("username");
  const idUnico = e.record.get("id_unico");
  const inviteToken = e.record.get("password_reset_token");

  if (!email) {
    e.next();
    return;
  }

  // Convite: mesma função do "Reenviar convite"; se não sair, avisa no sino
  // de quem convidou (created_by, gravado pelo servidor).
  if (inviteToken) {
    const motivo = lib.enviarConvite($app, e.record);
    if (motivo) lib.avisarFalhaConvite($app, e.record, e.record.get("created_by"), motivo);
    e.next();
    return;
  }

  try {
    const base = lib.enderecoApp();
    let subject, text, html;

    if (inviteToken) {
      ({ subject, text, html } = lib.mensagemConvite(username, idUnico, `${base}/ativar-conta?token=${inviteToken}`));
    } else {
      const link = `${base}/login`;
      subject = "Bem-vindo ao APP OBRA - DNM&LTDA OBRAS";
      text =
`Olá,

Sua conta no APP OBRA foi criada.
Usuário: ${username}${idUnico ? `\nSeu ID: ${idUnico}` : ""}
E-mail: ${email}

Entre com seu e-mail e a senha que o administrador passou para você, e troque a senha no primeiro acesso:
${link}

Atenciosamente,
Equipe DNM&LTDA OBRAS`;
      html = lib.corpo(
        "Bem-vindo ao APP OBRA",
        '<p style="margin:0 0 12px">Olá,</p>' +
          '<p style="margin:0 0 12px">Sua conta no APP OBRA foi criada.</p>' +
          `<p style="margin:0 0 16px">Usuário: <strong>${lib.esc(username)}</strong>` +
          (idUnico ? `<br>Seu ID: <strong>${lib.esc(idUnico)}</strong>` : "") +
          `<br>E-mail: <strong>${lib.esc(email)}</strong></p>` +
          '<p style="margin:0 0 8px">Entre com seu e-mail e a senha que o administrador passou para você. No primeiro acesso, troque a senha no seu perfil.</p>',
        "Entrar no APP OBRA",
        link,
        "Se tiver dúvidas, fale com o administrador da sua empresa."
      );
    }

    $app.newMailClient().send(new MailerMessage({
      from: { address: $app.settings().meta.senderAddress, name: lib.REMETENTE },
      to: [{ address: email }],
      subject,
      text,
      html,
    }));
  } catch (err) {
    console.log("Erro ao enviar email de boas-vindas:", err);
  }

  e.next();
}, "users");
