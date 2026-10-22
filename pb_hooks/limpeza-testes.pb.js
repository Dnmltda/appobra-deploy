/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Limpeza dos dados de teste (pedido do Diego, 21/10/2026: "apague tudo, só
// deixe o meu"). Roda UMA VEZ, só quando o Diego coloca LIMPEZA_TESTES=sim
// nos Secrets do Fly (e depois tira). Fica marcado no banco que já rodou
// (tabela sistema_execucoes): mesmo com a variável esquecida, não roda de novo.
//
//  1. Backup completo do banco em pb_data/backups (aparece no painel /_/).
//  2. Fica: a conta do titular (dono do sistema), a empresa dele e a empresa
//     "Construtora Teste DNM (não apagar)" com tudo dela. Superusuários e o
//     catálogo de cargos não são mexidos.
//  3. Sai: todas as outras empresas e, em todas as tabelas com empresa, todos
//     os registros que não são dessas duas (na empresa do titular, tudo menos
//     a conta dele), além dos registros sem empresa.
//  4. A empresa do titular passa a se chamar "DNM&LTDA OBRAS", a conta dele
//     ganha o nome e o ID 00; a empresa de teste fica sem limites.
// Tudo numa transação: ou faz tudo, ou nada.
// ============================================================

onBootstrap((e) => {
  e.next();
  if (String($os.getenv("LIMPEZA_TESTES") || "").trim().toLowerCase() !== "sim") return;
  const app = e.app;
  const log = (m) => console.log(`[limpeza-testes] ${m}`);
  const MARCA = "limpeza-testes-2026-10";
  const TESTE = "Construtora Teste DNM (não apagar)";
  try {
    let exec = null;
    try { exec = app.findCollectionByNameOrId("sistema_execucoes"); } catch (_) {}
    if (!exec) {
      exec = new Collection({ type: "base", name: "sistema_execucoes", listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [{ name: "nome", type: "text", required: true }, { name: "detalhes", type: "text" }, { name: "created", type: "autodate", onCreate: true }],
        indexes: ["CREATE UNIQUE INDEX idx_sistema_execucoes_nome ON sistema_execucoes (nome)"] });
      app.save(exec);
    }
    if (app.findRecordsByFilter("sistema_execucoes", "nome = {:n}", "", 1, 0, { n: MARCA }).length) {
      log("já rodou antes; nada a fazer. Pode tirar LIMPEZA_TESTES dos Secrets do Fly.");
      return;
    }
    let dono;
    try { dono = app.findFirstRecordByFilter("users", "dono_sistema = true"); } catch (_) {}
    if (!dono) { log("Erro: conta do titular não encontrada. Nada foi apagado."); return; }
    const manter = dono.get("company_id");
    const testes = app.findRecordsByFilter("companies", "name = {:n}", "", 1, 0, { n: TESTE });
    const teste = testes.length ? testes[0].id : "--nenhuma--";

    const arquivo = `antes-limpeza-testes-${new Date().toISOString().slice(0, 10)}.zip`;
    app.createBackup(new Context(), arquivo);
    log(`backup completo gravado: ${arquivo} (painel /_/ → Settings → Backups).`);

    const resumo = [];
    app.runInTransaction((tx) => {
      const nomes = (sql, b) => { const r = arrayOf(new DynamicModel({ t: "" })); tx.db().newQuery(sql).bind(b).all(r); return r.map((x) => x.t); };
      const sai = { t: teste, d: dono.id };
      ["obras", "funcionarios", "users"].forEach((c) => {
        const campo = c === "obras" ? "nome" : c === "funcionarios" ? "COALESCE(nome_completo, nome)" : "email";
        try {
          nomes(`SELECT ${campo} AS t FROM ${c} WHERE COALESCE(company_id, '') != {:t} AND id != {:d}`, sai)
            .forEach((n) => log(`sai de ${c}: ${n}`));
        } catch (_) {}
      });
      app.findAllCollections().forEach((col) => {
        if (col.type === "view" || col.system || col.name === "companies" || !col.fields.getByName("company_id")) return;
        const r = tx.db().newQuery(`DELETE FROM ${col.name} WHERE COALESCE(company_id, '') != {:t} AND id != {:d}`).bind(sai).execute();
        const n = r.rowsAffected();
        if (n) resumo.push(`${col.name}: ${n}`);
      });
      nomes("SELECT name AS t FROM companies WHERE id != {:m} AND id != {:t}", { m: manter, t: teste }).forEach((n) => log(`sai a empresa: ${n}`));
      const rc = tx.db().newQuery("DELETE FROM companies WHERE id != {:m} AND id != {:t}").bind({ m: manter, t: teste }).execute();
      if (rc.rowsAffected()) resumo.push(`companies: ${rc.rowsAffected()}`);

      const empresa = tx.findRecordById("companies", manter);
      empresa.set("name", "DNM&LTDA OBRAS");
      tx.save(empresa);
      const d = tx.findRecordById("users", dono.id);
      if (!String(d.get("name") || "").trim()) d.set("name", "DIEGO NASCIMENTO DE MORAES");
      d.set("id_unico", "00");
      tx.save(d);
      if (testes.length) {
        const t = tx.findRecordById("companies", teste);
        ["limite_usuarios", "limite_funcionarios", "limite_materiais", "limite_obras"].forEach((n) => { if (t.collection().fields.getByName(n)) t.set(n, 0); });
        tx.save(t);
      }
      const m = new Record(tx.findCollectionByNameOrId("sistema_execucoes"));
      m.set("nome", MARCA);
      m.set("detalhes", `backup ${arquivo}; apagados: ${resumo.join(", ") || "nada"}`);
      tx.save(m);
    });
    log(`concluída. Apagados: ${resumo.join(", ") || "nada"}. Titular: ${dono.get("email")} (ID 00), empresa "DNM&LTDA OBRAS".`);
    log("Pode tirar LIMPEZA_TESTES dos Secrets do Fly.");
  } catch (err) {
    console.log("[limpeza-testes] Erro (nada foi apagado):", err);
  }
});
