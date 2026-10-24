/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Titular da plataforma (pedido do Diego, 21/10/2026): a conta marcada como
// dono do sistema (dnmltda@hotmail.com, ID 00 na DNM&LTDA OBRAS) nunca pode ser
// apagada, arquivada, inativada, bloqueada nem perder cargo, empresa ou a marca
// de dono — por ninguém, em nenhum caminho (tela, API ou script). A empresa
// dele também não pode ser apagada nem arquivada.
// Também: e-mails para o domínio reservado ".invalid" (logins de teste) não
// são enviados — evita devolução de e-mail na conta Brevo.
// ============================================================

// A trava total (nem o superusuário) vale só para a conta do titular
// (dnmltda@hotmail.com). Outra conta marcada como dona pode ser desmarcada
// pelo superusuário; pela API ninguém mexe (dono-sistema.pb.js).
onRecordUpdate((e) => {
  const o = e.record.original();
  if (o.get("dono_sistema") === true && String(o.get("email") || "").toLowerCase() === "dnmltda@hotmail.com") {
    const r = e.record;
    const tirou = r.get("dono_sistema") !== true || r.getString("deleted_at") || r.get("is_blocked") === true
      || (o.get("status") === "Ativo" && r.get("status") !== "Ativo")
      || r.get("company_id") !== o.get("company_id")
      || (o.get("cargo") === "Administrador" && r.get("cargo") !== "Administrador");
    if (tirou) throw new ForbiddenError("A conta do titular não pode ser arquivada, inativada, bloqueada nem perder o cargo.");
  }
  e.next();
}, "users");

onRecordDelete((e) => {
  if (e.record.get("dono_sistema") === true && String(e.record.get("email") || "").toLowerCase() === "dnmltda@hotmail.com") {
    throw new ForbiddenError("A conta do titular não pode ser apagada.");
  }
  e.next();
}, "users");

// Convite, senha e e-mail do titular só mudam pela própria conta ou pelo
// suporte (auditoria de 24/10/2026, item A1): antes outro administrador da
// empresa do titular podia gravar um convite na conta dele e "ativar" com uma
// senha nova. O "Esqueci minha senha" do servidor grava direto, sem passar aqui.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth() && e.record.original().get("dono_sistema") === true && (!e.auth || e.auth.id !== e.record.id)) {
    const body = e.requestInfo().body || {};
    const sensiveis = ["password", "passwordConfirm", "oldPassword", "email", "password_reset_token", "password_reset_expires", "tokenKey"];
    if (sensiveis.some((k) => Object.prototype.hasOwnProperty.call(body, k))) {
      throw new ForbiddenError("A senha, o e-mail e o convite da conta do titular só podem ser alterados por ele mesmo.");
    }
  }
  e.next();
}, "users");

// Ninguém além do superusuário muda o ID do titular pela API.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth() && e.record.original().get("dono_sistema") === true) {
    e.record.set("id_unico", e.record.original().get("id_unico"));
  }
  e.next();
}, "users");

onRecordDelete((e) => {
  const rows = arrayOf(new DynamicModel({ n: 0 }));
  e.app.db().newQuery("SELECT COUNT(*) AS n FROM users WHERE company_id = {:c} AND dono_sistema = TRUE").bind({ c: e.record.id }).all(rows);
  if (rows.length && rows[0].n > 0) throw new ForbiddenError("A empresa do titular não pode ser apagada.");
  e.next();
}, "companies");

onRecordUpdate((e) => {
  if (e.record.getString("deleted_at") && !e.record.original().getString("deleted_at")) {
    const rows = arrayOf(new DynamicModel({ n: 0 }));
    e.app.db().newQuery("SELECT COUNT(*) AS n FROM users WHERE company_id = {:c} AND dono_sistema = TRUE").bind({ c: e.record.id }).all(rows);
    if (rows.length && rows[0].n > 0) throw new ForbiddenError("A empresa do titular não pode ser arquivada.");
  }
  e.next();
}, "companies");

// Logins de teste usam o domínio reservado ".invalid": nada é enviado para eles.
onMailerSend((e) => {
  const reais = (e.message.to || []).filter((a) => !/\.invalid$/i.test(String(a.address || "").trim()));
  if (!reais.length) return; // não envia
  e.message.to = reais;
  e.next();
});
