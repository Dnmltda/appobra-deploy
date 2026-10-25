import { toast } from 'sonner';

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

// Mensagens fixas do PocketBase (em inglês) e o que mostrar no lugar.
const SEM_REDE = 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
const TRADUCOES = [
  [/^Failed to (create|update|delete|save|authenticate)/i, null], // usa a mensagem padrão da tela
  [/^Something went wrong while processing your request/i, SEM_REDE],
  [/^Failed to fetch|NetworkError|Load failed/i, SEM_REDE],
  [/wasn't found|not found/i, 'Registro não encontrado. Atualize a página e tente de novo.'],
  [/^Only superusers|requires valid record authorization|not allowed|forbidden/i, 'Você não tem permissão para isso. Fale com o administrador.'],
  [/^Too Many Requests/i, 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'],
];
const ERROS_CAMPO = {
  validation_required: (n) => `${n} é obrigatório`,
  validation_invalid_email: (n) => `${n} inválido`,
  validation_length_out_of_range: (n) => `${n} com tamanho fora do permitido`,
  validation_min_text_constraint: (n) => `${n} muito curto`,
  validation_max_text_constraint: (n) => `${n} muito longo`,
  validation_invalid_value: (n) => `${n} com valor inválido`,
};
// Texto sem nenhuma letra acentuada e com palavras inglesas típicas: não mostra cru.
const pareceIngles = (t) => /\b(the|failed|invalid|must|cannot|error|request|record|value)\b/i.test(t) && !/[áàâãéêíóôõúç]/i.test(t);

export function mensagemErro(err, padrao = 'Erro ao salvar') {
  const corpo = err?.response || {};
  if (err?.status === 0 || err?.isAbort) return SEM_REDE;
  const campos = corpo.data && typeof corpo.data === 'object'
    ? Object.entries(corpo.data).map(([campo, d]) => {
      const nome = NOMES_CAMPOS[campo] || campo;
      if (d?.code === 'validation_not_unique') {
        // company_id faz parte dos índices "por empresa": não é o que a pessoa digitou.
        if (campo === 'company_id') return null;
        return `${nome} já está em uso`;
      }
      if (ERROS_CAMPO[d?.code]) return ERROS_CAMPO[d.code](nome);
      return d?.message && !pareceIngles(d.message) ? d.message : `${nome} inválido`;
    }).filter(Boolean)
    : [];
  if (campos.length) return [...new Set(campos)].join(', ');
  const msg = String(corpo.message || err?.message || '');
  for (const [re, troca] of TRADUCOES) if (re.test(msg)) return troca || padrao;
  if (!msg || pareceIngles(msg)) return padrao;
  return msg;
}

// Lista ou painel que não carregou: avisa, em vez de mostrar zero/vazio como
// se fosse verdade (auditoria D7). Pedido cancelado ao trocar de tela não avisa.
export const falhaAoCarregar = (oque) => (err) => {
  console.error(`Erro ao carregar ${oque}:`, err);
  if (err?.isAbort) return;
  toast.error(`Não foi possível carregar ${oque}. Verifique a internet e tente de novo.`, { id: `carga-${oque}` });
};
