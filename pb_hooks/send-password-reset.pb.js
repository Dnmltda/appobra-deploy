/// <reference path="../pb_data/types.d.ts" />
// Recuperação antiga (campo password_reset_token). O "Esqueci minha senha"
// das telas usa o envio nativo (login-e-senha.pb.js); este continua para
// quem ainda grava o token direto. Padrão visual: email-lib.js.
onRecordUpdate((e) => {
  const resetToken = e.record.get("password_reset_token");
  const email = e.record.get("email");
  const username = e.record.get("username");

  // Só envia quando o token acabou de ser gravado
  const originalToken = e.record.original().get("password_reset_token");
  if (!resetToken || resetToken === originalToken || !email) {
    e.next();
    return;
  }

  try {
    const lib = require(`${__hooks}/email-lib.js`);
    const link = `${lib.enderecoApp()}/reset-password?token=${resetToken}`;
    $app.newMailClient().send(new MailerMessage({
      from: { address: $app.settings().meta.senderAddress, name: lib.REMETENTE },
      to: [{ address: email }],
      subject: "Criar nova senha - DNM&LTDA OBRAS",
      text:
`Olá,

Recebemos um pedido para criar uma nova senha para o usuário ${username}.
Abra o endereço abaixo para criar a nova senha (vale por 24 horas):
${link}

Se você não pediu, ignore este e-mail: sua senha continua a mesma.

Atenciosamente,
Equipe DNM&LTDA OBRAS`,
      html: lib.corpo(
        "Criar nova senha",
        '<p style="margin:0 0 12px">Olá,</p>' +
          `<p style="margin:0 0 8px">Recebemos um pedido para criar uma nova senha para o usuário <strong>${lib.esc(username)}</strong>.</p>`,
        "Criar nova senha",
        link,
        "O botão vale por 24 horas. Se você não pediu, ignore este e-mail: sua senha continua a mesma."
      ),
    }));
  } catch (err) {
    console.log("Erro ao enviar email de recuperação de senha:", err);
  }

  e.next();
}, "users");
