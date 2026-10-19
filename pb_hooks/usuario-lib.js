// Nome de usuário escolhido pela própria pessoa (convite e perfil). Usado por
// login-e-senha.pb.js e activate-invite.pb.js. Módulo à parte porque cada
// handler do JSVM roda isolado.

// Minúsculo, sem espaços nas pontas. O login pela aba "Usuário" também
// compara em minúsculo, então "Diego" e "diego" são o mesmo usuário.
function normaliza(s) {
  return String(s == null ? "" : s).trim().toLowerCase();
}

// Confere formato e se outra conta já usa o nome. Lança BadRequestError com
// a mensagem para a tela.
function confere(app, username, idDoProprio) {
  if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) {
    throw new BadRequestError(
      "Nome de usuário inválido: use de 3 a 40 letras sem acento, números, ponto, hífen ou sublinhado, sem espaços."
    );
  }
  let iguais = [];
  try {
    // "~" no SQLite não diferencia maiúscula; a comparação exata vem depois.
    iguais = app.findRecordsByFilter("users", "username ~ {:u}", "", 20, 0, { u: username });
  } catch (_) {}
  for (let i = 0; i < iguais.length; i++) {
    if (iguais[i].id !== idDoProprio && normaliza(iguais[i].get("username")) === username) {
      throw new BadRequestError("Este nome de usuário já está em uso. Escolha outro.");
    }
  }
}

module.exports = { normaliza, confere };
