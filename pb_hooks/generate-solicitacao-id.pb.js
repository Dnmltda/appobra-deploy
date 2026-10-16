/// <reference path="../pb_data/types.d.ts" />
onRecordCreate((e) => {
  const prefix = "SOL";
  
  // Find the highest existing number
  let maxNumber = 0;
  try {
    const records = $app.findRecordsByFilter("solicitacoes_compra", `id_unico ~ "^${prefix}-"`, { limit: 1000 });
    records.forEach((record) => {
      const idUnico = record.get("id_unico");
      if (idUnico) {
        const match = idUnico.match(new RegExp(`^${prefix}-(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
    });
  } catch (err) {
    // No records found yet, start from 0
  }
  
  // Generate new ID
  const newNumber = maxNumber + 1;
  const newId = `${prefix}-${String(newNumber).padStart(6, "0")}`;
  
  e.record.set("id_unico", newId);
  e.next();
}, "solicitacoes_compra");