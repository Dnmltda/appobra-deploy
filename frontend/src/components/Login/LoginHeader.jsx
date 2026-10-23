import React from 'react';
import Logo from '@/components/Logo.jsx';
import { Building2 } from 'lucide-react';

// Cabeçalho do Portal de Acesso: logo, nome do app e empresa dinâmica.
const LoginHeader = ({ companyName, onAbout }) => {
  return (
    <div className="space-y-3 text-center">
      <div className="flex justify-center">
        <Logo size="lg" variant="dark" />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-marinho tracking-tight">
          APP OBRA
        </h1>
        {companyName ? (
          <p className="text-sm font-semibold text-ouro uppercase tracking-wide">
            {companyName}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sistema Integrado de Gestão para Construção Civil
          </p>
        )}
      </div>
      {onAbout && (
        <button
          type="button"
          onClick={onAbout}
          className="mx-auto inline-flex items-center gap-1.5 text-xs font-semibold text-marinho hover:text-ouro transition-colors"
        >
          <Building2 className="w-3.5 h-3.5" />
          Sobre a Empresa
        </button>
      )}
    </div>
  );
};

export default LoginHeader;
