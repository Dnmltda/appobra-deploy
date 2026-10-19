// Mapa ÚNICO de permissões por cargo, usado pela proteção de rotas
// (ProtectedRoute), pelo menu (Sidebar) e pelas telas. Antes havia duas cópias
// diferentes (rota e menu) e cada tela testava o cargo do seu jeito.
//
// O servidor (pb_hooks/seguranca-etapa1.pb.js) usa os mesmos nomes de cargo;
// esconder um item aqui é só conforto — quem garante é a regra do servidor.

export const CARGOS = [
  'Administrador', 'Gerência', 'Engenheiro', 'Mestre de Obras', 'Almoxarife', 'Comprador',
  'Financeiro', 'RH', 'Funcionário', 'Cliente', 'Pedreiro', 'Servente', 'Encanador', 'Eletricista', 'Faxina',
];

const OBRA = ['dashboard', 'solicitacoes', 'saldo_funcionario', 'epis', 'equipamentos', 'ocorrencias'];

export const MODULOS_POR_CARGO = {
  'Diretoria': ['dashboard', 'materiais_obra', 'obras', 'financeiro', 'rh', 'documentos', 'auditoria', 'configuracoes', 'relatorios',
    'estoque', 'saldo_funcionario', 'empresas', 'comercial', 'frota', 'perdas_ganhos', 'ocorrencias'],
  'Gerência': ['dashboard', 'materiais_obra', 'obras', 'materiais', 'compras', 'financeiro', 'rh', 'documentos', 'relatorios', 'estoque',
    'saldo_funcionario', 'empresas', 'comercial', 'frota', 'perdas_ganhos', 'solicitacoes', 'movimentacoes', 'equipamentos', 'ocorrencias'],
  'Engenheiro': ['dashboard', 'materiais_obra', 'obras', 'materiais', 'compras', 'documentos', 'equipamentos', 'relatorios', 'estoque',
    'saldo_funcionario', 'frota', 'qrcode', 'perdas_ganhos', 'solicitacoes', 'movimentacoes', 'ocorrencias'],
  'Mestre de Obras': ['dashboard', 'materiais_obra', 'obras', 'materiais', 'funcionarios', 'equipamentos', 'epis', 'solicitacoes', 'estoque',
    'saldo_funcionario', 'frota', 'qrcode', 'perdas_ganhos', 'ocorrencias'],
  'Almoxarife': ['dashboard', 'materiais_obra', 'materiais', 'movimentacoes', 'compras', 'fornecedores', 'epis', 'equipamentos', 'solicitacoes',
    'estoque', 'saldo_funcionario', 'qrcode', 'perdas_ganhos', 'ocorrencias'],
  'Comprador': ['dashboard', 'compras', 'solicitacoes', 'fornecedores', 'estoque', 'ocorrencias'],
  'Financeiro': ['dashboard', 'materiais_obra', 'financeiro', 'compras', 'relatorios', 'ocorrencias'],
  'RH': ['dashboard', 'rh', 'funcionarios', 'epis', 'documentos', 'ocorrencias'],
  'Cliente': ['dashboard', 'obras'],
  'Funcionário': ['dashboard', 'solicitacoes', 'ocorrencias'],
  // Execução de obra: painel, pedir material/EPI, ver o próprio saldo e os equipamentos.
  'Pedreiro': OBRA,
  'Servente': OBRA,
  'Encanador': OBRA,
  'Eletricista': OBRA,
  // Faxina: controla o material de limpeza e pode pedir reposição.
  'Faxina': ['dashboard', 'solicitacoes', 'estoque', 'movimentacoes', 'ocorrencias'],
};

export const ehAdmin = (user) =>
  !!user && (user.role === 'admin' || user.role === 'Administrador' || user.cargo === 'Administrador'
    || user.email === 'dnmltda@hotmail.com');

// O cargo manda; "role" só entra para usuários antigos sem cargo.
export const cargoDe = (user) => user?.cargo || user?.role || 'Funcionário';

export const podeAcessar = (user, modulo) => {
  if (!modulo) return true;
  if (ehAdmin(user)) return true;
  return (MODULOS_POR_CARGO[cargoDe(user)] || ['dashboard']).includes(modulo);
};

// Gestão do estoque (aprovar/cancelar movimentação, ver de todos).
export const podeGerirEstoque = (user) =>
  ehAdmin(user) || ['Diretoria', 'Gerência', 'Engenheiro', 'Mestre de Obras', 'Almoxarife'].includes(cargoDe(user));

// Aprovar, separar e entregar solicitações (mesma lista "gestão" do servidor).
export const podeGerirSolicitacoes = (user) =>
  ehAdmin(user) || ['Diretoria', 'Gerência', 'Engenheiro', 'Mestre de Obras', 'Almoxarife', 'Comprador'].includes(cargoDe(user));

// Autorizar diferença de estoque (inventário/ajuste/perda que muda o saldo).
export const podeAutorizarAjuste = (user) =>
  ehAdmin(user) || ['Diretoria', 'Gerência', 'Engenheiro'].includes(cargoDe(user));

// Tratar ocorrências (andamento, resolver, reabrir) — mesma lista do servidor.
export const podeGerirOcorrencias = (user) =>
  ehAdmin(user) || ['Diretoria', 'Gerência', 'Engenheiro', 'Mestre de Obras', 'Almoxarife'].includes(cargoDe(user));
