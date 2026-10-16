/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  const email = e.record.get("email");
  const username = e.record.get("username");
  const idUnico = e.record.get("id_unico");

  // Only send if email exists
  if (!email) {
    e.next();
    return;
  }

  try {
    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: "DNM&LTDA OBRAS"
      },
      to: [{ address: email }],
      subject: "Bem-vindo à DNM&LTDA OBRAS",
      html: `
        <h2>Bem-vindo à DNM&LTDA OBRAS</h2>
        <p>Sua conta foi criada com sucesso!</p>
        <p><strong>Informações de Acesso:</strong></p>
        <ul>
          <li><strong>ID do Usuário:</strong> ${idUnico || e.record.id}</li>
          <li><strong>Usuário:</strong> ${username}</li>
          <li><strong>Email:</strong> ${email}</li>
        </ul>
        <p><strong>Próximos Passos:</strong></p>
        <ol>
          <li>Acesse o sistema em: <a href="https://midnightblue-chamois-688707.hostingersite.com/login">https://midnightblue-chamois-688707.hostingersite.com/login</a></li>
          <li>Use seu email e a senha fornecida pelo administrador</li>
          <li>Altere sua senha na primeira vez que fizer login</li>
        </ol>
        <p>Se tiver dúvidas, entre em contato com o administrador do sistema.</p>
        <p>Atenciosamente,<br>Equipe DNM&LTDA OBRAS</p>
      `
    });

    $app.newMailClient().send(message);
  } catch (err) {
    console.log("Erro ao enviar email de boas-vindas:", err);
  }

  e.next();
}, "users");
