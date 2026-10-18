/// <reference path="../pb_data/types.d.ts" />

// Configura o SMTP do Brevo a partir de variáveis de ambiente (painel da
// Hostinger > Node.js > Variáveis de ambiente), em vez de deixar a chave
// escrita no código. O repositório no GitHub é público: qualquer chave
// commitada fica exposta para quem baixar o .zip.
//
// Roda a cada inicialização, então a configuração volta sozinha mesmo se o
// pb_data (hoje em pasta temporária) for apagado e recriado.
//
//   BREVO_SMTP_LOGIN  -> login SMTP do Brevo (ex: xxxxxx@smtp-brevo.com)
//   BREVO_SMTP_KEY    -> chave SMTP do Brevo (xsmtpsib-...)
//   SMTP_SENDER_EMAIL -> opcional, padrão dnmltda@hotmail.com
onBootstrap((e) => {
  e.next();

  const login = String($os.getenv("BREVO_SMTP_LOGIN") || "").trim();
  const key = String($os.getenv("BREVO_SMTP_KEY") || "").trim();

  if (!login || !key) {
    console.log("[smtp-from-env] BREVO_SMTP_LOGIN/BREVO_SMTP_KEY não definidas - envio de e-mail desligado.");
    return;
  }

  try {
    const settings = e.app.settings();

    settings.smtp.enabled = true;
    settings.smtp.host = "smtp-relay.brevo.com";
    settings.smtp.port = 587;
    settings.smtp.username = login;
    settings.smtp.password = key;
    // Porta 587 usa STARTTLS; "tls: true" forçaria TLS implícito e quebraria.
    settings.smtp.tls = false;
    settings.smtp.authMethod = "PLAIN";

    settings.meta.senderName = "DNM&LTDA";
    settings.meta.senderAddress = String($os.getenv("SMTP_SENDER_EMAIL") || "dnmltda@hotmail.com").trim();

    e.app.save(settings);
    console.log("[smtp-from-env] SMTP do Brevo configurado a partir das variáveis de ambiente.");
  } catch (err) {
    console.log("[smtp-from-env] Erro ao configurar SMTP:", err);
  }
});
