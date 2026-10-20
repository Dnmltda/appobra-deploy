/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Foto de quem retira (pedido do Diego, 20/10/2026): para nunca ficar a
// dúvida "retirou ou não retirou", a câmera do aparelho tira a foto da pessoa
// na hora em que ela leva o material, o EPI ou o equipamento.
//  - solicitacoes.foto_retirada: no aceite da retirada (regra em
//    fluxo-material.pb.js).
//  - epis_entregas.foto_retirada: na entrega do EPI.
//  - emprestimos.foto_retirada: no empréstimo do equipamento.
// A foto é obrigatória, não pode ser trocada depois e é protegida (só abre
// com o login de quem tem acesso ao registro).
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  ["solicitacoes", "epis_entregas", "emprestimos"].forEach((nome) => {
    try {
      const col = app.findCollectionByNameOrId(nome);
      let mudou = false;
      if (!col.fields.getByName("foto_retirada")) {
        col.fields.add(new FileField({
          name: "foto_retirada", maxSelect: 1, maxSize: 8 * 1024 * 1024, protected: true,
          mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        }));
        mudou = true;
      }
      if (nome === "solicitacoes" && !col.fields.getByName("retirada_registrada_por")) {
        col.fields.add(new RelationField({ name: "retirada_registrada_por", collectionId: app.findCollectionByNameOrId("users").id, maxSelect: 1 }));
        mudou = true;
      }
      if (mudou) { app.save(col); console.log(`[foto-retirada] ${nome}: campo da foto criado.`); }
    } catch (err) {
      console.log(`[foto-retirada] Erro em ${nome}:`, err);
    }
  });
});

onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth() && !e.record.getUnsavedFiles("foto_retirada").length) {
    throw new BadRequestError(e.collection.name === "emprestimos"
      ? "Tire a foto de quem está levando o equipamento."
      : "Tire a foto de quem está recebendo o EPI.");
  }
  e.next();
}, "epis_entregas", "emprestimos");

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) e.record.set("foto_retirada", e.record.original().get("foto_retirada"));
  e.next();
}, "epis_entregas", "emprestimos");
