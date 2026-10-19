/// <reference path="../pb_data/types.d.ts" />

// Cor e código do material (pedido do Diego, 19/10/2026). Cor escolhida numa lista na
// tela (fio, tubo, tinta...), sem digitar. A tela também põe a cor no fim do
// nome ("Fio 2,5 mm Azul claro") para os pedidos e o estoque mostrarem a
// diferença.
onBootstrap((e) => {
  e.next();
  try {
    const col = e.app.findCollectionByNameOrId("materiais");
    if (!col.fields.getByName("cor")) {
      col.fields.add(new TextField({ name: "cor", max: 60 }));
      e.app.save(col);
      console.log("[materiais-cor] campo cor criado em materiais.");
    }
  } catch (err) {
    console.log("[materiais-cor] Erro ao criar o campo cor:", err);
  }
});

// Código / SKU sempre do sistema (pedido do Diego, 19/10/2026): prefixo da
// categoria + número em sequência na empresa (ELE-001, PIN-002...). Cada cor é
// um material, então cada cor tem o seu código. Ninguém digita nem troca.
onRecordCreateRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    const PREFIXO = {
      "Materiais de Construção": "CON", "Acabamento": "ACA", "Elétrica": "ELE", "Hidráulica": "HID",
      "Ferragens": "FER", "Ferramentas": "FRT", "EPI": "EPI", "Madeira": "MAD", "Metalúrgicos": "MET",
      "Pintura": "PIN", "Outros": "OUT",
    };
    const r = e.record;
    const companyId = r.get("company_id") || (e.auth ? e.auth.get("company_id") : "");
    const prefixo = PREFIXO[r.get("category")] || "MAT";
    let max = 0;
    try {
      e.app.findRecordsByFilter("materiais", "company_id = {:c} && code ~ {:p}", "", 0, 0, { c: companyId, p: prefixo + "-" })
        .forEach((m) => {
          const g = String(m.get("code") || "").match(new RegExp(`^${prefixo}-(\\d+)`));
          if (g) max = Math.max(max, parseInt(g[1], 10));
        });
    } catch (_) {}
    r.set("code", `${prefixo}-${String(max + 1).padStart(3, "0")}`);
  }
  e.next();
}, "materiais");

onRecordUpdateRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) e.record.set("code", e.record.original().get("code"));
  e.next();
}, "materiais");
