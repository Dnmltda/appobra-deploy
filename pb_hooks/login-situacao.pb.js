/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Conta Inativa ou Bloqueada não entra (auditoria de 24/10/2026, item C1,
// aprovado pelo Diego). Antes o bloqueio existia só na tela: pela API a
// pessoa ainda recebia a sessão e lia os dados da empresa.
//
// 1. onRecordAuthRequest roda sempre que o servidor vai entregar uma sessão:
//    login por e-mail (nativo), por usuário e por ID (login-e-senha.pb.js),
//    e renovação de sessão (auth-refresh). Recusa quem está Inativo ou
//    Bloqueado (o titular nunca é barrado).
// 2. Ao passar para Inativo/Bloqueado ou ser arquivado, a chave da conta é
//    trocada: todas as sessões abertas da pessoa deixam de valer na hora.
// ============================================================

onRecordAuthRequest((e) => {
  const lib = require(`${__hooks}/login-situacao-lib.js`);
  if (lib.semAcesso(e.record)) throw new ForbiddenError(lib.mensagem(e.record));
  e.next();
}, "users");

onRecordUpdate((e) => {
  const lib = require(`${__hooks}/login-situacao-lib.js`);
  const o = e.record.original();
  const perdeuAcesso = lib.SEM_ACESSO.includes(String(e.record.get("status") || "")) &&
    String(o.get("status") || "") !== String(e.record.get("status") || "");
  const arquivado = !!e.record.getString("deleted_at") && !o.getString("deleted_at");
  if (perdeuAcesso || arquivado) e.record.refreshTokenKey();
  e.next();
}, "users");
