import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { SERVER_STATUS } from '@/hooks/useSessionManager.js';

// Rodapé do Portal de Acesso: versão do sistema e status do servidor em tempo real.
const APP_VERSION = '2.4.0';

const LoginFooter = ({ serverStatus, latency, isOnline }) => {
  const statusConfig = () => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="w-3.5 h-3.5" />,
        label: 'Sem internet',
        className: 'text-red-600 bg-red-500/10',
      };
    }
    switch (serverStatus) {
      case SERVER_STATUS.ONLINE:
        return {
          icon: <Wifi className="w-3.5 h-3.5" />,
          label: latency != null ? `Servidor online · ${latency}ms` : 'Servidor online',
          className: 'text-green-700 bg-green-500/10',
        };
      case SERVER_STATUS.OFFLINE:
        return {
          icon: <WifiOff className="w-3.5 h-3.5" />,
          label: 'Servidor indisponível',
          className: 'text-red-600 bg-red-500/10',
        };
      default:
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          label: 'Verificando servidor…',
          className: 'text-muted-foreground bg-muted',
        };
    }
  };

  const cfg = statusConfig();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-border/60">
      <span className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} DNM&amp;LTDA · APP OBRA v{APP_VERSION}
      </span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.className}`}
        role="status"
        aria-live="polite"
      >
        {cfg.icon}
        {cfg.label}
      </span>
    </div>
  );
};

export default LoginFooter;
