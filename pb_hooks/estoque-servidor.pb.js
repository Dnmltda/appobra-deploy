/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Etapa 2 da auditoria (docs/auditoria/): estoque calculado pelo SERVIDOR.
//
// Antes, quem mudava o saldo (materiais.quantity_in_stock) era o navegador
// (lia o saldo, somava, gravava), a tela Movimentações não mexia no saldo,
// o servidor aceitava saída maior que o saldo, movimentação lançada podia
// ser editada e compra recebida não entrava no estoque.
//
// Regras agora:
//  - O saldo só muda quando uma movimentação fica "Aprovado" ou "Finalizado".
//    Entrada/Devolução/Retorno somam; Saída/Consumo/Retirada/Perda subtraem;
//    Transferência não muda o saldo; Inventário e Ajuste de Estoque dizem
//    "o saldo passa a ser X" (quantidade contada) e o servidor registra a
//    diferença.
//  - Saldo nunca fica negativo: a movimentação é recusada com a mensagem
//    "Saldo insuficiente".
//  - Movimentação lançada não pode ser alterada nem excluída. Para corrigir,
//    cancela (o servidor estorna) e registra outra — o histórico fica.
//  - O saldo enviado pelas telas no cadastro do material é ignorado (o
//    servidor é a fonte da verdade). O saldo inicial de um material novo
//    vira uma movimentação de Entrada "Saldo inicial".
//  - Compra que muda para "Recebido" lança a Entrada de cada item.
//
// Cada requisição que mexe em estoque roda numa transação: se qualquer
// parte falhar, nada fica gravado pela metade.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  const novos = {
    movimentacoes: [
      new BoolField({ name: "estoque_aplicado" }),
      new NumberField({ name: "quantidade_aplicada" }),
      new NumberField({ name: "saldo_anterior" }),
      new NumberField({ name: "saldo_posterior" }),
    ],
    compras: [new BoolField({ name: "estoque_lancado" })],
  };
  Object.keys(novos).forEach((nome) => {
    try {
      const col = app.findCollectionByNameOrId(nome);
      let n = 0;
      novos[nome].forEach((f) => {
        if (!col.fields.getByName(f.name)) {
          col.fields.add(f);
          n++;
        }
      });
      if (n) {
        app.save(col);
        console.log(`[estoque-servidor] ${nome}: ${n} campo(s) de controle criado(s).`);
        // Primeira vez: o que já estava aprovado/recebido ANTES deste hook já
        // mexeu (ou não) no saldo pelo jeito antigo, e não dá para saber qual.
        // Marca como "já lançado" com diferença 0: não lança de novo, não pode
        // ser editado, e cancelar não estorna nada. Pendentes seguem normais.
        if (nome === "movimentacoes") {
          const res = app.db().newQuery(
            "UPDATE movimentacoes SET estoque_aplicado = 1, quantidade_aplicada = 0 WHERE status IN ('Aprovado', 'Finalizado')"
          ).execute();
          console.log(`[estoque-servidor] ${res.rowsAffected()} movimentação(ões) antiga(s) marcada(s) como histórico.`);
        }
        if (nome === "compras") {
          app.db().newQuery("UPDATE compras SET estoque_lancado = 1 WHERE status = 'Recebido'").execute();
        }
      }
    } catch (err) {
      console.log(`[estoque-servidor] Erro em ${nome}:`, err);
    }
  });
});

// ---- transação em volta de tudo que mexe em estoque
onRecordCreateRequest((e) => {
  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    e.next();
  });
}, "movimentacoes", "materiais");

onRecordUpdateRequest((e) => {
  e.app.runInTransaction((txApp) => {
    e.app = txApp;
    e.next();
  });
}, "movimentacoes", "compras");

// ---- o saldo do material não é gravado pelas telas
onRecordUpdateRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    e.record.set("quantity_in_stock", e.record.original().get("quantity_in_stock"));
  }
  e.next();
}, "materiais");

// Material novo: o saldo digitado vira uma Entrada "Saldo inicial".
onRecordCreateRequest((e) => {
  const inicial = Number(e.record.get("quantity_in_stock") || 0);
  e.record.set("quantity_in_stock", 0);
  e.next();
  if (inicial > 0) {
    const mov = new Record(e.app.findCollectionByNameOrId("movimentacoes"));
    mov.set("material_id", e.record.id);
    mov.set("company_id", e.record.get("company_id"));
    mov.set("tipo", "Entrada");
    mov.set("quantidade", inicial);
    mov.set("unidade", e.record.get("unit") || "");
    mov.set("status", "Aprovado");
    mov.set("observacoes", "Saldo inicial do cadastro do material");
    mov.set("data", new Date().toISOString().replace("T", " "));
    if (e.auth && !e.auth.isSuperuser()) {
      mov.set("criado_por", e.auth.id);
      mov.set("responsavel_id", e.auth.id);
    }
    e.app.save(mov); // o hook de movimentação aplica no saldo
  }
}, "materiais");

// ---- lógica de saldo (usada pelos hooks de movimentação abaixo)
// Os handlers do JSVM rodam isolados; por isso a lógica fica num módulo
// carregado com require() dentro de cada handler.
// (ver pb_hooks/estoque-lib.js)

onRecordCreateExecute((e) => {
  const est = require(`${__hooks}/estoque-lib.js`);
  const r = e.record;
  r.set("estoque_aplicado", false);
  r.set("quantidade_aplicada", 0);
  r.set("saldo_anterior", 0);
  r.set("saldo_posterior", 0);
  if (est.efetivo(r.get("status"))) est.aplicar(e.app, r);
  e.next();
}, "movimentacoes");

onRecordUpdateExecute((e) => {
  const est = require(`${__hooks}/estoque-lib.js`);
  const r = e.record;
  const o = r.original();
  // campos de controle nunca vêm da tela
  ["estoque_aplicado", "quantidade_aplicada", "saldo_anterior", "saldo_posterior"].forEach((f) => r.set(f, o.get(f)));

  if (o.get("estoque_aplicado")) {
    const livres = ["status", "motivo_cancelamento", "observacoes", "atualizado_por", "updated", "updated_at"];
    const mudou = est.camposAlterados(r, o).filter((f) => !livres.includes(f));
    if (mudou.length) {
      throw new BadRequestError(
        "Esta movimentação já foi lançada no estoque e não pode ser alterada (" + mudou.join(", ") +
        "). Cancele e registre uma nova."
      );
    }
    const novo = r.get("status");
    if (novo === "Cancelado" && o.get("status") !== "Cancelado") {
      est.estornar(e.app, r);
    } else if (!est.efetivo(novo) && novo !== "Cancelado") {
      throw new BadRequestError("Movimentação lançada no estoque não pode voltar para " + novo + ". Cancele e registre uma nova.");
    }
  } else if (est.efetivo(r.get("status")) && o.get("status") !== "Cancelado") {
    est.aplicar(e.app, r);
  } else if (est.efetivo(r.get("status")) && o.get("status") === "Cancelado") {
    throw new BadRequestError("Movimentação cancelada não pode ser reaprovada. Registre uma nova.");
  }
  e.next();
}, "movimentacoes");

onRecordDeleteExecute((e) => {
  if (e.record.get("estoque_aplicado")) {
    throw new BadRequestError("Movimentação lançada no estoque não pode ser excluída. Cancele para estornar.");
  }
  e.next();
}, "movimentacoes");

// ---- compra recebida entra no estoque (um lançamento por item)
onRecordUpdateExecute((e) => {
  const r = e.record;
  const o = r.original();
  r.set("estoque_lancado", o.get("estoque_lancado"));
  if (r.get("status") === "Recebido" && o.get("status") !== "Recebido" && !o.get("estoque_lancado")) {
    const itens = e.app.findRecordsByFilter("compras_itens", "compra_id = {:c}", "", 0, 0, { c: r.id });
    const movCol = e.app.findCollectionByNameOrId("movimentacoes");
    let n = 0;
    itens.forEach((it) => {
      const qtd = Number(it.get("quantidade") || 0);
      if (!it.get("material_id") || qtd <= 0) return;
      const mov = new Record(movCol);
      mov.set("material_id", it.get("material_id"));
      mov.set("company_id", r.get("company_id"));
      mov.set("tipo", "Entrada");
      mov.set("quantidade", qtd);
      mov.set("unidade", it.get("unidade") || "");
      mov.set("valor_unitario", it.get("preco_unitario") || 0);
      mov.set("valor_total", it.get("valor_total") || 0);
      mov.set("fornecedor_id", it.get("fornecedor_id") || r.get("fornecedor_id") || "");
      mov.set("obra_id", r.get("obra_id") || "");
      mov.set("origem", "Compra " + (r.get("numero_compra") || r.get("numero") || r.id));
      mov.set("destino", "Almoxarifado");
      mov.set("status", "Aprovado");
      mov.set("observacoes", "Entrada automática pelo recebimento da compra");
      mov.set("data", new Date().toISOString().replace("T", " "));
      e.app.save(mov);
      n++;
    });
    r.set("estoque_lancado", true);
    if (n) console.log(`[estoque-servidor] compra ${r.id}: ${n} item(ns) lançado(s) no estoque.`);
  }
  e.next();
}, "compras");
