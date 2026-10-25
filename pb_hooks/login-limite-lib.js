// Limite de tentativas de login (usado por login-limite.pb.js e pelas rotas
// de login por ID e por usuário em login-e-senha.pb.js). Módulo à parte
// porque cada handler do JSVM roda isolado.
//
// 5 senhas erradas seguidas na mesma conta → a conta fica travada por 15
// minutos (users.locked_until). Senha certa zera o contador. Conta bloqueada
// pelo administrador (status "Bloqueado", locked_until lá no futuro) não é
// mexida aqui: quem bloqueou é quem desbloqueia.
// Grava direto no banco (sem passar pelos hooks de users) para não disparar
// e-mails nem regras de edição.

const MAX = 5;
const TRAVA_MIN = 15;

function travadaAte(u) {
  const s = u.getString("locked_until");
  if (!s) return null;
  const t = new Date(s.replace(" ", "T")).getTime();
  return t > Date.now() ? t : null;
}

function mensagem(ate) {
  const min = Math.max(1, Math.ceil((ate - Date.now()) / 60000));
  return `Muitas tentativas com senha errada. Tente de novo em ${min} minuto(s) ou use "Esqueci minha senha".`;
}

// Recusa logo se a conta está travada por tentativas.
function conferir(u) {
  if (!u || u.get("status") === "Bloqueado") return;
  const ate = travadaAte(u);
  if (ate) throw new BadRequestError(mensagem(ate));
}

function errou(app, u) {
  if (!u || u.get("status") === "Bloqueado") return;
  const n = Number(u.get("login_attempts") || 0) + 1;
  if (n >= MAX) {
    const ate = new Date(Date.now() + TRAVA_MIN * 60000).toISOString().replace("T", " ");
    app.db().newQuery("UPDATE users SET login_attempts = 0, locked_until = {:a} WHERE id = {:id}").bind({ a: ate, id: u.id }).execute();
    console.log(`[login-limite] conta ${u.id} travada por ${TRAVA_MIN} min (${MAX} senhas erradas).`);
  } else {
    app.db().newQuery("UPDATE users SET login_attempts = {:n} WHERE id = {:id}").bind({ n, id: u.id }).execute();
  }
}

function acertou(app, u) {
  if (!u || u.get("status") === "Bloqueado") return;
  if (Number(u.get("login_attempts") || 0) === 0 && !u.getString("locked_until")) return;
  app.db().newQuery("UPDATE users SET login_attempts = 0, locked_until = '' WHERE id = {:id}").bind({ id: u.id }).execute();
}

// Login por ID repetido em várias empresas (auditoria de 24/10/2026, item A7):
// o contador é do ID na aba "ID" (memória do servidor), não das contas, para
// que errar pelo ID não trave o login por e-mail ou usuário de ninguém.
function chaveId(id) { return "login-id:" + id; }

function idConferir(app, id) {
  const v = app.store().get(chaveId(id));
  if (v && v.ate && v.ate > Date.now()) throw new BadRequestError(mensagem(v.ate));
}

function idErrou(app, id) {
  const v = app.store().get(chaveId(id)) || { n: 0, ate: 0 };
  const n = (v.ate && v.ate <= Date.now() ? 0 : Number(v.n || 0)) + 1;
  if (n >= MAX) {
    app.store().set(chaveId(id), { n: 0, ate: Date.now() + TRAVA_MIN * 60000 });
    console.log(`[login-limite] login pelo ID ${id} travado por ${TRAVA_MIN} min (${MAX} senhas erradas).`);
  } else {
    app.store().set(chaveId(id), { n, ate: 0 });
  }
}

function idAcertou(app, id) { app.store().remove(chaveId(id)); }

module.exports = { MAX, TRAVA_MIN, conferir, errou, acertou, idConferir, idErrou, idAcertou };
