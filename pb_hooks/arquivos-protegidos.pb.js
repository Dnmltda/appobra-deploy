/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Arquivos só com login (auditoria de 24/10/2026, item A6, aprovado pelo
// Diego). Antes documentos, notas fiscais, anexos, comprovantes, certificados
// e fotos abriam para qualquer um que tivesse o link, sem prazo. Agora todo
// campo de arquivo fica "protegido": só abre com um passe temporário de quem
// está logado e pode ver o registro. Só o logo das empresas continua aberto.
// O passe vale 1 hora (a tela renova a cada 30 minutos).
// Só liga a opção nos campos: nenhum arquivo é apagado ou movido.
// ============================================================

onBootstrap((e) => {
  e.next();
  const ABERTOS = { empresas: ["logo"], companies: ["logo"] };
  try {
    let n = 0;
    e.app.findAllCollections().forEach((col) => {
      if (col.system) return;
      let mudou = false;
      const fields = col.fields;
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (f.type() !== "file" || (ABERTOS[col.name] || []).includes(f.name)) continue;
        if (!f.protected) { f.protected = true; mudou = true; n++; }
      }
      if (col.name === "users" && col.fileToken && col.fileToken.duration < 3600) { col.fileToken.duration = 3600; mudou = true; }
      if (mudou) e.app.save(col);
    });
    if (n) console.log(`[arquivos-protegidos] ${n} campo(s) de arquivo passaram a exigir login.`);
  } catch (err) {
    console.log("[arquivos-protegidos] Erro:", err);
  }
});
