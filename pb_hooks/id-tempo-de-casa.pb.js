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
//  - nunca muda depois e nunca é reaproveitado (quem saiu continua contando).
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
  const { proximoIdDaEmpresa, idDaMesmaPessoa } = require(`${__hooks}/id-lib.js`);
  const ehUsuario = r.collection().name === "users";
  const mesmo = ehUsuario
    ? idDaMesmaPessoa(e.app, "funcionarios", companyId, r.get("email"), r.get("funcionario_id"))
    : idDaMesmaPessoa(e.app, "users", companyId, r.get("email"), "");
  r.set("id_unico", mesmo || proximoIdDaEmpresa(e.app, companyId));
  e.next();
}, "users", "funcionarios");

// O número não muda depois do cadastro (só o superusuário corrige).
onRecordUpdateRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    e.record.set("id_unico", e.record.original().get("id_unico"));
  }
  e.next();
}, "users", "funcionarios");
