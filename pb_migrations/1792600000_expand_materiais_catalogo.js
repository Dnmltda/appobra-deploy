/// <reference path="../pb_data/types.d.ts" />
// Amplia o catálogo padrão de materiais (pedido do Diego: uns 8-10 itens por
// categoria) e cria itens também para as categorias que ainda não tinham
// nenhum material pré-cadastrado: Ferramentas, EPI, Madeira e Metalúrgicos.
// Só ADICIONA itens novos (códigos que ainda não existem para a empresa) —
// não toca nos 18 itens já semeados pela migration 1792400000, nem em
// materiais que o usuário já editou/cadastrou.
migrate((app) => {
  const CATALOGO_NOVO = [
    // Elétrica
    { code: "ELE-006", name: "Interruptor simples", category: "Elétrica", unit: "un" },
    { code: "ELE-007", name: "Eletroduto corrugado 25mm", category: "Elétrica", unit: "m" },
    { code: "ELE-008", name: "Caixa de luz 4x2", category: "Elétrica", unit: "un" },
    { code: "ELE-009", name: "Fita isolante", category: "Elétrica", unit: "un" },
    { code: "ELE-010", name: "Lâmpada LED bulbo 9W", category: "Elétrica", unit: "un" },
    // Hidráulica
    { code: "HID-005", name: "Tê PVC soldável 25mm", category: "Hidráulica", unit: "un" },
    { code: "HID-006", name: "Registro de gaveta 3/4\"", category: "Hidráulica", unit: "un" },
    { code: "HID-007", name: "Caixa d'água 1000L", category: "Hidráulica", unit: "un" },
    { code: "HID-008", name: "Sifão sanfonado", category: "Hidráulica", unit: "un" },
    { code: "HID-009", name: "Fita veda rosca", category: "Hidráulica", unit: "un" },
    // Materiais de Construção
    { code: "CON-005", name: "Cal hidratada 20kg", category: "Materiais de Construção", unit: "un" },
    { code: "CON-006", name: "Bloco de concreto 14x19x39", category: "Materiais de Construção", unit: "un" },
    { code: "CON-007", name: "Vergalhão CA-50 10mm", category: "Materiais de Construção", unit: "un" },
    { code: "CON-008", name: "Telha cerâmica colonial", category: "Materiais de Construção", unit: "un" },
    { code: "CON-009", name: "Manta asfáltica", category: "Materiais de Construção", unit: "m2" },
    // Pintura (ACB-001 já existe desde a migration anterior)
    { code: "PIN-002", name: "Tinta acrílica branca 3,6L", category: "Pintura", unit: "un" },
    { code: "PIN-003", name: "Massa acrílica para parede 1kg", category: "Pintura", unit: "un" },
    { code: "PIN-004", name: "Rolo de lã para pintura 23cm", category: "Pintura", unit: "un" },
    { code: "PIN-005", name: "Pincel trincha 2\"", category: "Pintura", unit: "un" },
    { code: "PIN-006", name: "Fita crepe 48mm", category: "Pintura", unit: "un" },
    { code: "PIN-007", name: "Lona plástica para proteção", category: "Pintura", unit: "m2" },
    { code: "PIN-008", name: "Selador acrílico 18L", category: "Pintura", unit: "un" },
    { code: "PIN-009", name: "Verniz para madeira 3,6L", category: "Pintura", unit: "un" },
    // Acabamento
    { code: "ACB-004", name: "Porcelanato 60x60", category: "Acabamento", unit: "m2" },
    { code: "ACB-005", name: "Rejunte 1kg", category: "Acabamento", unit: "un" },
    { code: "ACB-006", name: "Rodapé de poliestireno", category: "Acabamento", unit: "m" },
    { code: "ACB-007", name: "Gesso em pó 40kg", category: "Acabamento", unit: "un" },
    { code: "ACB-008", name: "Placa de drywall", category: "Acabamento", unit: "un" },
    { code: "ACB-009", name: "Perfil para drywall", category: "Acabamento", unit: "m" },
    { code: "ACB-010", name: "Massa corrida PVA 18L", category: "Acabamento", unit: "un" },
    // Ferragens
    { code: "FER-003", name: "Parafuso para madeira 4x40mm", category: "Ferragens", unit: "un" },
    { code: "FER-004", name: "Bucha de nylon S6", category: "Ferragens", unit: "un" },
    { code: "FER-005", name: "Arruela de pressão", category: "Ferragens", unit: "un" },
    { code: "FER-006", name: "Dobradiça 3\"", category: "Ferragens", unit: "un" },
    { code: "FER-007", name: "Fechadura para porta interna", category: "Ferragens", unit: "un" },
    { code: "FER-008", name: "Cadeado 40mm", category: "Ferragens", unit: "un" },
    { code: "FER-009", name: "Abraçadeira de nylon", category: "Ferragens", unit: "un" },
    // Ferramentas (categoria nova)
    { code: "FRM-001", name: "Furadeira de impacto", category: "Ferramentas", unit: "un" },
    { code: "FRM-002", name: "Serra circular", category: "Ferramentas", unit: "un" },
    { code: "FRM-003", name: "Trena 5m", category: "Ferramentas", unit: "un" },
    { code: "FRM-004", name: "Nível de bolha", category: "Ferramentas", unit: "un" },
    { code: "FRM-005", name: "Martelo de unha", category: "Ferramentas", unit: "un" },
    { code: "FRM-006", name: "Colher de pedreiro", category: "Ferramentas", unit: "un" },
    { code: "FRM-007", name: "Desempenadeira de aço", category: "Ferramentas", unit: "un" },
    { code: "FRM-008", name: "Betoneira 150L", category: "Ferramentas", unit: "un" },
    { code: "FRM-009", name: "Carrinho de mão", category: "Ferramentas", unit: "un" },
    // EPI (categoria nova)
    { code: "EPI-001", name: "Capacete de segurança", category: "EPI", unit: "un" },
    { code: "EPI-002", name: "Luva de raspa", category: "EPI", unit: "un" },
    { code: "EPI-003", name: "Óculos de proteção", category: "EPI", unit: "un" },
    { code: "EPI-004", name: "Protetor auricular", category: "EPI", unit: "un" },
    { code: "EPI-005", name: "Botina de segurança", category: "EPI", unit: "un" },
    { code: "EPI-006", name: "Cinto de segurança tipo paraquedista", category: "EPI", unit: "un" },
    { code: "EPI-007", name: "Máscara descartável PFF2", category: "EPI", unit: "un" },
    { code: "EPI-008", name: "Colete refletivo", category: "EPI", unit: "un" },
    { code: "EPI-009", name: "Capa de chuva", category: "EPI", unit: "un" },
    // Madeira (categoria nova)
    { code: "MAD-001", name: "Tábua de pinus 2,5x30cm", category: "Madeira", unit: "m" },
    { code: "MAD-002", name: "Caibro 5x6cm", category: "Madeira", unit: "m" },
    { code: "MAD-003", name: "Ripão 2,5x5cm", category: "Madeira", unit: "m" },
    { code: "MAD-004", name: "Compensado naval 18mm", category: "Madeira", unit: "un" },
    { code: "MAD-005", name: "Sarrafo 2,5x7cm", category: "Madeira", unit: "m" },
    { code: "MAD-006", name: "Viga de madeira 6x12cm", category: "Madeira", unit: "m" },
    { code: "MAD-007", name: "Chapa de OSB 11mm", category: "Madeira", unit: "un" },
    { code: "MAD-008", name: "Porta de madeira pronta", category: "Madeira", unit: "un" },
    { code: "MAD-009", name: "Batente de madeira", category: "Madeira", unit: "un" },
    // Metalúrgicos (categoria nova)
    { code: "MET-001", name: "Telha metálica trapezoidal", category: "Metalúrgicos", unit: "m2" },
    { code: "MET-002", name: "Perfil metálico galvanizado", category: "Metalúrgicos", unit: "m" },
    { code: "MET-003", name: "Chapa de aço galvanizado", category: "Metalúrgicos", unit: "m2" },
    { code: "MET-004", name: "Tela de aço soldada", category: "Metalúrgicos", unit: "m2" },
    { code: "MET-005", name: "Grade de proteção metálica", category: "Metalúrgicos", unit: "m" },
    { code: "MET-006", name: "Portão de ferro", category: "Metalúrgicos", unit: "un" },
    { code: "MET-007", name: "Corrimão de alumínio", category: "Metalúrgicos", unit: "m" },
    { code: "MET-008", name: "Eletrodo de solda", category: "Metalúrgicos", unit: "un" },
    { code: "MET-009", name: "Tubo metálico galvanizado 1\"", category: "Metalúrgicos", unit: "m" },
  ];

  const materiaisCollection = app.findCollectionByNameOrId("materiais");
  const companies = app.findRecordsByFilter("companies", "id != ''", "", 500, 0);

  companies.forEach((company) => {
    CATALOGO_NOVO.forEach((item) => {
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
      "ELE-006", "ELE-007", "ELE-008", "ELE-009", "ELE-010",
      "HID-005", "HID-006", "HID-007", "HID-008", "HID-009",
      "CON-005", "CON-006", "CON-007", "CON-008", "CON-009",
      "PIN-002", "PIN-003", "PIN-004", "PIN-005", "PIN-006", "PIN-007", "PIN-008", "PIN-009",
      "ACB-004", "ACB-005", "ACB-006", "ACB-007", "ACB-008", "ACB-009", "ACB-010",
      "FER-003", "FER-004", "FER-005", "FER-006", "FER-007", "FER-008", "FER-009",
      "FRM-001", "FRM-002", "FRM-003", "FRM-004", "FRM-005", "FRM-006", "FRM-007", "FRM-008", "FRM-009",
      "EPI-001", "EPI-002", "EPI-003", "EPI-004", "EPI-005", "EPI-006", "EPI-007", "EPI-008", "EPI-009",
      "MAD-001", "MAD-002", "MAD-003", "MAD-004", "MAD-005", "MAD-006", "MAD-007", "MAD-008", "MAD-009",
      "MET-001", "MET-002", "MET-003", "MET-004", "MET-005", "MET-006", "MET-007", "MET-008", "MET-009",
    ];
    const filter = codes.map((c) => `code = "${c}"`).join(" || ");
    const records = app.findRecordsByFilter(materiaisCollection, `(${filter})`, "", 2000, 0);
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
