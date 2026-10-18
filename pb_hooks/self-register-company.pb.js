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

  // A empresa nova começa SEM materiais (estoque real desde o início). O
  // catálogo padrão virou lista de sugestões na tela de Materiais
  // (catalogo-lib.js + catalogo.pb.js).


  return e.json(200, {
    success: true,
    companyId: company.id,
    companyName: company.get("name"),
    userId: user.id,
  });
})
