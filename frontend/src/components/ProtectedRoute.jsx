import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import CarregandoCoroa from '@/components/marca/CarregandoCoroa.jsx';
import { auditLog, AUDIT_MODULES } from '@/lib/auditLogger.js';
import { ehAdmin, cargoDe, podeAcessar } from '@/lib/permissoes.js';

const ProtectedRoute = ({ children, requiredRoles = [], module = null }) => {
  const { currentUser, initialLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  const deniedLoggedRef = useRef(false);

  const userRole = cargoDe(currentUser);
  const roleAllowed = requiredRoles.length === 0 || requiredRoles.includes(userRole) || ehAdmin(currentUser);
  const moduleAllowed = podeAcessar(currentUser, module);
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
    return <CarregandoCoroa />;
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

