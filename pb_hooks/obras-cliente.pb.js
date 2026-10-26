/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Cliente vê só as obras dele (Bloco 4, aprovado pelo Diego em 26/10/2026).
// Antes o perfil Cliente via todas as obras da empresa. Agora a obra tem o
// campo "clientes_acesso" (quem acompanha a obra, escolhido pelo
// administrador no cadastro da obra) e quem tem o cargo Cliente só lê as
// obras em que está nesse campo. Os demais cargos continuam como antes.
// ============================================================

onBootstrap((e) => {
  e.next();
  try {
    const col = e.app.findCollectionByNameOrId("obras");
    if (!col.fields.getByName("clientes_acesso")) {
      col.fields.add(new RelationField({ name: "clientes_acesso", collectionId: "_pb_users_auth_", maxSelect: 50, required: false }));
    }
    const CLIENTE = '(@request.auth.cargo != "Cliente" || clientes_acesso.id ?= @request.auth.id)';
    ["listRule", "viewRule"].forEach((k) => {
      const atual = col[k];
      if (atual === null || atual === undefined || String(atual).includes("clientes_acesso")) return;
      col[k] = atual === "" ? CLIENTE : `(${atual}) && ${CLIENTE}`;
    });
    e.app.save(col);
  } catch (err) {
    console.log("[obras-cliente] Erro:", err);
  }
});
