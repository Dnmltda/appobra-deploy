/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Criar acesso com um e-mail que já foi usado (correção de 19/10/2026).
//
// Excluir um acesso não apaga o registro: ele fica "Inativo" (o histórico
// continua com o nome). Só que o e-mail continuava preso nele, e o PocketBase
// não aceita dois acessos com o mesmo e-mail. Resultado: recadastrar alguém
// que saiu — ou tentar de novo quando o convite não chegou — dava
// "Failed to create record." e o convite nunca saía.
//
// Agora, ao criar um acesso:
//  - se o e-mail está num acesso INATIVO da mesma empresa (excluído ou
//    convite não aceito), esse acesso antigo libera o e-mail (vira
//    arquivado.<id>@arquivado.invalid), o link de convite antigo deixa de
//    valer, e o novo acesso é criado normalmente, com convite novo; se o
//    antigo era do MESMO funcionário, o número (id_unico) passa para o novo
//    (senão dava "Value must be unique" em company_id/id_unico);
//  - se está num acesso ATIVO da mesma empresa: mensagem clara;
//  - se está em outra empresa: mensagem clara, sem dizer qual.
// Tudo numa transação: se o novo acesso falhar, o antigo fica como estava.
// ============================================================

onRecordCreateRequest((e) => {
  const a = e.auth;
  const email = String(e.record.get("email") || "").trim().toLowerCase();
  if (!email || (a && a.isSuperuser())) return e.next();
  const empresa = e.record.get("company_id") || (a ? a.get("company_id") : "");

  let existentes = [];
  try {
    existentes = e.app.findRecordsByFilter("users", "email = {:e}", "", 10, 0, { e: email });
  } catch (_) {}
  if (!existentes.length) return e.next();

  for (let i = 0; i < existentes.length; i++) {
    const u = existentes[i];
    if (u.get("company_id") !== empresa) {
      throw new BadRequestError("Este e-mail já é usado em outra empresa no APP OBRA. Use outro e-mail.");
    }
    if (u.get("status") === "Ativo") {
      throw new BadRequestError(`Já existe um acesso ativo com este e-mail (${u.get("name") || u.get("username")}). ` +
        "Use outro e-mail ou edite o acesso em Gestão de Acessos.");
    }
  }

  e.app.runInTransaction((txApp) => {
    existentes.forEach((u) => {
      const antigo = txApp.findRecordById("users", u.id);
      antigo.set("email", `arquivado.${antigo.id}@arquivado.invalid`);
      antigo.set("password_reset_token", "");
      antigo.set("password_reset_expires", "");
      antigo.set("verified", false);
      // Mesmo funcionário (reenviar convite, recriar acesso): o número da
      // pessoa passa para o acesso novo; o antigo fica marcado como arquivado.
      // Pessoa diferente (recontratada com cadastro novo): cada um mantém o seu.
      const func = e.record.get("funcionario_id");
      if (func && antigo.get("funcionario_id") === func) antigo.set("id_unico", "ARQ-" + antigo.id);
      txApp.save(antigo);
      console.log(`[acesso-email-reuso] acesso inativo ${antigo.id} liberou o e-mail para um novo acesso.`);
    });
    e.app = txApp;
    e.next();
  });
}, "users");

// Funcionário novo com o e-mail de outro funcionário ativo da empresa: o
// número da pessoa vem do e-mail, então dava "ID já está em uso". Agora diz
// o que de fato está errado.
onRecordCreateRequest((e) => {
  const email = String(e.record.get("email") || "").trim().toLowerCase();
  const a = e.auth;
  if (email && !(a && a.isSuperuser())) {
    const empresa = e.record.get("company_id") || (a ? a.get("company_id") : "");
    let outros = [];
    try {
      outros = e.app.findRecordsByFilter("funcionarios", "company_id = {:c} && email = {:e} && deleted_at = ''", "", 1, 0, { c: empresa, e: email });
    } catch (_) {}
    if (outros.length) throw new BadRequestError(`Já existe um funcionário com este e-mail (${outros[0].get("nome")}). Use outro e-mail.`);
  }
  e.next();
}, "funcionarios");
