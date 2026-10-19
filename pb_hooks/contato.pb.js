/// <reference path="../pb_data/types.d.ts" />

// Formulário "Fale conosco" da tela de login. Antes ele só fingia enviar
// (esperava 0,8 s e mostrava "Mensagem enviada"). Agora manda um e-mail
// para a caixa principal (CONTATO_EMAIL, padrão dnmltda@hotmail.com) com
// "Responder para" o e-mail de quem escreveu.
routerAdd("POST", "/api/custom/contato", (e) => {
  const data = new DynamicModel({ name: "", email: "", message: "" });
  e.bindBody(data);
  const nome = String(data.name || "").trim().slice(0, 120);
  const email = String(data.email || "").trim().slice(0, 160);
  const msg = String(data.message || "").trim().slice(0, 4000);
  if (!nome || !msg || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new BadRequestError("Preencha nome, e-mail válido e mensagem.");
  }
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const destino = String($os.getenv("CONTATO_EMAIL") || "dnmltda@hotmail.com").trim();

  const message = new MailerMessage({
    from: { address: $app.settings().meta.senderAddress, name: "APP OBRA - Contato" },
    to: [{ address: destino }],
    headers: { "Reply-To": email },
    subject: `Contato pelo APP OBRA: ${nome}`,
    text: `Nome: ${nome}\nE-mail: ${email}\n\n${msg}`,
    html: `<p><strong>Nome:</strong> ${esc(nome)}<br><strong>E-mail:</strong> ${esc(email)}</p><p>${esc(msg).replace(/\n/g, "<br>")}</p>`,
  });
  try {
    $app.newMailClient().send(message);
  } catch (err) {
    console.log("[contato] Erro ao enviar:", err);
    throw new BadRequestError("Não foi possível enviar agora. Tente de novo ou escreva para " + destino + ".");
  }
  return e.json(200, { success: true });
});
