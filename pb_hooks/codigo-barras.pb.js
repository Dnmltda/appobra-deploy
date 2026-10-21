/// <reference path="../pb_data/types.d.ts" />

// Código de barras do material (pedido do Diego, 21/10/2026): o código que vem
// na embalagem (EAN do saco de cimento, da caixa de fio...). Lido pela câmera
// no cadastro, ele deixa achar o material apontando a câmera para a embalagem
// (tela QR Code e Registrar Entrada/Saída no Estoque). Não repete dentro da
// mesma empresa (materiais arquivados não contam).

onBootstrap((e) => {
  e.next();
  try {
    const col = e.app.findCollectionByNameOrId("materiais");
    if (!col.fields.getByName("codigo_barras")) {
      col.fields.add(new TextField({ name: "codigo_barras", max: 64 }));
      e.app.save(col);
      console.log("[codigo-barras] campo codigo_barras criado em materiais.");
    }
  } catch (err) {
    console.log("[codigo-barras] Erro ao criar o campo:", err);
  }
});

onRecordCreateRequest((e) => require(`${__hooks}/codigo-barras-lib.js`).conferir(e), "materiais");
onRecordUpdateRequest((e) => require(`${__hooks}/codigo-barras-lib.js`).conferir(e), "materiais");
