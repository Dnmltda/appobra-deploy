// Situação da conta no login (auditoria de 24/10/2026, item C1). Regra usada
// por login-situacao.pb.js. A conta do titular (dono do sistema) nunca é
// barrada, como já era na tela.

const SEM_ACESSO = ["Inativo", "Bloqueado"];

function semAcesso(u) {
  return !!u && u.get("dono_sistema") !== true && SEM_ACESSO.includes(String(u.get("status") || ""));
}

function mensagem(u) {
  return u.get("status") === "Bloqueado"
    ? "Usuário bloqueado. Entre em contato com o administrador."
    : "Usuário inativo. Entre em contato com o administrador.";
}

module.exports = { SEM_ACESSO, semAcesso, mensagem };
