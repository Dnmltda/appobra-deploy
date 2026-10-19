// Mensagem legível de um erro do PocketBase para mostrar ao usuário.
// Erro de campo ("Cannot be blank.") vem em response.data; erro de regra do
// servidor ("Saldo insuficiente: ...") vem em response.message. O código
// antigo só olhava response.data e mostrava um aviso vazio no segundo caso.
// Valor repetido ("Value must be unique.") vira "E-mail já está em uso".
const NOMES_CAMPOS = {
  email: 'E-mail', cpf: 'CPF', cnpj: 'CNPJ', matricula: 'ID do funcionário', id_unico: 'ID',
  username: 'Usuário', placa: 'Placa', chassi: 'Chassi', renavam: 'RENAVAM', codigo: 'Código', code: 'Código',
  numero: 'Número', nome: 'Nome', name: 'Nome',
};

export function mensagemErro(err, padrao = 'Erro ao salvar') {
  const corpo = err?.response || {};
  const campos = corpo.data && typeof corpo.data === 'object'
    ? Object.entries(corpo.data).map(([campo, d]) => {
      if (d?.code === 'validation_not_unique') {
        // company_id faz parte dos índices "por empresa": não é o que a pessoa digitou.
        if (campo === 'company_id') return null;
        return `${NOMES_CAMPOS[campo] || campo} já está em uso`;
      }
      return d?.message;
    }).filter(Boolean)
    : [];
  if (campos.length) return [...new Set(campos)].join(', ');
  return corpo.message || err?.message || padrao;
}
