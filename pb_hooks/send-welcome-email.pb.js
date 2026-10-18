/// <reference path="../pb_data/types.d.ts" />
onRecordAfterCreateSuccess((e) => {
  const email = e.record.get("email");
  const username = e.record.get("username");
  const idUnico = e.record.get("id_unico");
  const inviteToken = e.record.get("password_reset_token");

  // Only send if email exists
  if (!email) {
    e.next();
    return;
  }

  try {
    // Fluxo de convite (ver activate-invite.pb.js): o funcionário foi
    // criado SEM senha utilizável — o próprio funcionário confirma os
    // dados e cria a senha pelo link. Distinto do welcome email antigo,
    // que assumia que o admin já tinha definido e informado uma senha.
    if (inviteToken) {
      // Domínio do frontend estático (Hostinger). O domínio antigo
      // "tan-newt-348528" não é mais o site em produção desde a migração
      // de arquitetura de outubro/2026 (ver pocketbaseClient.js) — o mesmo
      // domínio errado também estava no email de boas-vindas abaixo e em
      // send-password-reset.pb.js, corrigido junto.
      const inviteLink = `https://midnightblue-chamois-688707.hostingersite.com/ativar-conta?token=${inviteToken}`;
      // Visual mais sóbrio/"transacional" (texto simples, sem botão
      // dourado estilo propaganda) e um "text" (texto puro) junto do
      // "html" — e-mails só-HTML e com cara de peça de marketing tendem
      // a cair em Promoções/Social no Gmail em vez da Caixa de entrada.
      // Isso ajuda, mas o fator decisivo é o domínio de envio: sem um
      // domínio próprio autenticado (DKIM/SPF) no Brevo, o Gmail sempre
      // vai tratar o remetente com mais desconfiança.
      const inviteTextBody =
`Bem-vindo a DNM&LTDA OBRAS

Um acesso foi criado para voce no sistema.
Usuario: ${username}

Proximos passos:
1. Abra o link abaixo para confirmar seus dados
2. Crie sua propria senha de acesso
3. Entre no sistema com seu email e a senha criada

${inviteLink}

Este link expira em 7 dias.

Se tiver duvidas, entre em contato com o administrador do sistema.

Atenciosamente,
Equipe DNM&LTDA OBRAS`;

      const message = new MailerMessage({
        from: {
          address: $app.settings().meta.senderAddress,
          name: "DNM&LTDA OBRAS"
        },
        to: [{ address: email }],
        subject: "Confirmação de cadastro - DNM&LTDA OBRAS",
        text: inviteTextBody,
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; color: #222222; max-width: 520px; margin: 0 auto;">
            <p style="font-size: 16px; margin: 0 0 16px;">Bem-vindo à DNM&amp;LTDA OBRAS</p>
            <p style="margin: 0 0 12px;">Um acesso foi criado para você no sistema.</p>
            <p style="margin: 0 0 16px;">Usuário: <strong>${username}</strong></p>
            <p style="margin: 0 0 8px;">Próximos passos:</p>
            <ol style="margin: 0 0 20px; padding-left: 20px;">
              <li>Abra o link abaixo para confirmar seus dados</li>
              <li>Crie sua própria senha de acesso</li>
              <li>Entre no sistema com seu email e a senha criada</li>
            </ol>
            <p style="margin: 0 0 20px;">
              <a href="${inviteLink}" style="color: #1a3a52; text-decoration: underline;">Confirmar dados e criar senha</a>
            </p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #555555;">Ou copie e cole este link no seu navegador:</p>
            <p style="margin: 0 0 20px; font-size: 13px; word-break: break-all;">${inviteLink}</p>
            <p style="margin: 0 0 20px; font-size: 13px; color: #555555;">Este link expira em 7 dias.</p>
            <p style="margin: 0 0 20px; font-size: 13px; color: #555555;">Se tiver dúvidas, entre em contato com o administrador do sistema.</p>
            <p style="margin: 0; font-size: 13px; color: #555555;">Atenciosamente,<br>Equipe DNM&amp;LTDA OBRAS</p>
          </div>
        `
      });

      $app.newMailClient().send(message);
      e.next();
      return;
    }

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
