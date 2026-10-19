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

routerAdd("POST", "/api/custom/get-invite-details", (e) => {
  try {
    const data = new DynamicModel({ token: "" });
    e.bindBody(data);

    const cleanToken = String(data.token || "").trim();
    let user = null;
    if (cleanToken) {
      let allUsers = [];
      try {
        allUsers = $app.findAllRecords("users") || [];
      } catch (err) {
        allUsers = [];
      }
      const found = allUsers.find((u) => {
        if (!u) return false;
        const t = u.get("password_reset_token");
        return !!t && String(t) === cleanToken;
      });
      if (found) {
        const expires = found.get("password_reset_expires");
        if (expires && new Date(expires).getTime() >= Date.now()) {
          user = found;
        }
      }
    }

    if (!user) {
      throw new BadRequestError("Link de convite inválido ou expirado.");
    }

    let funcionario = null;
    const funcionarioId = user.get("funcionario_id");
    if (funcionarioId) {
      try {
        const funcCol = $app.findCollectionByNameOrId("funcionarios");
        const funcRecord = $app.findRecordById(funcCol, funcionarioId);
        funcionario = {
          nome: funcRecord.get("nome"),
          cpf: funcRecord.get("cpf"),
          cargo: user.get("cargo"),
          departamento: funcRecord.get("departamento"),
          telefone: funcRecord.get("telefone"),
        };
      } catch (err) {
        // Funcionário pode ter sido excluído depois do convite — segue só com os dados do usuário.
      }
    }

    return e.json(200, {
      success: true,
      name: user.get("name"),
      email: user.get("email"),
      username: user.get("username"),
      cargo: user.get("cargo"),
      telefone: user.get("telefone"),
      funcionario,
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
    const data = new DynamicModel({ token: "", password: "", passwordConfirm: "" });
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
      let allUsers = [];
      try {
        allUsers = $app.findAllRecords("users") || [];
      } catch (err) {
        allUsers = [];
      }
      const found = allUsers.find((u) => {
        if (!u) return false;
        const t = u.get("password_reset_token");
        return !!t && String(t) === cleanToken;
      });
      if (found) {
        const expires = found.get("password_reset_expires");
        if (expires && new Date(expires).getTime() >= Date.now()) {
          user = found;
        }
      }
    }

    if (!user) {
      throw new BadRequestError("Link de convite inválido ou expirado.");
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
