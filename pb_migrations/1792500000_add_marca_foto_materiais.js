/// <reference path="../pb_data/types.d.ts" />
// Adiciona os campos "marca" (texto) e "foto" (imagem) na collection
// materiais. Pedido do Diego: ao escolher um material pré-cadastrado pela
// categoria, a pessoa completa a marca e (no futuro) a foto/QR code do item.
// Ambos os campos são opcionais pra não quebrar os materiais já cadastrados.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("materiais");

  if (!collection.fields.getByName("marca")) {
    collection.fields.add(new TextField({
      name: "marca",
      required: false,
      max: 0,
      min: 0,
    }));
  }

  if (!collection.fields.getByName("foto")) {
    collection.fields.add(new FileField({
      name: "foto",
      required: false,
      maxSelect: 1,
      maxSize: 5242880, // 5MB
      mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
      thumbs: ["100x100", "300x300"],
    }));
  }

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("materiais");
    collection.fields.removeByName("marca");
    collection.fields.removeByName("foto");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
