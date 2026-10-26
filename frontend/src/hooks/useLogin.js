// Hook customizado para o fluxo de login do Portal de Acesso (APP OBRA)
// Encapsula estado, validações, auditoria e integração com AuthContext existente.

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { auditLog, auditLogUnauthenticated, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/auditLogger.js';
import { validateLoginForm } from '@/utils/loginValidations.js';
import {
  checkNetworkConnectivity,
  getSafeAuthErrorMessage,
  registerActivity,
  markSessionActive,
  STORAGE_KEYS,
} from '@/utils/securityUtils.js';

export const useLogin = () => {
  const { loginWithEmail, loginWithId, loginWithUsername, loginWithTelefone } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const attemptRef = useRef(0);

  const persistRemember = (method, identifier, remember) => {
    try {
      if (remember) {
        const payload = btoa(JSON.stringify({ method, identifier }));
        localStorage.setItem(STORAGE_KEYS.REMEMBER_LOGIN, payload);
      } else {
        localStorage.removeItem(STORAGE_KEYS.REMEMBER_LOGIN);
      }
    } catch (e) {
      // ignora falha de localStorage
    }
  };

  const login = useCallback(
    async ({ method, identifier, password, remember }) => {
      setError('');
      setFieldErrors({});

      // 1. Conectividade
      if (!checkNetworkConnectivity()) {
        const msg = 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
        setError(msg);
        return { success: false, error: msg };
      }

      // 2. Validação de campos
      const { valid, errors } = validateLoginForm({ method, identifier, password });
      if (!valid) {
        setFieldErrors(errors);
        return { success: false, error: 'Verifique os campos destacados.', fieldErrors: errors };
      }

      attemptRef.current += 1;
      setLoading(true);

      const cleanIdentifier =
        method === 'email' ? String(identifier).trim().toLowerCase() : String(identifier).trim();

      try {
        if (method === 'email') {
          await loginWithEmail(cleanIdentifier, password);
        } else if (method === 'id') {
          await loginWithId(cleanIdentifier, password);
        } else if (method === 'username') {
          await loginWithUsername(cleanIdentifier, password);
        } else if (method === 'telefone') {
          await loginWithTelefone(cleanIdentifier, password);
        }

        persistRemember(method, cleanIdentifier, remember);
        registerActivity();
        markSessionActive();

        await auditLog(
          AUDIT_ACTIONS.LOGIN_SUCCESS,
          AUDIT_MODULES.AUTH,
          `Login via ${method}: ${cleanIdentifier}`,
          'success',
        );

        return { success: true };
      } catch (err) {
        const safeMsg = getSafeAuthErrorMessage(err);
        setError(safeMsg);

        // Auditoria de falha (não autenticada — não revela existência do usuário)
        await auditLogUnauthenticated(
          AUDIT_ACTIONS.LOGIN_FAILED,
          AUDIT_MODULES.AUTH,
          cleanIdentifier,
          'failure',
          `Tentativa falha via ${method}: ${cleanIdentifier}`,
        );

        return { success: false, error: safeMsg };
      } finally {
        setLoading(false);
      }
    },
    [loginWithEmail, loginWithId, loginWithUsername, loginWithTelefone],
  );

  const clearError = useCallback(() => {
    setError('');
    setFieldErrors({});
  }, []);

  return { login, loading, error, fieldErrors, clearError, setError };
};

export default useLogin;
