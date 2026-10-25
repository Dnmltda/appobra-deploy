// Carimbo de autoria pelo servidor (M1). Usado por autoria.pb.js.

// Quem criou: recebe quem está logado ao criar e nunca muda depois.
const AUTOR = ["criado_por", "created_by", "autor_id", "registrado_por"];
// Quem editou por último.
const EDITOU = ["atualizado_por", "updated_by"];
// Quem registrou a retirada: se o pedido mexer nele, vale quem está logado.
const QUEM_FEZ = ["retirada_registrada_por"];
// Auditoria e históricos: o "usuário" do registro é quem está logado.
const LOGS = {
  audit_logs: ["usuario_id", "usuario"],
  auditoria: ["usuarioId", "usuario"],
  epis_historico: ["usuario_id"],
  equipamentos_historico: ["usuario_id"],
  qrcode_leituras: ["usuario_id"],
  relatorios_exportados: ["usuario_id"],
};

function tem(col, campo) {
  return !!col.fields.getByName(campo);
}

function carimbar(e, criando) {
  const col = e.collection;
  const r = e.record;
  const a = e.auth;
  const o = criando ? null : r.original();
  AUTOR.forEach((c) => {
    if (!tem(col, c)) return;
    if (criando) r.set(c, a.id);
    else r.set(c, o.get(c));
  });
  EDITOU.forEach((c) => {
    if (tem(col, c)) r.set(c, a.id);
  });
  QUEM_FEZ.forEach((c) => {
    if (!tem(col, c)) return;
    const antes = o ? String(o.get(c) || "") : "";
    if (String(r.get(c) || "") !== antes) r.set(c, a.id);
  });
  const log = LOGS[col.name];
  if (log) {
    if (!criando) {
      log.forEach((c) => r.set(c, o.get(c)));
    } else {
      r.set(log[0], a.id);
      if (log[1] && tem(col, log[1])) r.set(log[1], a.get("name") || a.get("email") || a.get("username") || "");
    }
  }
}

module.exports = { carimbar };
