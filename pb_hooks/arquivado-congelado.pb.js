/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Cadastro excluído (arquivado) não volta a mudar (pendência anotada em
// 03/11/2026: funcionário com deleted_at e status "Ativo"). O "Excluir" já
// arquiva e põe Inativo (seguranca-etapa1.pb.js), mas uma tela que ainda
// estava com o cadastro aberto podia gravar por cima e deixar o arquivado
// como "Ativo". Não existe "restaurar" no app, então:
//  - pela API, ninguém (só o suporte) altera um registro arquivado; a
//    tentativa fica registrada, como nas outras travas;
//  - na subida do servidor, o que já está arquivado e aparece como ativo
//    passa para o status de inativo (Demitido, Descartado, Sucata... ficam).
// ============================================================

onBootstrap((e) => {
  e.next();
  const ATIVOS = {
    funcionarios: ["Inativo", ["Ativo", "Afastado"]],
    materiais: ["inactive", ["active"]],
    equipamentos: ["inactive", ["available", "in_use", "maintenance"]],
    epis: ["Inativo", ["Ativo", "Disponível", "Em uso"]],
    empresas: ["Inativo", ["Ativo"]],
    clientes: ["Inativo", ["Ativo"]],
    veiculos: ["Inativo", ["Ativo", "Manutenção"]],
  };
  Object.keys(ATIVOS).forEach((nome) => {
    try {
      const col = e.app.findCollectionByNameOrId(nome);
      if (!col.fields.getByName("deleted_at") || !col.fields.getByName("status")) return;
      const [inativo, ativos] = ATIVOS[nome];
      const n = e.app.db().newQuery(
        `UPDATE ${nome} SET status = {:i} WHERE COALESCE(deleted_at, '') != '' AND status IN (${ativos.map((_, k) => `{:a${k}}`).join(", ")})`)
        .bind(Object.assign({ i: inativo }, ...ativos.map((a, k) => ({ [`a${k}`]: a })))).execute().rowsAffected();
      if (n) console.log(`[arquivado-congelado] ${nome}: ${n} arquivado(s) que apareciam como ativos passaram para "${inativo}".`);
    } catch (_) {} // tabela ainda não existe neste banco
  });
});

onRecordUpdateRequest((e) => {
  if (e.auth && e.auth.isSuperuser()) return e.next();
  const o = e.record.original();
  if (String(o.get("deleted_at") || "").trim()) {
    const nada = require(`${__hooks}/nada-se-apaga-lib.js`);
    const nome = e.record.collection().name;
    const rotulo = o.get("nome") || o.get("name") || o.get("nome_completo") || o.get("placa") || o.id;
    nada.registrarTentativa($app, e.auth, "alterar", nome, o.id, `Alterar o registro de ${nome} "${rotulo}", que já foi excluído (arquivado)`);
    throw new ForbiddenError("Este cadastro foi excluído e não pode mais ser alterado.");
  }
  e.next();
}, "materiais", "funcionarios", "empresas", "epis", "equipamentos", "fornecedores", "clientes", "veiculos",
   "solicitacoes", "compras", "propostas", "contas_receber", "treinamentos",
   "notificacoes", "obra_mensagens", "solicitacoes_anexos", "compras_anexos");
