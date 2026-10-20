/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Estoque geral + estoque de cada obra (pedido do Diego, 19/10/2026).
//
// A compra entra no estoque GERAL (materiais.quantity_in_stock, como antes)
// e o almoxarifado distribui para o estoque de cada obra:
//   - "Transferência para Obra": sai do geral e entra no estoque da obra;
//   - "Devolução da Obra": sai do estoque da obra e volta ao geral;
//   - qualquer outra movimentação com "estoque da obra" (estoque_obra_id)
//     mexe no estoque daquela obra em vez do geral (consumo, perda, saída,
//     inventário da obra, retirada por funcionário...).
// O saldo de cada obra fica na coleção estoque_obra (um registro por obra e
// material), gravada só pelo servidor (pb_hooks/estoque-lib.js). Pedido de
// material: quem separa escolhe de qual estoque sai (solicitacoes.estoque_obra_id).
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  require(`${__hooks}/dono-lib.js`).garantir(app); // regras abaixo usam users.dono_sistema
  try {
    const obras = app.findCollectionByNameOrId("obras");
    let col = null;
    try { col = app.findCollectionByNameOrId("estoque_obra"); } catch (_) {}
    if (!col) {
      // Já nasce visível só para quem cuida do estoque (mesma regra de
      // acesso-estoque.pb.js, que no primeiro boot roda antes desta criação).
      const SAME = '@request.auth.id != "" && @request.auth.company_id = company_id';
      const VE = '(@request.auth.cargo = "Administrador" || @request.auth.cargo = "Diretoria" || @request.auth.cargo = "Gerência" || ' +
        '@request.auth.cargo = "Engenheiro" || @request.auth.cargo = "Mestre de Obras" || @request.auth.cargo = "Almoxarife" || ' +
        '@request.auth.cargo = "Comprador" || @request.auth.cargo = "Financeiro" || ' +
        '@request.auth.role = "admin" || @request.auth.role = "Administrador" || @request.auth.dono_sistema = true)';
      col = new Collection({
        type: "base",
        name: "estoque_obra",
        listRule: `${SAME} && ${VE}`,
        viewRule: `${SAME} && ${VE}`,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: "company_id", type: "relation", collectionId: app.findCollectionByNameOrId("companies").id, maxSelect: 1, required: true },
          { name: "obra_id", type: "relation", collectionId: obras.id, maxSelect: 1, required: true },
          { name: "material_id", type: "relation", collectionId: app.findCollectionByNameOrId("materiais").id, maxSelect: 1, required: true },
          { name: "quantidade", type: "number", min: 0 },
          { name: "created", type: "autodate", onCreate: true },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
        indexes: ["CREATE UNIQUE INDEX idx_estoque_obra_obra_material ON estoque_obra (obra_id, material_id)"],
      });
      app.save(col);
      console.log("[estoque-obra] coleção estoque_obra criada.");
    }

    const mov = app.findCollectionByNameOrId("movimentacoes");
    let mudou = false;
    const tipo = mov.fields.getByName("tipo");
    const valores = [];
    for (let i = 0; i < tipo.values.length; i++) valores.push(String(tipo.values[i]));
    ["Transferência para Obra", "Devolução da Obra"].forEach((v) => { if (!valores.includes(v)) { valores.push(v); mudou = true; } });
    if (mudou) tipo.values = valores;
    if (!mov.fields.getByName("estoque_obra_id")) {
      mov.fields.add(new RelationField({ name: "estoque_obra_id", collectionId: obras.id, maxSelect: 1 }));
      mudou = true;
    }
    if (!mov.fields.getByName("quantidade_aplicada_obra")) {
      mov.fields.add(new NumberField({ name: "quantidade_aplicada_obra" }));
      mudou = true;
    }
    if (mudou) app.save(mov);

    const sol = app.findCollectionByNameOrId("solicitacoes");
    if (!sol.fields.getByName("estoque_obra_id")) {
      sol.fields.add(new RelationField({ name: "estoque_obra_id", collectionId: obras.id, maxSelect: 1 }));
      app.save(sol);
    }
  } catch (err) {
    console.log("[estoque-obra] Erro ao preparar o estoque por obra:", err);
  }
});
