// Validações para o Módulo de Compras — APP OBRA

export const STATUS_COMPRA = [
  "Solicitado",
  "Em Cotação",
  "Aguardando Aprovação",
  "Aprovado",
  "Pedido Emitido",
  "Em Transporte",
  "Recebido",
  "Parcialmente Recebido",
  "Cancelado",
];

export const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"];

export const FORMAS_PAGAMENTO = [
  "À Vista",
  "Parcelado",
  "Cartão",
  "Cheque",
  "Boleto",
  "Transferência",
];

export const NIVEIS_APROVACAO = [
  "Funcionário",
  "Supervisor",
  "Engenheiro",
  "Gerente",
  "Administrador",
];

export const STATUS_APROVACAO = ["Aprovado", "Rejeitado", "Pendente"];

export const STATUS_RECEBIMENTO = ["Completo", "Parcial", "Devolvido"];

export const TIPOS_ANEXO = [
  "Orçamento",
  "Nota Fiscal",
  "Boleto",
  "Contrato",
  "Foto",
  "PDF",
  "Excel",
  "Word",
];

export const CATEGORIAS_SUGERIDAS = [
  "Materiais",
  "Ferramentas",
  "Equipamentos",
  "EPIs",
  "Serviços",
  "Logística",
  "Infraestrutura",
  "Outros",
];

export const statusColor = (status) => {
  switch (status) {
    case "Aprovado":
    case "Recebido":
      return "bg-green-500/10 text-green-700 border-green-500/20";
    case "Pedido Emitido":
    case "Em Transporte":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "Em Cotação":
    case "Aguardando Aprovação":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "Parcialmente Recebido":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
    case "Cancelado":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
};

export const prioridadeColor = (p) => {
  switch (p) {
    case "Urgente":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    case "Alta":
      return "bg-orange-500/10 text-orange-700 border-orange-500/20";
    case "Normal":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "Baixa":
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
};

export const formatCurrency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

export const formatDate = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
};

// Gera número de compra sequencial simples
export const generateNumeroCompra = () => {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(100 + Math.random() * 900);
  return `CMP-${ts}${rand}`;
};

export const generateNumeroRecebimento = () => {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(100 + Math.random() * 900);
  return `REC-${ts}${rand}`;
};

// Cálculo de valor total de um item
export const calcItemTotal = (item) => {
  const qtd = Number(item.quantidade || 0);
  const preco = Number(item.preco_unitario || 0);
  const desc = Number(item.desconto || 0);
  const frete = Number(item.frete || 0);
  const ipi = Number(item.ipi || 0);
  const icms = Number(item.icms || 0);
  const subtotal = qtd * preco - desc;
  const impostos = (subtotal * (ipi + icms)) / 100;
  return Math.max(0, subtotal + impostos + frete);
};

// Validação do formulário de compra
export const validateCompraForm = (data) => {
  const errors = {};
  if (!data.fornecedor_id) errors.fornecedor_id = "Fornecedor é obrigatório.";
  if (!data.solicitante_id) errors.solicitante_id = "Solicitante é obrigatório.";
  if (!data.categoria || !data.categoria.trim()) errors.categoria = "Categoria é obrigatória.";
  if (!data.data_solicitacao) errors.data_solicitacao = "Data de solicitação é obrigatória.";
  if (data.valor_previsto !== "" && data.valor_previsto != null && Number(data.valor_previsto) < 0)
    errors.valor_previsto = "Valor não pode ser negativo.";
  if (data.data_entrega_prevista && data.data_solicitacao && new Date(data.data_entrega_prevista) < new Date(data.data_solicitacao))
    errors.data_entrega_prevista = "Data prevista anterior à solicitação.";
  return { valid: Object.keys(errors).length === 0, errors };
};

// Validação de item
export const validateItemForm = (item) => {
  const errors = {};
  if (!item.material_id) errors.material_id = "Selecione um material.";
  if (!item.descricao || !item.descricao.trim()) errors.descricao = "Descrição é obrigatória.";
  if (!item.unidade || !item.unidade.trim()) errors.unidade = "Unidade é obrigatória.";
  if (!item.quantidade || Number(item.quantidade) <= 0) errors.quantidade = "Quantidade deve ser maior que zero.";
  if (item.preco_unitario === "" || item.preco_unitario == null || Number(item.preco_unitario) < 0)
    errors.preco_unitario = "Preço unitário inválido.";
  return { valid: Object.keys(errors).length === 0, errors };
};

export const validateAprovacaoForm = (data) => {
  const errors = {};
  if (!data.nivel_aprovacao) errors.nivel_aprovacao = "Selecione o nível.";
  if (!data.usuario_id) errors.usuario_id = "Selecione o usuário.";
  if (!data.data_aprovacao) errors.data_aprovacao = "Data é obrigatória.";
  if (!data.hora_aprovacao) errors.hora_aprovacao = "Hora é obrigatória.";
  if (!data.status_aprovacao) errors.status_aprovacao = "Selecione o status.";
  return { valid: Object.keys(errors).length === 0, errors };
};

export const validateRecebimentoForm = (data) => {
  const errors = {};
  if (!data.data_recebimento) errors.data_recebimento = "Data é obrigatória.";
  if (!data.hora_recebimento) errors.hora_recebimento = "Hora é obrigatória.";
  if (!data.responsavel_id) errors.responsavel_id = "Responsável é obrigatório.";
  if (!data.quantidade_recebida || Number(data.quantidade_recebida) <= 0)
    errors.quantidade_recebida = "Quantidade recebida inválida.";
  if (!data.quantidade_prevista || Number(data.quantidade_prevista) < 0)
    errors.quantidade_prevista = "Quantidade prevista inválida.";
  return { valid: Object.keys(errors).length === 0, errors };
};

export default {
  STATUS_COMPRA,
  PRIORIDADES,
  FORMAS_PAGAMENTO,
  NIVEIS_APROVACAO,
  STATUS_APROVACAO,
  STATUS_RECEBIMENTO,
  TIPOS_ANEXO,
  CATEGORIAS_SUGERIDAS,
  statusColor,
  prioridadeColor,
  formatCurrency,
  formatDate,
  generateNumeroCompra,
  generateNumeroRecebimento,
  calcItemTotal,
  validateCompraForm,
  validateItemForm,
  validateAprovacaoForm,
  validateRecebimentoForm,
};
