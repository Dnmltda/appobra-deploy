/// <reference path="../pb_data/types.d.ts" />

// Fluxo de convite de funcionário: o admin cria o funcionário + o acesso
// (EmployeeManagement.jsx -> criarAcessoParaFuncionario) SEM definir uma
// senha utilizável. O usuário é criado com status "Inativo" e com
// password_reset_token/password_reset_expires já preenchidos (mesmos campos
// usados em "esqueci minha senha"). O hook send-welcome-email.pb.js detecta
// esse token e envia um email de convite com link para /ativar-conta.
//
// Estes dois endpoints públicos (sem autenticação, pois o funcionário ainda
// não tem como logar) rodam com contexto de servidor ($app.save) e por isso
// não passam pelas regras normais da collection "users" — seguem o mesmo
// padrão já usado em routerAdd("POST", "/api/custom/self-register-company")
// em send-welcome-email.pb.js.
//
// CAUSA RAIZ REAL do "Link inválido ou expirado" em TODO convite (achada
// depois de isolar cada chamada com uma rota de diagnóstico temporária):
// este arquivo tinha funções auxiliares (findUserByValidToken, etc.)
// declaradas no nível do módulo, fora dos callbacks do routerAdd. No
// PocketBase JSVM deste projeto, um callback de routerAdd NÃO enxerga essas
// declarações de nível de módulo em tempo de requisição — só os globais de
// verdade (como $app, DynamicModel, BadRequestError) ficam disponíveis.
// Resultado: a primeira chamada a uma dessas funções auxiliares lançava
// "findUserByValidToken is not defined" (ReferenceError), um erro NÃO
// tratado que o PocketBase transforma no "Something went wrong..." genérico
// — nada a ver com o token em si, nem com findRecordsByFilter. A correção é
// manter toda a lógica de cada rota dentro do próprio callback, sem
// depender de helpers de nível de módulo (mesmo padrão já usado em
// self-register-company.pb.js, que nunca teve esse problema).

// Item A8 da auditoria de 24/10/2026 (aprovado pelo Diego): a tela de convite
// é pública (só precisa do link), então devolve apenas o que a pessoa precisa
// para se reconhecer: nome, cargo, empresa e o e-mail parcialmente escondido.
// CPF e telefone não saem mais. A busca vai direto no usuário do convite (antes
// percorria todos os usuários a cada abertura).
routerAdd("POST", "/api/custom/get-invite-details", (e) => {
  try {
    const data = new DynamicModel({ token: "" });
    e.bindBody(data);

    const cleanToken = String(data.token || "").trim();
    let user = null;
    if (cleanToken) {
      try {
        const found = $app.findFirstRecordByFilter("users", "password_reset_token = {:t}", { t: cleanToken });
        const expires = found.get("password_reset_expires");
        if (expires && new Date(String(expires).replace(" ", "T")).getTime() >= Date.now()) user = found;
      } catch (_) { user = null; }
    }

    if (!user) {
      throw new BadRequestError("Link de convite inválido ou expirado.");
    }

    // jo***@gmail.com: dá para reconhecer o próprio e-mail sem expor o endereço.
    const email = String(user.get("email") || "");
    const [antes, depois] = email.split("@");
    const emailEscondido = depois ? `${antes.slice(0, 2)}***@${depois}` : "";

    let nome = user.get("name");
    const funcionarioId = user.get("funcionario_id");
    if (funcionarioId) {
      try { nome = $app.findRecordById("funcionarios", funcionarioId).get("nome") || nome; } catch (_) { /* funcionário excluído */ }
    }
    let empresa = "";
    try { empresa = $app.findRecordById("companies", user.get("company_id")).get("name"); } catch (_) {}

    return e.json(200, {
      success: true,
      name: nome,
      email: emailEscondido,
      username: user.get("username"),
      id_unico: user.get("id_unico"),
      cargo: user.get("cargo"),
      empresa,
    });
  } catch (err) {
    if (err instanceof BadRequestError || (err && typeof err.status === "number")) {
      throw err;
    }
    throw new BadRequestError("Link de convite inválido ou expirado.");
  }
})

// Confirma os dados (implícito: o funcionário só chega aqui vendo a tela
// anterior) e define a senha definitiva. Marca o usuário como "Ativo" e
// invalida o token para não poder ser reusado.
routerAdd("POST", "/api/custom/activate-invite", (e) => {
  try {
    const data = new DynamicModel({ token: "", password: "", passwordConfirm: "", username: "" });
    e.bindBody(data);

    const password = String(data.password || "");
    const passwordConfirm = String(data.passwordConfirm || "");

    if (password.length < 8) {
      throw new BadRequestError("A senha deve ter pelo menos 8 caracteres.");
    }
    if (password !== passwordConfirm) {
      throw new BadRequestError("As senhas não conferem.");
    }

    const cleanToken = String(data.token || "").trim();
    let user = null;
    if (cleanToken) {
      try {
        const found = $app.findFirstRecordByFilter("users", "password_reset_token = {:t}", { t: cleanToken });
        const expires = found.get("password_reset_expires");
        if (expires && new Date(String(expires).replace(" ", "T")).getTime() >= Date.now()) user = found;
      } catch (_) { user = null; }
    }

    if (!user) {
      throw new BadRequestError("Link de convite inválido ou expirado.");
    }

    // A pessoa escolhe o próprio nome de usuário (a sugestão veio do convite).
    const ulib = require(`${__hooks}/usuario-lib.js`);
    const username = ulib.normaliza(data.username);
    if (username && username !== ulib.normaliza(user.get("username"))) {
      ulib.confere($app, username, user.id);
      user.set("username", username);
    }

    user.set("password", password);
    user.set("passwordConfirm", passwordConfirm);
    user.set("password_reset_token", "");
    user.set("password_reset_expires", "");
    user.set("status", "Ativo");
    user.set("is_active", true);

    try {
      $app.save(user);
    } catch (err) {
      throw new BadRequestError("Erro ao ativar a conta: " + err.message);
    }

    return e.json(200, { success: true });
  } catch (err) {
    if (err instanceof BadRequestError || (err && typeof err.status === "number")) {
      throw err;
    }
    throw new BadRequestError("Link de convite inválido ou expirado.");
  }
})
