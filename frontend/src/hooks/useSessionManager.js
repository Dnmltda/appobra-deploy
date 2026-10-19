// Hook de gerenciamento de sessão para o Portal de Acesso (APP OBRA)
// Monitora inatividade, sincroniza logout entre abas e verifica status do servidor.

import { useState, useEffect, useCallback, useRef } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { auditLog, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/auditLogger.js';
import {
  checkServerStatus,
  startInactivityMonitor,
  syncLogoutAcrossTabs,
  isTokenValid,
  clearSessionData,
  registerActivity,
  markSessionActive,
} from '@/utils/securityUtils.js';

export const SERVER_STATUS = {
  CHECKING: 'checking',
  ONLINE: 'online',
  OFFLINE: 'offline',
};

export const useSessionManager = ({ enabled = false, onSessionExpired } = {}) => {
  const [serverStatus, setServerStatus] = useState(SERVER_STATUS.CHECKING);
  const [latency, setLatency] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const monitorRef = useRef(null);
  const syncRef = useRef(null);

  // Verificação periódica do status do servidor PocketBase
  const refreshServerStatus = useCallback(async () => {
    const result = await checkServerStatus();
    setServerStatus(result.online ? SERVER_STATUS.ONLINE : SERVER_STATUS.OFFLINE);
    setLatency(result.latencyMs);
    return result;
  }, []);

  // Monitoramento de conectividade do navegador
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Verificação inicial + periódica do status do servidor
  useEffect(() => {
    refreshServerStatus();
    const interval = setInterval(refreshServerStatus, 60 * 1000); // a cada minuto
    return () => clearInterval(interval);
  }, [refreshServerStatus]);

  // Monitor de inatividade + sincronização entre abas (apenas quando autenticado)
  useEffect(() => {
    if (!enabled) return;

    const handleTimeout = async () => {
      try {
        await auditLog(
          AUDIT_ACTIONS.LOGIN_FAILED, // reutilizado como evento de sessão
          AUDIT_MODULES.AUTH,
          'Sessão expirada por inatividade',
          'failed',
        );
      } catch (e) {
        // ignora
      }
      pb.authStore.clear();
      clearSessionData();
      if (typeof onSessionExpired === 'function') onSessionExpired();
    };

    const handleRemoteLogout = () => {
      pb.authStore.clear();
      clearSessionData();
      if (typeof onSessionExpired === 'function') onSessionExpired();
    };

    monitorRef.current = startInactivityMonitor(handleTimeout);
    syncRef.current = syncLogoutAcrossTabs(handleRemoteLogout);
    registerActivity();
    markSessionActive();

    return () => {
      if (monitorRef.current) monitorRef.current();
      if (syncRef.current) syncRef.current();
    };
  }, [enabled, onSessionExpired]);

  const isSessionValid = useCallback(() => isTokenValid(), []);

  return {
    serverStatus,
    latency,
    isOnline,
    refreshServerStatus,
    isSessionValid,
  };
};

export default useSessionManager;
