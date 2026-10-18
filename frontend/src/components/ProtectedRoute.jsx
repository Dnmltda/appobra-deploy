import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Skeleton } from '@/components/ui/skeleton';
import { auditLog, AUDIT_MODULES } from '@/lib/auditLogger.js';

// Mesmo mapa de permissões por cargo usado em components/Sidebar.jsx.
// Mantenha os dois sincronizados ao adicionar cargos ou módulos novos.
const ROLE_MODULE_PERMISSIONS = {
  'Diretoria': ['dashboard', 'obras', 'financeiro', 'rh', 'documentos', 'auditoria', 'configuracoes', 'relatorios', 'estoque', 'saldo_funcionario'],
  'Gerência': ['dashboard', 'obras', 'materiais', 'compras', 'financeiro', 'rh', 'documentos', 'relatorios', 'estoque', 'saldo_funcionario'],
  'Engenheiro': ['dashboard', 'obras', 'materiais', 'compras', 'documentos', 'equipamentos', 'relatorios', 'estoque', 'saldo_funcionario'],
  'Mestre de Obras': ['dashboard', 'obras', 'materiais', 'funcionarios', 'equipamentos', 'epis', 'solicitacoes', 'estoque', 'saldo_funcionario'],
  'Almoxarife': ['dashboard', 'materiais', 'movimentacoes', 'compras', 'fornecedores', 'epis', 'equipamentos', 'solicitacoes', 'estoque', 'saldo_funcionario'],
  'Comprador': ['dashboard', 'compras', 'solicitacoes', 'fornecedores', 'estoque'],
  'Financeiro': ['dashboard', 'financeiro', 'compras', 'relatorios'],
  'RH': ['dashboard', 'rh', 'funcionarios', 'epis', 'documentos'],
  'Funcionário': ['dashboard', 'solicitacoes'],
  // Cargos de execução de obra: conjunto básico próprio (painel, solicitar
  // material/EPI, consultar o próprio saldo e os equipamentos). Os quatro
  // compartilham o mesmo nível por padrão — ajustar individualmente aqui se
  // algum precisar de mais ou menos acesso.
  'Pedreiro': ['dashboard', 'solicitacoes', 'saldo_funcionario', 'epis', 'equipamentos'],
  'Servente': ['dashboard', 'solicitacoes', 'saldo_funcionario', 'epis', 'equipamentos'],
  'Encanador': ['dashboard', 'solicitacoes', 'saldo_funcionario', 'epis', 'equipamentos'],
  'Eletricista': ['dashboard', 'solicitacoes', 'saldo_funcionario', 'epis', 'equipamentos'],
  // Faxina: ajuda a controlar o material de limpeza (estoque/movimentações),
  // além de poder solicitar reposição.
  'Faxina': ['dashboard', 'solicitacoes', 'estoque', 'movimentacoes']
};

const hasModuleAccess = (userRole, module) => {
  if (!module) return true; // rota sem módulo definido: não restringe por cargo
  if (userRole === 'admin' || userRole === 'Administrador') return true;
  const allowed = ROLE_MODULE_PERMISSIONS[userRole] || ['dashboard'];
  return allowed.includes(module);
};

const ProtectedRoute = ({ children, requiredRoles = [], module = null }) => {
  const { currentUser, initialLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  const deniedLoggedRef = useRef(false);

  const userRole = currentUser?.role || currentUser?.cargo;
  const roleAllowed = requiredRoles.length === 0 || requiredRoles.includes(userRole) || userRole === 'admin' || userRole === 'Administrador';
  const moduleAllowed = hasModuleAccess(userRole, module);
  const accessDenied = isAuthenticated && currentUser && (!roleAllowed || !moduleAllowed);

  useEffect(() => {
    if (accessDenied && !deniedLoggedRef.current) {
      deniedLoggedRef.current = true;
      auditLog(
        'Acesso negado',
        AUDIT_MODULES.SETTINGS,
        `Usuário tentou acessar ${location.pathname} sem permissão (cargo: ${userRole || 'desconhecido'})`,
        'failed'
      );
    }
  }, [accessDenied, location.pathname, userRole]);

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (currentUser.status === 'Bloqueado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-4">Acesso Bloqueado</h1>
          <p className="text-muted-foreground mb-6">
            Sua conta foi bloqueada. Entre em contato com o administrador do sistema.
          </p>
          <a href="/login" className="text-primary hover:underline font-medium">
            Voltar ao login
          </a>
        </div>
      </div>
    );
  }

  if (currentUser.status === 'Inativo') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-4">Conta Inativa</h1>
          <p className="text-muted-foreground mb-6">
            Sua conta está inativa. Entre em contato com o administrador do sistema.
          </p>
          <a href="/login" className="text-primary hover:underline font-medium">
            Voltar ao login
          </a>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive mb-4">Acesso Negado</h1>
          <p className="text-muted-foreground mb-6">
            Você não tem permissão para acessar esta página.
          </p>
          <a href="/dashboard" className="text-primary hover:underline font-medium">
            Voltar ao painel
          </a>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;

