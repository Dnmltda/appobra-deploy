// Utilitários de segurança para o Portal de Acesso (APP OBRA)
// Sessão, inatividade, sincronização entre abas, sanitização e status do servidor.

import pb from '@/lib/pocketbaseClient.js';

// Chaves de localStorage (apenas "Lembrar acesso" — nunca senhas)
export const STORAGE_KEYS = {
  REMEMBER_LOGIN: 'remember_login',
  LAST_ACTIVITY: 'appobra_last_activity',
  SESSION_FLAG: 'appobra_session_active',
  THEME: 'appobra_login_theme',
};

// Tempo de inatividade antes do logout automático (30 minutos)
export const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

// Eventos que contam como atividade do usuário
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

// Atualiza o timestamp da última atividade
export const registerActivity = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
  } catch (e) {
    // localStorage indisponível (modo privado) — ignora silenciosamente
  }
};

// Retorna o timestamp da última atividade ou null
export const getLastActivity = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY);
    return raw ? parseInt(raw, 10) : null;
  } catch (e) {
    return null;
  }
};

// Verifica se a sessão expirou por inatividade
export const isSessionExpiredByInactivity = () => {
  const last = getLastActivity();
  if (!last) return false;
  return Date.now() - last > INACTIVITY_TIMEOUT;
};

// Verifica se o token do PocketBase ainda é válido
export const isTokenValid = () => {
  try {
    return pb.authStore.isValid && !!pb.authStore.token;
  } catch (e) {
    return false;
  }
};

// Limpa dados sensíveis de sessão (NÃO remove "Lembrar acesso")
export const clearSessionData = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
    localStorage.removeItem(STORAGE_KEYS.SESSION_FLAG);
  } catch (e) {
    // ignora
  }
};

// Marca a sessão como ativa nesta aba (usado para sincronização entre abas)
export const markSessionActive = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSION_FLAG, '1');
  } catch (e) {
    // ignora
  }
};

// Sanitiza texto livre para evitar injeção simples em mensagens/observações
export const sanitizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
};

// Verifica conectividade de rede no navegador
export const checkNetworkConnectivity = () => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

// Verifica o status do servidor PocketBase em tempo real.
// Resolve com { online: boolean, latencyMs: number|null, status: number|null }
export const checkServerStatus = async (timeoutMs = 5000) => {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${pb.baseUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timer);
    const latencyMs = Math.round(performance.now() - start);
    return { online: res.ok, latencyMs, status: res.status };
  } catch (e) {
    return { online: false, latencyMs: null, status: null };
  }
};

// Gera um código de recuperação local (6 dígitos) — usado como fallback
// quando o envio via PocketBase mailer não está disponível em preview.
export const generateRecoveryCode = () => {
  const chars = '0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Detecta o tipo de erro de autenticação e retorna uma mensagem genérica e segura
// (não revela se o usuário existe ou não — proteção contra enumeração).
export const getSafeAuthErrorMessage = (error) => {
  if (!error) return 'Credenciais inválidas. Verifique seus dados e tente novamente.';
  const msg = String(error.message || '').toLowerCase();
  if (msg.includes('bloqueada') || msg.includes('bloqueado')) {
    return 'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em alguns minutos.';
  }
  if (msg.includes('inativo')) {
    return 'Conta inativa. Entre em contato com o administrador do sistema.';
  }
  if (msg.includes('tentativas') || msg.includes('restantes')) {
    return error.message; // mensagens de tentativas restantes são informativas
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('fetch')) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  // Mensagem genérica por segurança (não revela se email existe)
  return 'Credenciais inválidas. Verifique seus dados e tente novamente.';
};

// Inicia o monitoramento de inatividade. Retorna uma função de cleanup.
export const startInactivityMonitor = (onTimeout) => {
  registerActivity();
  const handleActivity = () => registerActivity();
  ACTIVITY_EVENTS.forEach((evt) =>
    window.addEventListener(evt, handleActivity, { passive: true }),
  );
  const interval = setInterval(() => {
    if (isSessionExpiredByInactivity() && isTokenValid()) {
      if (typeof onTimeout === 'function') onTimeout();
    }
  }, 60 * 1000); // checa a cada minuto
  return () => {
    ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handleActivity));
    clearInterval(interval);
  };
};

// Sincroniza logout entre abas/janelas via storage event.
// Retorna uma função de cleanup.
export const syncLogoutAcrossTabs = (onRemoteLogout) => {
  const handler = (event) => {
    if (event.key === STORAGE_KEYS.SESSION_FLAG && event.newValue === null) {
      if (typeof onRemoteLogout === 'function') onRemoteLogout();
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
};

export default {
  STORAGE_KEYS,
  INACTIVITY_TIMEOUT,
  registerActivity,
  getLastActivity,
  isSessionExpiredByInactivity,
  isTokenValid,
  clearSessionData,
  markSessionActive,
  sanitizeText,
  checkNetworkConnectivity,
  checkServerStatus,
  generateRecoveryCode,
  getSafeAuthErrorMessage,
  startInactivityMonitor,
  syncLogoutAcrossTabs,
};
