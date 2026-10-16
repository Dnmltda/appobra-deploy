/// <reference path="../pb_data/types.d.ts" />

// Gera o ID curto e sequencial de cada usuário (ex: 01, 02, 03... 100... 1000).
// A sequência é EXCLUSIVA por empresa (company_id) — nunca compartilhada entre
// empresas diferentes — e conta todos os usuários juntos, sem separar por
// cargo. Ou seja, o ID reflete a ordem de entrada na empresa, não a função.
//
// Correção: a versão anterior filtrava por prefixo de cargo usando o operador
// "~" com "^PREFIXO-", mas esse operador faz busca por substring literal (não
// é regex), então o "^" nunca batia com nada — maxNumber ficava sempre 0 e
// todo novo usuário recebia o mesmo ID, causando erro de duplicidade.
onRecordCreate((e) => {
  const companyId = e.record.get("company_id");

  if (!companyId) {
    // Sem empresa vinculada (não deveria acontecer no fluxo normal) — usa um
    // ID baseado em timestamp para nunca colidir, em vez de travar a criação.
    e.record.set("id_unico", String(Date.now()).slice(-6));
    e.next();
    return;
  }

  let maxNumber = 0;
  try {
    const records = $app.findRecordsByFilter(
      "users",
      `company_id = "${companyId}"`,
      "",
      1000
    );
    records.forEach((record) => {
      const idUnico = record.get("id_unico");
      const num = parseInt(idUnico, 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    });
  } catch (err) {
    // Nenhum registro ainda para esta empresa — começa do 0.
  }

  const newNumber = maxNumber + 1;
  // Preenche com zero até 2 dígitos (01, 02...09, 10...99), e cresce
  // naturalmente depois disso (100, 1000...) sem limite de tamanho.
  const newId = String(newNumber).padStart(2, "0");

  e.record.set("id_unico", newId);
  e.next();
}, "users");

