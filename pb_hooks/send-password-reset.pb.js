/// <reference path="../pb_data/types.d.ts" />
onRecordUpdate((e) => {
  const resetToken = e.record.get("password_reset_token");
  const resetExpires = e.record.get("password_reset_expires");
  const email = e.record.get("email");
  const username = e.record.get("username");
  
  // Only send if reset token was just set
  const originalToken = e.record.original().get("password_reset_token");
  if (!resetToken || resetToken === originalToken || !email) {
    e.next();
    return;
  }
  
  try {
    const resetLink = `https://midnightblue-chamois-688707.hostingersite.com/reset-password?token=${resetToken}`;
    
    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress,
        name: "DNM&LTDA OBRAS"
      },
      to: [{ address: email }],
      subject: "Recuperação de Senha - DNM&LTDA OBRAS",
      html: `
        <h2>Recuperação de Senha</h2>
        <p>Você solicitou a recuperação de sua senha.</p>
        <p><strong>Usuário:</strong> ${username}</p>
        <p><strong>Clique no link abaixo para redefinir sua senha:</strong></p>
        <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Redefinir Senha</a></p>
        <p>Ou copie e cole este link no seu navegador:</p>
        <p>${resetLink}</p>
        <p><strong>Importante:</strong> Este link expira em 24 horas.</p>
        <p>Se você não solicitou esta recuperação, ignore este email.</p>
        <p>Atenciosamente,<br>Equipe DNM&LTDA OBRAS</p>
      `
    });
    
    $app.newMailClient().send(message);
  } catch (err) {
    console.log("Erro ao enviar email de recuperação de senha:", err);
  }
  
  e.next();
}, "users");