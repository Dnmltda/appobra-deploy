/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Quem fez é o servidor que diz (auditoria de 24/10/2026, item M1, aprovado
// pelo Diego em 25/10/2026). Antes o aparelho mandava "criado_por",
// "usuario_id" etc., e dava para gravar em nome de outra pessoa.
//  - Ao criar: os campos de autor recebem quem está logado.
//  - Ao editar: o autor original não muda; "atualizado_por" recebe quem editou.
//  - Registros de auditoria/histórico: "usuario_id" (e o nome) é sempre de quem
//    está logado.
// Campos que apontam para OUTRA pessoa de propósito (solicitante, responsável,
// aprovador escolhido, destinatário do aviso) não mudam.
// Só pedidos pela API; o suporte (superusuário) e as gravações internas não
// passam por aqui.
// ============================================================

onRecordCreateRequest((e) => {
  if (e.auth && !e.auth.isSuperuser()) require(`${__hooks}/autoria-lib.js`).carimbar(e, true);
  e.next();
});

onRecordUpdateRequest((e) => {
  if (e.auth && !e.auth.isSuperuser()) require(`${__hooks}/autoria-lib.js`).carimbar(e, false);
  e.next();
});
