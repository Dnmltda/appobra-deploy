/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Convite gerado no servidor (auditoria de 24/10/2026, item D9, aprovado pelo
// Diego em 25/10/2026). Antes o código do convite e a senha descartável eram
// feitos no navegador (a senha com Math.random, que não é seguro).
// Agora, ao criar um acesso com convite, o servidor troca o código por um
// aleatório seguro com validade de 7 dias e põe uma senha descartável que
// ninguém vê (a pessoa cria a dela pelo link do e-mail, activate-invite.pb.js).
// O e-mail sai com o código do servidor (send-welcome-email.pb.js).
// ============================================================

onRecordCreateRequest((e) => {
  const a = e.auth;
  if (!(a && a.isSuperuser()) && String(e.record.get("password_reset_token") || "")) {
    e.record.set("password_reset_token", $security.randomString(40));
    e.record.set("password_reset_expires", new Date(Date.now() + 7 * 86400000).toISOString().replace("T", " "));
    e.record.setPassword($security.randomString(40));
  }
  e.next();
}, "users");

// Reenvio/edição pela API: código novo sempre vem do servidor.
onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (!(a && a.isSuperuser())) {
    const novo = String(e.record.get("password_reset_token") || "");
    const antes = String(e.record.original().get("password_reset_token") || "");
    if (novo && novo !== antes) {
      e.record.set("password_reset_token", $security.randomString(40));
      e.record.set("password_reset_expires", new Date(Date.now() + 7 * 86400000).toISOString().replace("T", " "));
    }
  }
  e.next();
}, "users");
