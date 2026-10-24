// Trava de empresa nas gravações pela API (auditoria de 24/10/2026, itens A2 e
// A4, aprovado pelo Diego). Regra usada por empresa-trava.pb.js.

function lista(v) {
  if (!v) return [];
  if (typeof v === "string") return [v];
  const out = [];
  for (let i = 0; i < v.length; i++) if (v[i]) out.push(String(v[i]));
  return out;
}

// A4: a empresa de um registro não muda pela API (o titular ainda move usuários).
function conferirTroca(e) {
  const col = e.collection;
  if (!col.fields.getByName("company_id")) return;
  const antes = e.record.original().get("company_id");
  const depois = e.record.get("company_id");
  if (String(antes || "") === String(depois || "")) return;
  if (col.name === "users" && e.auth.get("dono_sistema") === true) return;
  throw new BadRequestError("A empresa do registro não pode ser trocada.");
}

// A2: toda ligação (material, funcionário, obra, equipamento...) tem de ser da
// mesma empresa do registro. Na edição, só as ligações que mudaram.
function conferirVinculos(e, criando) {
  const app = e.app;
  const col = e.collection;
  const cid = String(e.record.get("company_id") || (col.name === "companies" ? e.record.id : "") || e.auth.get("company_id") || "");
  if (!cid) return;
  const o = criando ? null : e.record.original();
  const fields = col.fields;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.type() !== "relation" || f.name === "company_id") continue;
    const ids = lista(e.record.get(f.name));
    if (!ids.length) continue;
    if (o && JSON.stringify(ids) === JSON.stringify(lista(o.get(f.name)))) continue;
    let alvo;
    try { alvo = app.findCollectionByNameOrId(f.collectionId); } catch (_) { continue; }
    if (!alvo.fields.getByName("company_id")) continue; // cadastro comum a todas as empresas
    const antigos = o ? lista(o.get(f.name)) : [];
    for (let j = 0; j < ids.length; j++) {
      if (antigos.includes(ids[j])) continue;
      let r;
      try { r = app.findRecordById(alvo.id, ids[j]); } catch (_) { continue; } // inexistente: o PocketBase já recusa
      const dela = String(r.get("company_id") || "");
      if (dela && dela !== cid) throw new BadRequestError("Um dos itens escolhidos é de outra empresa.");
    }
  }
}

module.exports = { conferirTroca, conferirVinculos };
