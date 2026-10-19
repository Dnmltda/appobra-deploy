/// <reference path="../pb_data/types.d.ts" />

// Cor do material (pedido do Diego, 19/10/2026): escolhida numa lista na
// tela (fio, tubo, tinta...), sem digitar. A tela também põe a cor no fim do
// nome ("Fio 2,5 mm Azul claro") para os pedidos e o estoque mostrarem a
// diferença.
onBootstrap((e) => {
  e.next();
  try {
    const col = e.app.findCollectionByNameOrId("materiais");
    if (!col.fields.getByName("cor")) {
      col.fields.add(new TextField({ name: "cor", max: 60 }));
      e.app.save(col);
      console.log("[materiais-cor] campo cor criado em materiais.");
    }
  } catch (err) {
    console.log("[materiais-cor] Erro ao criar o campo cor:", err);
  }
});
