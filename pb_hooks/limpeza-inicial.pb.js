/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Limpeza para começar "do real" (pedido do Diego, 18/10/2026).
//
// SÓ RODA se a variável LIMPEZA_INICIAL=sim estiver nos Secrets do Fly, e
// só UMA vez (deixa um registro "limpeza_inicial" na auditoria). Fazer o
// backup (snapshot do volume) ANTES. Depois de rodar, pode tirar a variável.
//
// Na empresa do dnmltda@hotmail.com:
//  1. apaga todos os acessos (users) menos o dnmltda@hotmail.com;
//  2. apaga todos os cadastros de funcionário;
//     (quem tem histórico — retirada, movimentação, compra... — é
//      arquivado: some das listas e o histórico continua com o nome)
//  3. o dnmltda@hotmail.com passa a ser o ID 01;
//  4. arquiva os materiais de exemplo que nunca tiveram movimentação e
//     estão com saldo zero (os que já foram usados ficam).
// Outras empresas não são tocadas.
// ============================================================

onBootstrap((e) => {
  e.next();
  if (String($os.getenv("LIMPEZA_INICIAL") || "").trim().toLowerCase() !== "sim") return;

  const log = (m) => console.log("[limpeza-inicial] " + m);
  try {
   // Tudo numa transação: ou faz tudo, ou nada.
   e.app.runInTransaction((app) => {
    const dono = app.findFirstRecordByFilter("users", "email = {:e}", { e: "dnmltda@hotmail.com" });
    const cid = dono.get("company_id");

    const feita = app.findRecordsByFilter("auditoria", 'acao = "limpeza_inicial"', "", 1, 0);
    if (feita.length) {
      log("já foi feita antes; nada a fazer. Pode remover LIMPEZA_INICIAL dos Secrets.");
      return;
    }

    const agora = new Date().toISOString().replace("T", " ");
    // Tem histórico? (qualquer registro de qualquer coleção apontando para ele)
    // Atenção: NÃO dá para "tentar apagar e, se falhar, arquivar" — dentro da
    // transação a exclusão que falha já apagou a linha e deixa o histórico
    // apontando para o nada (visto no teste local). Por isso decide antes.
    const relacoes = [];
    app.findAllCollections().forEach((col) => {
      const fs = col.fields;
      for (let i = 0; i < fs.length; i++) {
        const f = fs[i];
        const tipo = typeof f.type === "function" ? f.type() : f.type;
        if (tipo === "relation") relacoes.push({ col: col.name, campo: f.name, alvo: f.collectionId });
      }
    });
    const temHistorico = (rec) => {
      const alvo = rec.collection().id;
      return relacoes.some((r) => r.alvo === alvo && r.col !== rec.collection().name &&
        app.findRecordsByFilter(r.col, `${r.campo} ?= {:id}`, "", 1, 0, { id: rec.id }).length > 0);
    };
    const apagarOuArquivar = (rec, arquivar) => {
      if (temHistorico(rec)) {
        arquivar(rec);
        app.saveNoValidate(rec);
        return "arquivado";
      }
      app.delete(rec);
      return "apagado";
    };
    const conta = { apagado: 0, arquivado: 0 };

    // 1. acessos
    app.findRecordsByFilter("users", "company_id = {:c} && id != {:d}", "", 0, 0, { c: cid, d: dono.id }).forEach((u) => {
      conta[apagarOuArquivar(u, (r) => { r.set("status", "Inativo"); r.set("is_active", false); r.set("deleted_at", agora); })]++;
    });
    log(`acessos: ${conta.apagado} apagado(s), ${conta.arquivado} inativado(s).`);

    // 2. funcionários
    const cf = { apagado: 0, arquivado: 0 };
    app.findRecordsByFilter("funcionarios", "company_id = {:c}", "", 0, 0, { c: cid }).forEach((f) => {
      cf[apagarOuArquivar(f, (r) => { r.set("status", "Inativo"); r.set("deleted_at", agora); })]++;
    });
    log(`funcionários: ${cf.apagado} apagado(s), ${cf.arquivado} arquivado(s).`);

    // 3. dono é o 01
    dono.set("id_unico", "01");
    if (dono.get("funcionario_id")) {
      try { app.findRecordById("funcionarios", dono.get("funcionario_id")); } catch (_) { dono.set("funcionario_id", ""); }
    }
    app.saveNoValidate(dono);
    log("dnmltda@hotmail.com agora é o ID 01.");

    // 4. materiais de exemplo nunca usados
    let arquivados = 0;
    app.findRecordsByFilter("materiais", 'company_id = {:c} && deleted_at = ""', "", 0, 0, { c: cid }).forEach((m) => {
      if (Number(m.get("quantity_in_stock") || 0) !== 0) return;
      const usado = app.findRecordsByFilter("movimentacoes", "material_id = {:m}", "", 1, 0, { m: m.id }).length > 0;
      if (usado) return;
      m.set("deleted_at", agora);
      m.set("status", "inactive");
      app.saveNoValidate(m);
      arquivados++;
    });
    log(`materiais: ${arquivados} de exemplo arquivado(s) (sem movimentação e com saldo zero).`);

    const marca = new Record(app.findCollectionByNameOrId("auditoria"));
    marca.set("acao", "limpeza_inicial");
    marca.set("modulo", "sistema");
    marca.set("usuarioId", dono.id);
    marca.set("usuario", "sistema");
    marca.set("company_id", cid);
    marca.set("detalhes", JSON.stringify({ acessos: conta, funcionarios: cf, materiais_arquivados: arquivados }));
    app.save(marca);
    log("concluída. Pode remover LIMPEZA_INICIAL dos Secrets.");
   });
  } catch (err) {
    log("ERRO, nada mais foi feito: " + err);
  }
});
