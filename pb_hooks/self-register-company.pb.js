/// <reference path="../pb_data/types.d.ts" />

// Endpoint público para autocadastro (tela de Login -> "Criar conta").
// Cria uma empresa NOVA + o usuário administrador vinculado a ela, de forma
// atômica. Sempre cria uma empresa nova — nunca aceita um company_id vindo
// do cliente — para impedir que alguém se autocadastre dentro dos dados de
// uma empresa já existente. As regras de criação de "companies" e "users"
// continuam exigindo admin autenticado via API normal; este endpoint roda
// com contexto de servidor ($app.save) e por isso não passa por essas regras,
// mas o próprio código nunca reaproveita um company_id existente.
routerAdd("POST", "/api/custom/self-register-company", (e) => {
  const data = new DynamicModel({
    companyName: "",
    cpfCnpj: "",
    companyEmail: "",
    phone: "",
    city: "",
    state: "",
    adminName: "",
    adminEmail: "",
    username: "",
    password: "",
  });
  e.bindBody(data);

  const companyName = String(data.companyName || "").trim();
  const adminName = String(data.adminName || "").trim();
  const adminEmail = String(data.adminEmail || "").trim().toLowerCase();
  const username = String(data.username || "").trim().toLowerCase();
  const password = String(data.password || "");

  if (!companyName || !adminName || !adminEmail || !username || !password) {
    throw new BadRequestError("Preencha nome da empresa, nome, email, usuário e senha.");
  }
  if (password.length < 8) {
    throw new BadRequestError("A senha deve ter pelo menos 8 caracteres.");
  }

  const companiesCol = $app.findCollectionByNameOrId("companies");
  const company = new Record(companiesCol);
  company.set("name", companyName);
  if (data.cpfCnpj) company.set("cnpj", String(data.cpfCnpj).replace(/\D/g, ""));
  if (data.companyEmail) company.set("email", String(data.companyEmail).trim());
  if (data.phone) company.set("phone", String(data.phone).trim());
  if (data.city) company.set("city", String(data.city).trim());
  if (data.state) company.set("state", String(data.state).trim());
  company.set("subscription_tier", "basic");
  company.set("is_active", true);

  try {
    $app.save(company);
  } catch (err) {
    throw new BadRequestError("Erro ao criar empresa: " + err.message);
  }

  const usersCol = $app.findCollectionByNameOrId("users");
  const user = new Record(usersCol);
  user.set("email", adminEmail);
  user.set("username", username);
  user.set("name", adminName);
  user.set("password", password);
  user.set("passwordConfirm", password);
  user.set("company_id", company.id);
  user.set("role", "Administrador");
  user.set("cargo", "Administrador");
  user.set("status", "Ativo");
  user.set("is_active", true);
  user.set("is_blocked", false);
  user.set("login_attempts", 0);

  try {
    $app.save(user);
  } catch (err) {
    try {
      $app.delete(company);
    } catch (rollbackErr) {
      console.log("Falha ao reverter empresa após erro no usuário:", rollbackErr);
    }
    throw new BadRequestError("Erro ao criar administrador: " + err.message);
  }

  // Catálogo padrão de materiais (mesmo usado em
  // pb_migrations/1792400000_seed_materiais_catalogo_padrao.js e
  // pb_migrations/1792600000_expand_materiais_catalogo.js), pra toda
  // empresa nova já nascer com uma base de materiais pronta — cerca de
  // 8-10 itens por categoria, cobrindo todas as categorias do seletor.
  // Não bloqueia o cadastro se falhar.
  try {
    const materiaisCol = $app.findCollectionByNameOrId("materiais");
    const CATALOGO_PADRAO = [
      // Elétrica
      { code: "ELE-001", name: "Fio flexível 1,5mm", category: "Elétrica", unit: "m" },
      { code: "ELE-002", name: "Fio flexível 2,5mm", category: "Elétrica", unit: "m" },
      { code: "ELE-003", name: "Fio flexível 4mm", category: "Elétrica", unit: "m" },
      { code: "ELE-004", name: "Disjuntor DIN 20A", category: "Elétrica", unit: "un" },
      { code: "ELE-005", name: "Tomada 2P+T 10A", category: "Elétrica", unit: "un" },
      { code: "ELE-006", name: "Interruptor simples", category: "Elétrica", unit: "un" },
      { code: "ELE-007", name: "Eletroduto corrugado 25mm", category: "Elétrica", unit: "m" },
      { code: "ELE-008", name: "Caixa de luz 4x2", category: "Elétrica", unit: "un" },
      { code: "ELE-009", name: "Fita isolante", category: "Elétrica", unit: "un" },
      { code: "ELE-010", name: "Lâmpada LED bulbo 9W", category: "Elétrica", unit: "un" },
      // Hidráulica
      { code: "HID-001", name: "Tubo PVC soldável 25mm (3/4\")", category: "Hidráulica", unit: "m" },
      { code: "HID-002", name: "Tubo PVC soldável 50mm (1.1/2\")", category: "Hidráulica", unit: "m" },
      { code: "HID-003", name: "Joelho PVC 90° 25mm", category: "Hidráulica", unit: "un" },
      { code: "HID-004", name: "Torneira de parede 1/2\"", category: "Hidráulica", unit: "un" },
      { code: "HID-005", name: "Tê PVC soldável 25mm", category: "Hidráulica", unit: "un" },
      { code: "HID-006", name: "Registro de gaveta 3/4\"", category: "Hidráulica", unit: "un" },
      { code: "HID-007", name: "Caixa d'água 1000L", category: "Hidráulica", unit: "un" },
      { code: "HID-008", name: "Sifão sanfonado", category: "Hidráulica", unit: "un" },
      { code: "HID-009", name: "Fita veda rosca", category: "Hidráulica", unit: "un" },
      // Materiais de Construção
      { code: "CON-001", name: "Cimento CP II 50kg", category: "Materiais de Construção", unit: "un" },
      { code: "CON-002", name: "Areia média lavada", category: "Materiais de Construção", unit: "m3" },
      { code: "CON-003", name: "Tijolo cerâmico 6 furos", category: "Materiais de Construção", unit: "un" },
      { code: "CON-004", name: "Brita nº1", category: "Materiais de Construção", unit: "m3" },
      { code: "CON-005", name: "Cal hidratada 20kg", category: "Materiais de Construção", unit: "un" },
      { code: "CON-006", name: "Bloco de concreto 14x19x39", category: "Materiais de Construção", unit: "un" },
      { code: "CON-007", name: "Vergalhão CA-50 10mm", category: "Materiais de Construção", unit: "un" },
      { code: "CON-008", name: "Telha cerâmica colonial", category: "Materiais de Construção", unit: "un" },
      { code: "CON-009", name: "Manta asfáltica", category: "Materiais de Construção", unit: "m2" },
      // Pintura
      { code: "ACB-001", name: "Tinta acrílica branca 18L", category: "Pintura", unit: "un" },
      { code: "PIN-002", name: "Tinta acrílica branca 3,6L", category: "Pintura", unit: "un" },
      { code: "PIN-003", name: "Massa acrílica para parede 1kg", category: "Pintura", unit: "un" },
      { code: "PIN-004", name: "Rolo de lã para pintura 23cm", category: "Pintura", unit: "un" },
      { code: "PIN-005", name: "Pincel trincha 2\"", category: "Pintura", unit: "un" },
      { code: "PIN-006", name: "Fita crepe 48mm", category: "Pintura", unit: "un" },
      { code: "PIN-007", name: "Lona plástica para proteção", category: "Pintura", unit: "m2" },
      { code: "PIN-008", name: "Selador acrílico 18L", category: "Pintura", unit: "un" },
      { code: "PIN-009", name: "Verniz para madeira 3,6L", category: "Pintura", unit: "un" },
      // Acabamento
      { code: "ACB-002", name: "Piso cerâmico 45x45", category: "Acabamento", unit: "m2" },
      { code: "ACB-003", name: "Argamassa ACIII 20kg", category: "Acabamento", unit: "un" },
      { code: "ACB-004", name: "Porcelanato 60x60", category: "Acabamento", unit: "m2" },
      { code: "ACB-005", name: "Rejunte 1kg", category: "Acabamento", unit: "un" },
      { code: "ACB-006", name: "Rodapé de poliestireno", category: "Acabamento", unit: "m" },
      { code: "ACB-007", name: "Gesso em pó 40kg", category: "Acabamento", unit: "un" },
      { code: "ACB-008", name: "Placa de drywall", category: "Acabamento", unit: "un" },
      { code: "ACB-009", name: "Perfil para drywall", category: "Acabamento", unit: "m" },
      { code: "ACB-010", name: "Massa corrida PVA 18L", category: "Acabamento", unit: "un" },
      // Ferragens
      { code: "FER-001", name: "Prego 17x27", category: "Ferragens", unit: "kg" },
      { code: "FER-002", name: "Parafuso drywall 3,5x25mm", category: "Ferragens", unit: "un" },
      { code: "FER-003", name: "Parafuso para madeira 4x40mm", category: "Ferragens", unit: "un" },
      { code: "FER-004", name: "Bucha de nylon S6", category: "Ferragens", unit: "un" },
      { code: "FER-005", name: "Arruela de pressão", category: "Ferragens", unit: "un" },
      { code: "FER-006", name: "Dobradiça 3\"", category: "Ferragens", unit: "un" },
      { code: "FER-007", name: "Fechadura para porta interna", category: "Ferragens", unit: "un" },
      { code: "FER-008", name: "Cadeado 40mm", category: "Ferragens", unit: "un" },
      { code: "FER-009", name: "Abraçadeira de nylon", category: "Ferragens", unit: "un" },
      // Ferramentas
      { code: "FRM-001", name: "Furadeira de impacto", category: "Ferramentas", unit: "un" },
      { code: "FRM-002", name: "Serra circular", category: "Ferramentas", unit: "un" },
      { code: "FRM-003", name: "Trena 5m", category: "Ferramentas", unit: "un" },
      { code: "FRM-004", name: "Nível de bolha", category: "Ferramentas", unit: "un" },
      { code: "FRM-005", name: "Martelo de unha", category: "Ferramentas", unit: "un" },
      { code: "FRM-006", name: "Colher de pedreiro", category: "Ferramentas", unit: "un" },
      { code: "FRM-007", name: "Desempenadeira de aço", category: "Ferramentas", unit: "un" },
      { code: "FRM-008", name: "Betoneira 150L", category: "Ferramentas", unit: "un" },
      { code: "FRM-009", name: "Carrinho de mão", category: "Ferramentas", unit: "un" },
      // EPI
      { code: "EPI-001", name: "Capacete de segurança", category: "EPI", unit: "un" },
      { code: "EPI-002", name: "Luva de raspa", category: "EPI", unit: "un" },
      { code: "EPI-003", name: "Óculos de proteção", category: "EPI", unit: "un" },
      { code: "EPI-004", name: "Protetor auricular", category: "EPI", unit: "un" },
      { code: "EPI-005", name: "Botina de segurança", category: "EPI", unit: "un" },
      { code: "EPI-006", name: "Cinto de segurança tipo paraquedista", category: "EPI", unit: "un" },
      { code: "EPI-007", name: "Máscara descartável PFF2", category: "EPI", unit: "un" },
      { code: "EPI-008", name: "Colete refletivo", category: "EPI", unit: "un" },
      { code: "EPI-009", name: "Capa de chuva", category: "EPI", unit: "un" },
      // Madeira
      { code: "MAD-001", name: "Tábua de pinus 2,5x30cm", category: "Madeira", unit: "m" },
      { code: "MAD-002", name: "Caibro 5x6cm", category: "Madeira", unit: "m" },
      { code: "MAD-003", name: "Ripão 2,5x5cm", category: "Madeira", unit: "m" },
      { code: "MAD-004", name: "Compensado naval 18mm", category: "Madeira", unit: "un" },
      { code: "MAD-005", name: "Sarrafo 2,5x7cm", category: "Madeira", unit: "m" },
      { code: "MAD-006", name: "Viga de madeira 6x12cm", category: "Madeira", unit: "m" },
      { code: "MAD-007", name: "Chapa de OSB 11mm", category: "Madeira", unit: "un" },
      { code: "MAD-008", name: "Porta de madeira pronta", category: "Madeira", unit: "un" },
      { code: "MAD-009", name: "Batente de madeira", category: "Madeira", unit: "un" },
      // Metalúrgicos
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
    CATALOGO_PADRAO.forEach((item) => {
      const material = new Record(materiaisCol);
      material.set("company_id", company.id);
      material.set("code", item.code);
      material.set("name", item.name);
      material.set("category", item.category);
      material.set("unit", item.unit);
      material.set("quantity_in_stock", 0);
      material.set("min_quantity", 0);
      material.set("unit_cost", 0);
      material.set("status", "active");
      $app.save(material);
    });
  } catch (seedErr) {
    console.log("Erro ao semear catálogo padrão de materiais:", seedErr);
  }

  return e.json(200, {
    success: true,
    companyId: company.id,
    companyName: company.get("name"),
    userId: user.id,
  });
})
