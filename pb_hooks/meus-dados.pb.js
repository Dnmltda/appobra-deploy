/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Quem muda o quê nos dados das pessoas (pedido do Diego, 21/10/2026).
//  - Meu Perfil (a própria conta em users): a pessoa muda só o simples —
//    nome de login, telefone, foto e senha. E-mail e ID nunca mudam; nome
//    completo, cargo, empresa, situação e vínculo com o funcionário só pelo
//    administrador (no cadastro da pessoa).
//  - Cadastro de funcionário (funcionarios): antes qualquer pessoa da empresa
//    alterava qualquer cadastro (CPF, salário...). Agora:
//      Administrador, RH e Mestre de Obras: cadastram e editam;
//      Diretoria, Gerência, Engenheiro e Almoxarife: só colocam/tiram da obra;
//      os demais cargos: nada.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    require(`${__hooks}/dono-lib.js`).garantir(app);
    const DONO = '@request.auth.dono_sistema = true';
    const ADMIN = '@request.auth.cargo = "Administrador" || @request.auth.role = "admin" || @request.auth.role = "Administrador"';
    const CADASTRA = `(${ADMIN} || @request.auth.cargo = "RH" || @request.auth.cargo = "Mestre de Obras")`;
    const OBRA = `(${CADASTRA.slice(1, -1)} || @request.auth.cargo = "Diretoria" || @request.auth.cargo = "Gerência"` +
      ' || @request.auth.cargo = "Engenheiro" || @request.auth.cargo = "Almoxarife")';
    const col = app.findCollectionByNameOrId("funcionarios");
    col.createRule = `(@request.auth.id != "" && @request.auth.company_id = company_id && ${CADASTRA}) || ${DONO}`;
    col.updateRule = `(@request.auth.id != "" && @request.auth.company_id = company_id && ${OBRA}) || ${DONO}`;
    app.save(col);
    console.log("[meus-dados] Cadastro de funcionário: só a gestão de pessoas altera.");
  } catch (err) {
    console.log("[meus-dados] Erro:", err);
  }
});

// Meu Perfil: na própria conta, o que não é "simples" volta ao que era.
onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser() && a.id === e.record.id) {
    const o = e.record.original();
    ["email", "name", "id_unico", "company_id", "cargo", "role", "status", "funcionario_id", "perfil_acesso", "is_active", "is_blocked"]
      .forEach((f) => { if (e.record.collection().fields.getByName(f)) e.record.set(f, o.get(f)); });
  }
  e.next();
}, "users");

// Cadastro de funcionário: quem só mexe na equipe da obra muda só a obra.
onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser() && !(a.get("dono_sistema") === true)) {
    const cargo = a.get("cargo") || a.get("role");
    const cadastra = ["Administrador", "RH", "Mestre de Obras"].includes(cargo) || a.get("role") === "admin" || a.get("role") === "Administrador";
    if (!cadastra) {
      const o = e.record.original();
      const campos = e.record.collection().fields;
      for (let i = 0; i < campos.length; i++) {
        const n = campos[i].name;
        if (!["obraId", "updated", "id"].includes(n)) e.record.set(n, o.get(n));
      }
    }
  }
  e.next();
}, "funcionarios");

// Meu Perfil, dados de RH (auditoria de 24/10/2026, item M6, aprovado pelo
// Diego em 25/10/2026): CPF, RG, obra, departamento, centro de custo, datas de
// admissão/demissão, observações e arquivamento só pelo administrador. Mudar
// na própria conta é recusado e vira tentativa (sino do titular e do responsável).
onRecordUpdateRequest((e) => {
  const a = e.auth;
  if (a && !a.isSuperuser() && a.id === e.record.id) {
    const admin = a.get("dono_sistema") === true || a.get("cargo") === "Administrador" || a.get("role") === "admin" || a.get("role") === "Administrador";
    if (!admin) {
      const o = e.record.original();
      const campos = e.record.collection().fields;
      const mudou = ["cpf", "rg", "obra_vinculada_id", "departamento", "centro_custo", "nome_completo", "data_admissao",
        "data_demissao", "observacoes", "deleted_at"]
        .filter((f) => campos.getByName(f) && String(e.record.get(f) || "") !== String(o.get(f) || ""));
      if (mudou.length) {
        require(`${__hooks}/nada-se-apaga-lib.js`).registrarTentativa(e.app, a, "editar", "users", a.id,
          `Tentou mudar no próprio cadastro: ${mudou.join(", ")}`);
        throw new ForbiddenError("Esses dados (CPF, RG, obra, departamento, centro de custo...) só o administrador altera.");
      }
    }
  }
  e.next();
}, "users");
