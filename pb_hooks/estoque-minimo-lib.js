// Alerta de estoque mínimo (estoque-minimo.pb.js).
// Carregado com require() dentro de cada handler.
//
// Estado guardado no material (alerta_minimo_enviado): o aviso sai UMA vez
// quando o saldo chega ao mínimo; volta a valer quando o saldo sobe acima do
// mínimo de novo. Material sem mínimo (0) não gera aviso.

const AVISA = ["Administrador", "Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador"];
const EMAIL = ["Administrador", "Almoxarife", "Comprador"];

function num(v) { return Number(v || 0); }
function fmt(v) { return String(Math.round(num(v) * 100) / 100).replace(".", ","); }

function verificar(app, materialId) {
  let m;
  try { m = app.findRecordById("materiais", materialId); } catch (_) { return; }
  const saldo = num(m.get("quantity_in_stock"));
  const min = num(m.get("min_quantity"));
  const enviado = !!m.get("alerta_minimo_enviado");
  const baixo = min > 0 && saldo <= min && m.get("status") !== "inactive" && !m.getString("deleted_at");

  if (!baixo) {
    if (enviado) app.db().newQuery("UPDATE materiais SET alerta_minimo_enviado = 0 WHERE id = {:id}").bind({ id: m.id }).execute();
    return;
  }
  if (enviado) return;
  app.db().newQuery("UPDATE materiais SET alerta_minimo_enviado = 1 WHERE id = {:id}").bind({ id: m.id }).execute();

  const un = m.get("unit") || "";
  const nome = m.get("name") || "Material";
  const msg = saldo <= 0
    ? `Acabou: ${nome} (mínimo ${fmt(min)} ${un}). Peça a compra.`
    : `Estoque baixo: ${nome} — restam ${fmt(saldo)} ${un} (mínimo ${fmt(min)} ${un}).`;

  const users = app.findRecordsByFilter("users", "company_id = {:c} && status != 'Inativo'", "", 200, 0, { c: m.get("company_id") });
  const cargo = (u) => u.get("cargo") || u.get("role");
  const admin = (u) => u.get("role") === "admin" || u.get("email") === "dnmltda@hotmail.com";
  const avisar = users.filter((u) => !u.getString("deleted_at") && (admin(u) || AVISA.includes(cargo(u))));

  const col = app.findCollectionByNameOrId("notificacoes");
  const agora = new Date();
  avisar.forEach((u) => {
    try {
      const n = new Record(col);
      n.set("usuarioId", u.id);
      n.set("tipo", "estoque");
      n.set("mensagem", msg);
      n.set("lida", false);
      n.set("data", agora.toISOString().replace("T", " "));
      n.set("hora", agora.toISOString().slice(11, 16));
      n.set("referencia", "material:" + m.id);
      app.save(n);
    } catch (err) {
      console.log("[estoque-minimo] Notificação não gravada:", err);
    }
  });

  const para = avisar.filter((u) => u.get("email") && (admin(u) || EMAIL.includes(cargo(u))));
  if (!para.length) return;
  try {
    const lib = require(`${__hooks}/email-lib.js`);
    const link = `${lib.enderecoApp()}/estoque`;
    app.newMailClient().send(new MailerMessage({
      from: { address: app.settings().meta.senderAddress, name: lib.REMETENTE },
      to: para.map((u) => ({ address: u.get("email") })),
      subject: (saldo <= 0 ? "Acabou: " : "Estoque baixo: ") + nome,
      text: `${msg}\n\nVer o estoque: ${link}`,
      html: lib.corpo(
        saldo <= 0 ? "Material acabou" : "Estoque baixo",
        `<p style="margin:0 0 12px">${lib.esc(msg)}</p>`,
        "Ver o estoque",
        link,
        "Você recebeu este aviso porque cuida do estoque ou das compras da empresa no APP OBRA."
      ),
    }));
  } catch (err) {
    console.log("[estoque-minimo] E-mail não enviado:", err);
  }
}

module.exports = { verificar };
