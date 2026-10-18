import React from 'react';
import { useSessionManager } from '@/hooks/useSessionManager.js';

// Componente invisível que ativa o gerenciamento de sessão quando autenticado.
// Monitora inatividade, sincroniza logout entre abas e expõe o status do servidor.
const SessionManager = ({ enabled, onSessionExpired }) => {
  const session = useSessionManager({ enabled, onSessionExpired });
  // Expõe o status via contexto leve (window event) para o LoginFooter consumir.
  // Em produção, isto seria um contexto React; aqui mantemos simples e desacoplado.
  React.useEffect(() => {
    if (!enabled) return;
    window.dispatchEvent(
      new CustomEvent('appobra:session-status', {
        detail: {
          serverStatus: session.serverStatus,
          latency: session.latency,
          isOnline: session.isOnline,
        },
      }),
    );
  }, [enabled, session.serverStatus, session.latency, session.isOnline]);

  return null;
};

export default SessionManager;
