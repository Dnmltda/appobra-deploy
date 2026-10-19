/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// ID da pessoa = ordem de chegada na empresa (pedido do Diego, 18/10/2026).
//
// Quem abre a empresa é o 01; cada pessoa nova recebe o próximo número
// (02, 03...), não importa o cargo — o número mostra tempo de casa, não
// hierarquia. Regras:
//  - o número é dado pelo SERVIDOR no cadastro; o que a tela mandar é
//    ignorado (ninguém escolhe nem digita ID);
//  - é o mesmo número no cadastro de funcionário e no acesso ao sistema
//    (users.funcionario_id, ou o mesmo e-mail na mesma empresa);
//  - nunca muda depois e nunca é reaproveitado (quem saiu continua contando);
//  - quem volta (mesmo e-mail ou CPF de um cadastro arquivado) recupera o
//    número antigo; só o número de quem foi apagado de vez fica livre
//    (atualização de 19/10/2026).
//
// Substitui generate-user-id.pb.js (que só numerava os acessos) e o
// generateNextId das telas para funcionários ("FUN-000001").
// ============================================================

onRecordCreate((e) => {
  const r = e.record;
  const companyId = r.get("company_id");
  if (!companyId) {
    // Sem empresa (não deveria acontecer): número que não colide.
    r.set("id_unico", String(Date.now()).slice(-6));
    return e.next();
  }
  const lib = require(`${__hooks}/id-lib.js`);
  const ehUsuario = r.collection().name === "users";
  const mesmo = ehUsuario
    ? lib.idDaMesmaPessoa(e.app, "funcionarios", companyId, r.get("email"), r.get("funcionario_id"))
    : lib.idDaMesmaPessoa(e.app, "users", companyId, r.get("email"), "");
  const numero = mesmo || lib.idDeQuemJaFoiDaEmpresa(e.app, companyId, r.get("email"), r.get("cpf")) ||
    lib.proximoIdDaEmpresa(e.app, companyId);
  if (ehUsuario) lib.liberarNumeroDeAcessoAntigo(e.app, companyId, numero, r.id);
  r.set("id_unico", numero);
  // "ID do Funcionário" (matrícula) não se digita mais: é o mesmo número.
  if (!ehUsuario && !String(r.get("matricula") || "").trim()) r.set("matricula", numero);
  e.next();
}, "users", "funcionarios");

// O número não muda depois do cadastro (só o superusuário corrige).
onRecordUpdateRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    e.record.set("id_unico", e.record.original().get("id_unico"));
  }
  e.next();
}, "users", "funcionarios");
