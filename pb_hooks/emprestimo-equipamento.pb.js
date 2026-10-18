/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Etapa 4.2 (documento mestre, fluxo 2 — equipamento):
//   emprestar → (em uso) → receber de volta com conferência do estado.
//
// Usa a tabela antiga "emprestimos" (já existia, nenhuma tela usava), com
// campos novos em português. O servidor é quem muda a situação do
// equipamento, numa transação:
//   - Emprestar: só equipamento "Disponível" e sem outro empréstimo aberto;
//     o equipamento fica "Emprestado", com a pessoa e a obra.
//   - Receber de volta: escolhe o estado em que voltou:
//       Bom                     → Disponível
//       Precisa de manutenção   → Em Manutenção + manutenção corretiva agendada
//       Danificado              → Danificado
//       Perdido                 → Extraviado
//   - Cada passo grava o histórico do equipamento.
//   - Só a gestão (Administrador, Diretoria, Gerência, Engenheiro, Mestre de
//     Obras, Almoxarife) empresta e recebe.
//   - Enquanto houver empréstimo aberto, a situação do equipamento não muda
//     pela edição comum (só pela devolução).
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  try {
    const col = app.findCollectionByNameOrId("emprestimos");
    const add = (f) => { if (!col.fields.getByName(f.name)) col.fields.add(f); };
    add(new RelationField({ name: "funcionario_id", collectionId: app.findCollectionByNameOrId("funcionarios").id, maxSelect: 1 }));
    add(new RelationField({ name: "entregue_por", collectionId: "_pb_users_auth_", maxSelect: 1 }));
    add(new RelationField({ name: "recebido_por", collectionId: "_pb_users_auth_", maxSelect: 1 }));
    add(new SelectField({ name: "estado_devolucao", maxSelect: 1, values: ["Bom", "Precisa de manutenção", "Danificado", "Perdido"] }));
    add(new TextField({ name: "observacao_devolucao" }));
    // Previsão de devolução é opcional (nem todo empréstimo tem data certa).
    ["expected_return_date", "borrow_date"].forEach((n) => { const f = col.fields.getByName(n); if (f) f.required = false; });
    const SAME = '@request.auth.id != "" && @request.auth.company_id = company_id';
    col.listRule = SAME;
    col.viewRule = SAME;
    col.createRule = SAME;
    col.updateRule = SAME;
    app.save(col);
  } catch (err) {
    console.log("[emprestimo-equipamento] Erro ao preparar:", err);
  }
});

// ---------- Emprestar ----------
onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/emprestimo-lib.js`);
  lib.exigirGestao(e.auth);
  const r = e.record;
  const eq = lib.equipamentoDaEmpresa(e.app, r.get("equipment_id"), e.auth);
  if (!r.get("funcionario_id")) throw new BadRequestError("Escolha quem vai levar o equipamento.");
  let func;
  try { func = e.app.findRecordById("funcionarios", r.get("funcionario_id")); } catch (_) {}
  if (!func || func.get("company_id") !== eq.get("company_id")) throw new BadRequestError("Funcionário não encontrado.");

  r.set("company_id", eq.get("company_id"));
  r.set("status", "active");
  r.set("borrow_date", new Date().toISOString().replace("T", " "));
  r.set("return_date", "");
  r.set("entregue_por", e.auth.id);
  r.set("recebido_por", "");
  r.set("estado_devolucao", "");
  r.set("observacao_devolucao", "");

  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    const atual = txApp.findRecordById("equipamentos", eq.id); // relê dentro da transação
    const sit = atual.get("situacao") || "Disponível";
    if (sit !== "Disponível") throw new BadRequestError(`Este equipamento não está disponível (situação: ${sit}).`);
    if (lib.emprestimoAberto(txApp, eq.id)) throw new BadRequestError("Este equipamento já está emprestado.");
    e.next();

    let obraNome = "";
    if (r.get("obra_id")) { try { obraNome = txApp.findRecordById("obras", r.get("obra_id")).get("nome") || ""; } catch (_) {} }
    const antes = { sit, local: atual.get("local_atual"), obra: atual.get("obra_atual_id"), resp: atual.get("responsavel_id") };
    atual.set("situacao", "Emprestado");
    atual.set("funcionario_id", func.id);
    atual.set("obra_atual_id", r.get("obra_id") || "");
    atual.set("local_atual", obraNome ? `Obra: ${obraNome}` : `Com ${func.get("nome")}`);
    atual.set("atualizado_por", e.auth.id);
    txApp.save(atual);
    lib.historico(txApp, atual, e.auth.id, `Emprestado para ${func.get("nome")}`, antes,
      r.get("expected_return_date") ? `Devolver até ${String(r.get("expected_return_date")).slice(0, 10)}` : "");
  });
}, "emprestimos");

// ---------- Receber de volta (e ajustes enquanto aberto) ----------
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/emprestimo-lib.js`);
  lib.exigirGestao(e.auth);
  const r = e.record;
  const orig = r.original();
  if (orig.get("status") === "returned") throw new BadRequestError("A devolução já foi registrada; não dá para alterar.");
  // Campos que não mudam depois de emprestar.
  ["equipment_id", "company_id", "funcionario_id", "obra_id", "borrow_date", "entregue_por"].forEach((f) => r.set(f, orig.get(f)));

  const devolvendo = r.get("status") === "returned";
  if (!devolvendo) {
    r.set("status", orig.get("status"));
    ["return_date", "recebido_por", "estado_devolucao"].forEach((f) => r.set(f, orig.get(f)));
    return e.next(); // só previsão de devolução / observações
  }

  const estado = r.get("estado_devolucao");
  const DESTINO = { "Bom": "Disponível", "Precisa de manutenção": "Em Manutenção", "Danificado": "Danificado", "Perdido": "Extraviado" };
  if (!DESTINO[estado]) throw new BadRequestError("Diga em que estado o equipamento voltou.");
  r.set("return_date", new Date().toISOString().replace("T", " "));
  r.set("recebido_por", e.auth.id);

  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    e.next();
    const eq = txApp.findRecordById("equipamentos", r.get("equipment_id"));
    const antes = { sit: eq.get("situacao"), local: eq.get("local_atual"), obra: eq.get("obra_atual_id"), resp: eq.get("responsavel_id") };
    eq.set("situacao", DESTINO[estado]);
    eq.set("funcionario_id", "");
    eq.set("obra_atual_id", "");
    eq.set("local_atual", estado === "Perdido" ? "" : "Almoxarifado");
    eq.set("atualizado_por", e.auth.id);
    txApp.save(eq);
    const obs = r.get("observacao_devolucao") || "";
    if (estado === "Precisa de manutenção") {
      const m = new Record(txApp.findCollectionByNameOrId("equipamentos_manutencao"));
      m.set("company_id", eq.get("company_id"));
      m.set("equipamento_id", eq.id);
      m.set("tipo", "Corretiva");
      m.set("status", "Agendada");
      m.set("descricao", "Voltou do empréstimo precisando de manutenção" + (obs ? `: ${obs}` : "."));
      m.set("data_prevista", new Date().toISOString().replace("T", " "));
      m.set("criado_por", e.auth.id);
      txApp.save(m);
    }
    lib.historico(txApp, eq, e.auth.id, `Devolvido (${estado})`, antes, obs);
  });
}, "emprestimos");

// A situação de um equipamento emprestado só muda pela devolução.
onRecordUpdateRequest((e) => {
  if (e.auth && !e.auth.isSuperuser()) {
    const antes = e.record.original().get("situacao");
    const depois = e.record.get("situacao");
    if (antes !== depois) {
      const lib = require(`${__hooks}/emprestimo-lib.js`);
      if (lib.emprestimoAberto(e.app, e.record.id)) {
        throw new BadRequestError("Este equipamento está emprestado. Use \"Receber de volta\" para registrar a devolução.");
      }
      if (depois === "Emprestado") throw new BadRequestError("Para emprestar, use o botão \"Emprestar\".");
    }
  }
  e.next();
}, "equipamentos");
