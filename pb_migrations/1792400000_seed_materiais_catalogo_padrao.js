/// <reference path="../pb_data/types.d.ts" />
// Catálogo padrão de materiais de obra: dá uma base inicial de itens prontos
// pra toda empresa já cadastrada (ajuda nas demonstrações do app, pra não
// aparecer vazio) — mas não impede nada: o usuário continua podendo editar,
// adicionar marca/cor depois e cadastrar qualquer outro material livremente.
// Preço unitário entra como 0 (R$ a definir) de propósito, cada empresa
// ajusta pro seu fornecedor/região.
migrate((app) => {
  const CATALOGO = [
    { code: "ELE-001", name: "Fio flexível 1,5mm", category: "Elétrica", unit: "m" },
    { code: "ELE-002", name: "Fio flexível 2,5mm", category: "Elétrica", unit: "m" },
    { code: "ELE-003", name: "Fio flexível 4mm", category: "Elétrica", unit: "m" },
    { code: "ELE-004", name: "Disjuntor DIN 20A", category: "Elétrica", unit: "un" },
    { code: "ELE-005", name: "Tomada 2P+T 10A", category: "Elétrica", unit: "un" },
    { code: "HID-001", name: "Tubo PVC soldável 25mm (3/4\")", category: "Hidráulica", unit: "m" },
    { code: "HID-002", name: "Tubo PVC soldável 50mm (1.1/2\")", category: "Hidráulica", unit: "m" },
    { code: "HID-003", name: "Joelho PVC 90° 25mm", category: "Hidráulica", unit: "un" },
    { code: "HID-004", name: "Torneira de parede 1/2\"", category: "Hidráulica", unit: "un" },
    { code: "CON-001", name: "Cimento CP II 50kg", category: "Materiais de Construção", unit: "un" },
    { code: "CON-002", name: "Areia média lavada", category: "Materiais de Construção", unit: "m3" },
    { code: "CON-003", name: "Tijolo cerâmico 6 furos", category: "Materiais de Construção", unit: "un" },
    { code: "CON-004", name: "Brita nº1", category: "Materiais de Construção", unit: "m3" },
    { code: "ACB-001", name: "Tinta acrílica branca 18L", category: "Pintura", unit: "un" },
    { code: "ACB-002", name: "Piso cerâmico 45x45", category: "Acabamento", unit: "m2" },
    { code: "ACB-003", name: "Argamassa ACIII 20kg", category: "Acabamento", unit: "un" },
    { code: "FER-001", name: "Prego 17x27", category: "Ferragens", unit: "kg" },
    { code: "FER-002", name: "Parafuso drywall 3,5x25mm", category: "Ferragens", unit: "un" },
  ];

  const materiaisCollection = app.findCollectionByNameOrId("materiais");
  const companies = app.findRecordsByFilter("companies", "id != ''", "", 500, 0);

  companies.forEach((company) => {
    CATALOGO.forEach((item) => {
      // Idempotente: não duplica se a empresa já tiver um material com esse código
      // (seja porque a migration já rodou antes, seja porque o usuário já criou um igual).
      const ja_existe = app.findRecordsByFilter(
        materiaisCollection,
        `company_id = "${company.id}" && code = "${item.code}"`,
        "",
        1,
        0
      );
      if (ja_existe.length > 0) return;

      const record = new Record(materiaisCollection);
      record.set("company_id", company.id);
      record.set("code", item.code);
      record.set("name", item.name);
      record.set("category", item.category);
      record.set("unit", item.unit);
      record.set("quantity_in_stock", 0);
      record.set("min_quantity", 0);
      record.set("unit_cost", 0);
      record.set("status", "active");

      try {
        app.save(record);
      } catch (e) {
        console.log(`Erro ao semear material ${item.code} para empresa ${company.id}: ${e.message}`);
      }
    });
  });
}, (app) => {
  try {
    const materiaisCollection = app.findCollectionByNameOrId("materiais");
    const codes = [
      "ELE-001", "ELE-002", "ELE-003", "ELE-004", "ELE-005",
      "HID-001", "HID-002", "HID-003", "HID-004",
      "CON-001", "CON-002", "CON-003", "CON-004",
      "ACB-001", "ACB-002", "ACB-003",
      "FER-001", "FER-002",
    ];
    const filter = codes.map((c) => `code = "${c}"`).join(" || ");
    const records = app.findRecordsByFilter(materiaisCollection, `(${filter})`, "", 1000, 0);
    records.forEach((r) => {
      try {
        app.delete(r);
      } catch (e) {
        console.log(`Erro ao remover material ${r.id}: ${e.message}`);
      }
    });
  } catch (e) {
    if (e.message && e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
