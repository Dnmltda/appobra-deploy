// Mensagem legível de um erro do PocketBase para mostrar ao usuário.
// Erro de campo ("Cannot be blank.") vem em response.data; erro de regra do
// servidor ("Saldo insuficiente: ...") vem em response.message. O código
// antigo só olhava response.data e mostrava um aviso vazio no segundo caso.
export function mensagemErro(err, padrao = 'Erro ao salvar') {
  const corpo = err?.response || {};
  const campos = corpo.data && typeof corpo.data === 'object'
    ? Object.values(corpo.data).map((d) => d?.message).filter(Boolean)
    : [];
  if (campos.length) return campos.join(', ');
  return corpo.message || err?.message || padrao;
}
