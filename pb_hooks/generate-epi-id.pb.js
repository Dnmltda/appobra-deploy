/// <reference path="../pb_data/types.d.ts" />

// Gera o código sequencial EPI-000001, EPI-000002... POR EMPRESA.
//
// Correção (18/10/2026): a versão anterior chamava findRecordsByFilter com
// um objeto no lugar do "sort" e filtrava com ~ "^EPI-" ("~" é busca
// literal, não regex). A busca sempre falhava em silêncio, todo registro
// recebia EPI-000001 e, a partir do segundo, o cadastro era recusado
// por duplicidade — no sistema inteiro, não só na empresa.
onRecordCreate((e) => {
  const prefix = "EPI";
  const companyId = e.record.get("company_id") || "";

  let maxNumber = 0;
  try {
    const records = $app.findRecordsByFilter(
      "epis",
      "company_id = {:c} && id_unico ~ {:p}",
      "",
      0,
      0,
      { c: companyId, p: prefix + "-" }
    );
    records.forEach((record) => {
      const match = String(record.get("id_unico") || "").match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });
  } catch (err) {
    // Nenhum registro ainda nesta empresa: começa do 1.
  }

  e.record.set("id_unico", `${prefix}-${String(maxNumber + 1).padStart(6, "0")}`);
  e.next();
}, "epis");
