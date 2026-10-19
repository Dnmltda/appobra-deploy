// Validações para o Módulo de Solicitações — APP OBRA

export const TIPOS_SOLICITACAO = [
  "Material", "Compra", "Equipamento", "Ferramenta", "EPI",
  "Financeiro", "RH", "Transporte", "Documento", "Manutenção",
  "Administrativo", "Outro",
];

export const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente", "Emergencial"];

export const STATUS_SOLICITACAO = [
  "Aberta", "Em análise", "Aguardando aprovação", "Aprovada",
  "Em execução", "Concluída", "Cancelada", "Rejeitada",
];

export const NIVEIS_APROVACAO = [
  "Funcionário", "Supervisor", "Engenheiro", "Gerente", "Administrador",
];

export const STATUS_APROVACAO = ["Aprovado", "Rejeitado", "Pendente"];

export const TIPOS_ANEXO = [
  "Foto", "PDF", "Word", "Excel", "Vídeo", "Documento", "Comprovante",
];

export const tipoColor = (tipo) => {
  switch (tipo) {
    case "Material": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "Compra": return "bg-indigo-500/10 text-indigo-700 border-indigo-500/20";
    case "Equipamento": return "bg-cyan-500/10 text-cyan-700 border-cyan-500/20";
    case "Ferramenta": return "bg-teal-500/10 text-teal-700 border-teal-500/20";
    case "EPI": return "bg-orange-500/10 text-orange-700 border-orange-500/20";
    case "Financeiro": return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "RH": return "bg-pink-500/10 text-pink-700 border-pink-500/20";
    case "Transporte": return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "Documento": return "bg-violet-500/10 text-violet-700 border-violet-500/20";
    case "Manutenção": return "bg-rose-500/10 text-rose-700 border-rose-500/20";
    case "Administrativo": return "bg-slate-500/10 text-slate-700 border-slate-500/20";
    default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
};

export const statusColor = (status) => {
  switch (status) {
    case "Aprovada":
    case "Concluída":
      return "bg-green-500/10 text-green-700 border-green-500/20";
    case "Em execução":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "Em análise":
    case "Aguardando aprovação":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "Rejeitada":
    case "Cancelada":
      return "bg-red-500/10 text-red-700 border-red-500/20";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  }
};

export const prioridadeColor = (p) => {
  switch (p) {
    case "Emergencial": return "bg-red-600/10 text-red-700 border-red-600/20";
    case "Urgente": return "bg-red-500/10 text-red-700 border-red-500/20";
    case "Alta": return "bg-orange-500/10 text-orange-700 border-orange-500/20";
    case "Normal": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "Baixa": return "bg-gray-500/10 text-gray-700 border-gray-500/20";
    default: return "bg-gray-500/10 text-gray-700 border-gray-500/20";
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

export const generateNumeroSolicitacao = () => {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(100 + Math.random() * 900);
  return `SOL-${ts}${rand}`;
};

export const validateSolicitacaoForm = (data) => {
  const errors = {};
  if (!data.tipo) errors.tipo = "Tipo é obrigatório.";
  if (!data.solicitante_id) errors.solicitante_id = "Solicitante é obrigatório.";
  if (!data.descricao || !data.descricao.trim()) errors.descricao = "Descrição é obrigatória.";
  if (!data.data_solicitacao) errors.data_solicitacao = "Data de solicitação é obrigatória.";
  if (data.data_prazo && data.data_solicitacao && new Date(data.data_prazo) < new Date(data.data_solicitacao))
    errors.data_prazo = "Prazo anterior à data de solicitação.";
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

export default {
  TIPOS_SOLICITACAO, PRIORIDADES, STATUS_SOLICITACAO, NIVEIS_APROVACAO,
  STATUS_APROVACAO, TIPOS_ANEXO, tipoColor, statusColor, prioridadeColor,
  formatCurrency, formatDate, generateNumeroSolicitacao, validateSolicitacaoForm,
  validateAprovacaoForm,
};
