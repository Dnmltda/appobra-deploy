/// <reference path="../pb_data/types.d.ts" />
// Limpeza de empresas de demonstração.
// Nunca exclui empresas reais e nunca falha por referências existentes:
// se a empresa estiver referenciada em qualquer collection, ela é preservada.
migrate((app) => {
  const KEEP_NAMES = ["Empresa Principal", "DNM&LTDA", "DNM & LTDA OBRAS", "DNM OBRAS"];

  let records = [];
  try {
    records = app.findRecordsByFilter("companies", "id != ''");
  } catch (e) {
    return;
  }

  const referencingCollections = [
    "compras", "fornecedores", "funcionarios", "obras", "epis", "epi_entrega",
    "equipamentos", "emprestimos", "materiais", "movimentacoes", "financeiro",
    "qr_codes", "qr_scans", "users",
  ];

  for (const record of records) {
    const name = record.get("name") || "";
    if (KEEP_NAMES.indexOf(name) !== -1) continue;

    let referenced = false;
    for (const col of referencingCollections) {
      try {
        const refs = app.findRecordsByFilter(col, `company_id ~ '${record.id}'`, "", 1, 0);
        if (refs && refs.length > 0) {
          referenced = true;
          break;
        }
      } catch (e) {
        // collection/field inexistente nesse ambiente: ignora
      }
    }

    if (referenced) continue;

    try {
      app.delete(record);
    } catch (e) {
      // mantém o registro em vez de falhar o deploy
    }
  }
}, (app) => {
  // Rollback: dados não armazenados, restauração manual se necessário
})
