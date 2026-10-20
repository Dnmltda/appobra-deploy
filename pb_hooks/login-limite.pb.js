/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Limite de tentativas no login por e-mail (rota nativa do PocketBase).
// A regra e os números estão em login-limite-lib.js; as abas "ID" e
// "Usuário" usam a mesma regra em login-e-senha.pb.js.
// (Pendente da auditoria: o limite que existia só na tela nunca funcionou e
// foi removido na Etapa 3; até aqui dava para tentar senhas sem parar.)
// ============================================================

onRecordAuthWithPasswordRequest((e) => {
  const lim = require(`${__hooks}/login-limite-lib.js`);
  const u = e.record; // nulo quando o e-mail/usuário não existe
  lim.conferir(u);
  try {
    e.next();
  } catch (err) {
    lim.errou(e.app, u);
    throw err;
  }
  lim.acertou(e.app, u);
}, "users");
