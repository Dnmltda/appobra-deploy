/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Zerar os dados de teste da DNM&LTDA OBRAS (pedido do Diego, 27/11/2026,
// depois do deploy do PR #30). Roda UMA VEZ, na primeira subida do servidor
// com este arquivo; fica marcado em sistema_execucoes e não roda de novo.
// Fazer o snapshot do volume appobra_data ANTES do deploy.
//
// Só a empresa n5n4xt3qq5bn1ld ("DNM&LTDA OBRAS"). A "Construtora Teste DNM
// (não apagar)" e qualquer outra empresa não são tocadas.
//  - Fica só a conta do titular (dnmltda@hotmail.com, ID 00) e o cadastro de
//    funcionário ligado a ela (se houver). Saem os outros acessos e
//    funcionários.
//  - Sai todo o histórico de operação: movimentações, saldo de funcionário,
//    solicitações, compras, EPIs entregues/devolvidos, empréstimos, histórico
//    de equipamentos, financeiro, ocorrências, mural, avisos do sino,
//    auditoria, tentativas bloqueadas, estoque da obra etc. (lista SAI).
//  - Ficam os cadastros (lista FICA): obras e sua estrutura, materiais,
//    fornecedores, EPIs, equipamentos, veículos, centros de custo, clientes,
//    catálogo de serviços. O estoque dos materiais e dos EPIs volta a 0, o
//    andamento dos serviços volta a "Não iniciado", equipamento "em uso"
//    volta a "disponível", e o que apontava para contas/funcionários que
//    saíram fica em branco.
//  - Os números (MOV-…, SOL-…, IDs 01, 02…) saem do que existe na empresa,
//    então recomeçam sozinhos.
// É uma limpeza interna do servidor, direto no banco: não passa pela API, e
// por isso não abre exceção nas travas da API (saldo_funcionario continua
// sem edição/exclusão/lançamento direto por ninguém).
// Tudo numa transação: ou faz tudo, ou nada. Antes, backup em pb_data/backups;
// se o backup falhar, nada é apagado.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  const EMPRESA = "n5n4xt3qq5bn1ld";
  const NAO_TOCAR = "xjygcrc2utiidb1";
  const TITULAR = "dnmltda@hotmail.com";
  const MARCA = "limpeza-dnm-obras-2026-11";
  const SAI = [
    "movimentacoes", "saldo_funcionario", "estoque_obra",
    "solicitacoes", "solicitacoes_itens", "solicitacoes_anexos", "solicitacoes_aprovacao", "solicitacoes_compra",
    "compras", "compras_itens", "compras_aprovacao", "compras_recebimento", "compras_anexos",
    "pedidos_compra", "aprovacoes_compra", "recebimentos", "notas_fiscais",
    "audit_logs", "auditoria", "historico_alteracoes", "tentativas_bloqueadas",
    "epi_funcionario", "epi_entrega", "epis_entregas", "epis_devolucoes", "epis_reposicoes", "epis_historico",
    "emprestimos", "equipamentos_historico", "equipamentos_manutencao",
    "ocorrencias", "obra_mensagens", "qrcode_leituras", "qr_scans", "perdas_ganhos",
    "treinamentos", "documentos", "escala_funcionario", "equipe_funcionario", "motoristas",
    "contas_pagar", "contas_receber", "receitas", "despesas", "fluxo_caixa", "financeiro", "propostas",
    "abastecimentos", "manutencoes", "licenciamentos", "quilometragem",
  ];
  const FICA = [
    "obras", "obras_andares", "obras_unidades", "obras_unidade_servicos", "servicos_padrao",
    "materiais", "fornecedores", "epis", "equipamentos", "veiculos", "veiculo",
    "centro_custos", "clientes", "roles", "equipes", "escalas", "documentos_central", "qr_codes",
    "empresa", "empresas",
  ];
  const log = (m) => console.log(`[limpeza-dnm-obras] ${m}`);
  if (EMPRESA === NAO_TOCAR) return;
  try {
    let empresa = null;
    try { empresa = app.findRecordById("companies", EMPRESA); } catch (_) {}
    if (!empresa) return; // banco sem a empresa (ex.: testes locais): nada a fazer

    let exec = null;
    try { exec = app.findCollectionByNameOrId("sistema_execucoes"); } catch (_) {}
    if (!exec) {
      exec = new Collection({ type: "base", name: "sistema_execucoes", listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
        fields: [{ name: "nome", type: "text", required: true }, { name: "detalhes", type: "text" }, { name: "created", type: "autodate", onCreate: true }],
        indexes: ["CREATE UNIQUE INDEX idx_sistema_execucoes_nome ON sistema_execucoes (nome)"] });
      app.save(exec);
    }
    if (app.findRecordsByFilter("sistema_execucoes", "nome = {:n}", "", 1, 0, { n: MARCA }).length) return; // já rodou

    const titulares = app.findRecordsByFilter("users", "company_id = {:c} && email = {:e}", "", 2, 0, { c: EMPRESA, e: TITULAR });
    if (titulares.length !== 1) { log(`Erro: conta ${TITULAR} não encontrada nesta empresa. Nada foi apagado.`); return; }
    const dono = titulares[0];
    const funcDono = String(dono.get("funcionario_id") || "");

    const arquivo = `antes-limpeza-dnm-obras-${new Date().toISOString().slice(0, 10)}.zip`;
    try {
      app.createBackup(new Context(), arquivo);
      log(`backup completo gravado: ${arquivo}`);
    } catch (err) {
      log(`Erro no backup (${err}). Nada foi apagado.`);
      return;
    }

    const tipo = (f) => (typeof f.type === "function" ? f.type() : f.type);
    const temCampo = (col, n) => !!col.fields.getByName(n);
    const colecoes = {};
    app.findAllCollections().forEach((c) => { colecoes[c.name] = c; });
    const porId = {};
    Object.keys(colecoes).forEach((n) => { porId[colecoes[n].id] = colecoes[n]; });
    const temArquivo = (col) => { const fs = col.fields; for (let i = 0; i < fs.length; i++) if (tipo(fs[i]) === "file") return true; return false; };

    const resumo = [];
    const arquivos = []; // pastas de arquivos de registros apagados
    app.runInTransaction((tx) => {
      const ids = (sql, b) => { const r = arrayOf(new DynamicModel({ id: "" })); tx.db().newQuery(sql).bind(b).all(r); return r.map((x) => x.id); };
      const exec = (sql, b) => tx.db().newQuery(sql).bind(b || {}).execute().rowsAffected();
      const apagar = (nome, onde, b) => {
        const col = colecoes[nome];
        if (!col || col.type === "view") return;
        if (temArquivo(col)) ids(`SELECT id FROM ${nome} WHERE ${onde}`, b).forEach((id) => arquivos.push(`${col.id}/${id}`));
        const n = exec(`DELETE FROM ${nome} WHERE ${onde}`, b);
        if (n) resumo.push(`${nome}: ${n}`);
      };
      const c = { c: EMPRESA, d: dono.id, f: funcDono };

      // Contas que saem (todas da empresa menos a do titular).
      const saemUsers = ids("SELECT id FROM users WHERE company_id = {:c} AND id != {:d}", c);
      const usersEmpresa = ids("SELECT id FROM users WHERE company_id = {:c}", c);
      const lista = (l) => (l.length ? l.map((x) => `'${String(x).replace(/'/g, "")}'`).join(",") : "''");

      // 1. Histórico de operação.
      SAI.forEach((n) => { if (colecoes[n] && temCampo(colecoes[n], "company_id")) apagar(n, "company_id = {:c}", c); });
      // Avisos do sino e relatórios exportados das contas da empresa (não têm empresa).
      if (colecoes.notificacoes) apagar("notificacoes", `usuarioId IN (${lista(usersEmpresa)})`, {});
      if (colecoes.relatorios_exportados) apagar("relatorios_exportados", `usuario_id IN (${lista(usersEmpresa)})`, {});

      // 2. Funcionários e contas de teste.
      const saemFunc = ids("SELECT id FROM funcionarios WHERE company_id = {:c} AND id != {:f}", c);
      apagar("funcionarios", "company_id = {:c} AND id != {:f}", c);
      apagar("users", "company_id = {:c} AND id != {:d}", c);
      ["_authOrigins", "_externalAuths", "_mfas", "_otps"].forEach((n) => {
        if (!colecoes[n] || !saemUsers.length) return;
        const r = exec(`DELETE FROM ${n} WHERE collectionRef = {:u} AND recordRef IN (${lista(saemUsers)})`, { u: colecoes.users.id });
        if (r) resumo.push(`${n}: ${r}`);
      });
      // QR codes de funcionários/registros que saíram.
      if (colecoes.qr_codes && saemFunc.length) apagar("qr_codes", `company_id = {:c} AND entity_id IN (${lista(saemFunc)})`, c);

      // 3. Cadastros que ficam: estoque e andamento voltam ao começo.
      const zerar = (nome, sets) => {
        const col = colecoes[nome];
        if (!col) return;
        const partes = Object.keys(sets).filter((k) => temCampo(col, k)).map((k) => `${k} = ${sets[k]}`);
        if (!partes.length) return;
        const n = exec(`UPDATE ${nome} SET ${partes.join(", ")} WHERE company_id = {:c}`, c);
        if (n) resumo.push(`${nome} (zerado): ${n}`);
      };
      zerar("materiais", { quantity_in_stock: "0", alerta_minimo_enviado: "FALSE" });
      zerar("epis", { quantidade_estoque: "0" });
      if (colecoes.epis) exec("UPDATE epis SET status = 'Disponível' WHERE company_id = {:c} AND status = 'Em uso'", c);
      if (colecoes.equipamentos) {
        exec("UPDATE equipamentos SET status = 'available' WHERE company_id = {:c} AND status = 'in_use'", c);
        if (temCampo(colecoes.equipamentos, "funcionario_id")) exec("UPDATE equipamentos SET funcionario_id = '' WHERE company_id = {:c}", c);
      }
      zerar("obras_unidade_servicos", { status: "'Não iniciado'", alterado_por: "''", alterado_em: "''" });
      if (colecoes.obras && temCampo(colecoes.obras, "tipo_estrutura")) {
        exec("UPDATE obras SET progress_percentage = 0 WHERE company_id = {:c} AND tipo_estrutura IN ('Prédio', 'Casa')", c);
      }

      // 4. O que ficou e apontava para algo que saiu fica em branco.
      const limpar = (nome, onde) => {
        const col = colecoes[nome];
        if (!col) return;
        const fs = col.fields;
        for (let i = 0; i < fs.length; i++) {
          const f = fs[i];
          if (tipo(f) !== "relation" || !porId[f.collectionId]) continue;
          const alvo = porId[f.collectionId].name;
          if (alvo === "companies") continue;
          const n = f.maxSelect > 1
            ? exec(`UPDATE ${nome} SET ${f.name} = (SELECT COALESCE(json_group_array(j.value), '[]') FROM json_each(${nome}.${f.name}) j WHERE j.value IN (SELECT id FROM ${alvo}))
                    WHERE ${onde} AND json_valid(${f.name}) AND EXISTS (SELECT 1 FROM json_each(${nome}.${f.name}) j WHERE j.value NOT IN (SELECT id FROM ${alvo}))`, c)
            : exec(`UPDATE ${nome} SET ${f.name} = '' WHERE ${onde} AND COALESCE(${f.name}, '') != '' AND ${f.name} NOT IN (SELECT id FROM ${alvo})`, c);
          if (n) resumo.push(`${nome}.${f.name} (em branco): ${n}`);
        }
      };
      FICA.forEach((n) => { if (colecoes[n] && temCampo(colecoes[n], "company_id")) limpar(n, "company_id = {:c}"); });
      limpar("users", "company_id = {:c}");
      limpar("funcionarios", "company_id = {:c}");
      limpar("companies", "id = {:c}");

      // Tabelas da empresa que não estão em nenhuma lista: não mexe, só avisa.
      Object.keys(colecoes).forEach((n) => {
        const col = colecoes[n];
        if (col.type === "view" || col.system || SAI.includes(n) || FICA.includes(n) || ["users", "funcionarios", "companies"].includes(n)) return;
        if (!temCampo(col, "company_id")) return;
        const r = arrayOf(new DynamicModel({ n: 0 }));
        tx.db().newQuery(`SELECT COUNT(*) AS n FROM ${n} WHERE company_id = {:c}`).bind(c).all(r);
        if (r.length && r[0].n) log(`não mexido (fora das listas): ${n} com ${r[0].n} registro(s)`);
      });

      const m = new Record(tx.findCollectionByNameOrId("sistema_execucoes"));
      m.set("nome", MARCA);
      m.set("detalhes", `backup ${arquivo}; ${resumo.join("; ") || "nada"}`.slice(0, 5000));
      tx.save(m);
    });

    // Fotos e anexos dos registros apagados (depois de gravar).
    let fotos = 0;
    if (arquivos.length) {
      let fsys = null;
      try {
        fsys = app.newFilesystem();
        arquivos.forEach((p) => { try { fsys.deletePrefix(p); fotos++; } catch (_) {} });
      } catch (err) {
        log(`aviso: arquivos antigos não apagados (${err})`);
      } finally {
        try { if (fsys) fsys.close(); } catch (_) {}
      }
    }
    log(`concluída. ${resumo.join("; ") || "nada a apagar"}; pastas de arquivos: ${fotos}.`);
    log(`ficou: conta ${TITULAR} (ID ${dono.get("id_unico")}) e os cadastros da empresa "${empresa.get("name")}".`);
  } catch (err) {
    console.log("[limpeza-dnm-obras] Erro (nada foi apagado):", err);
  }
});
