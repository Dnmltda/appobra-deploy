import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { auditLog, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/auditLogger.js';

const AuthContext = createContext(null);

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const setupRealtimeSync = () => {
    if (!currentUser || !currentUser.company_id) {
      return;
    }
    
    
    try {
      pb.collection('users').subscribe('*', (data) => {
        
        if (data.record.company_id === currentUser.company_id) {
          
          pb.collection('users').getFullList({
            filter: `company_id="${currentUser.company_id}"`,
            $autoCancel: false
          }).then(users => {
            window.dispatchEvent(new CustomEvent('usersUpdated', { detail: users }));
          }).catch(err => {
            console.error('Erro ao atualizar lista:', err);
          });
        }
      });
      
    } catch (error) {
      console.error('Erro ao setup realtime sync:', error);
    }
  };

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.model) {
      fetchUserDetails(pb.authStore.model.id);
    } else {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.company_id) {
      setupRealtimeSync();
      
      return () => {
        try {
          pb.collection('users').unsubscribe('*');
        } catch (error) {
        }
      };
    }
  }, [currentUser]);

  const fetchUserDetails = async (userId) => {

    try {
      const user = await pb.collection('users').getOne(userId, {
        $autoCancel: false
      });
      
      
      const isAdmin = user.email === 'dnmltda@hotmail.com' || user.username === 'dnmltda' || user.cargo === 'Administrador';
      user.role = isAdmin ? 'admin' : (user.role || user.cargo || 'Funcionário');
      user.permissions = user.permissions || [];
      
      setCurrentUser(user);
      return user;
    } catch (error) {
      console.error(error); 
      if (pb.authStore.model) { 
        setCurrentUser(pb.authStore.model); 
      } else { 
        setCurrentUser(null); 
      }
      return null;
    } finally {
      setInitialLoading(false);
    }
  };

  const handleLoginSuccess = async (authData) => {
    const fullUser = await fetchUserDetails(authData.record.id);
    
    if (!fullUser) {
      throw new Error('Falha ao carregar dados completos do usuário');
    }
    
    try {
      await pb.collection('users').update(fullUser.id, { 
        last_login: new Date().toISOString(),
        login_attempts: 0,
        locked_until: ''
      }, { $autoCancel: false });
    } catch (e) {
      console.error('Failed to update last_login field', e);
    }
    
    await auditLog(AUDIT_ACTIONS.LOGIN_SUCCESS, AUDIT_MODULES.AUTH, `Login via ${fullUser.email}`);
  };

  const checkUserLockout = async (userRecord) => {
    if (userRecord.locked_until) {
      const lockedUntil = new Date(userRecord.locked_until).getTime();
      if (lockedUntil > Date.now()) {
        const remainingMinutes = Math.ceil((lockedUntil - Date.now()) / 60000);
        throw new Error(`Conta temporariamente bloqueada. Tente novamente em ${remainingMinutes} minutos.`);
      } else {
        await pb.collection('users').update(userRecord.id, {
          locked_until: '',
          login_attempts: 0
        }, { $autoCancel: false });
      }
    }
  };

  const handleLoginFailure = async (userRecord) => {
    if (!userRecord) return;
    const newAttempts = (userRecord.login_attempts || 0) + 1;
    
    const updateData = { login_attempts: newAttempts };
    let locked = false;
    
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutTime = new Date(Date.now() + LOCKOUT_DURATION);
      updateData.locked_until = lockoutTime.toISOString();
      locked = true;
    }
    
    try {
      await pb.collection('users').update(userRecord.id, updateData, { $autoCancel: false });
    } catch (e) {
      console.error('Failed to update login_attempts', e);
    }

    await auditLog(AUDIT_ACTIONS.LOGIN_FAILED, AUDIT_MODULES.AUTH, `Tentativa falha para ID: ${userRecord.id}`);
    
    if (locked) {
      throw new Error('Número máximo de tentativas excedido. Conta bloqueada temporariamente (30 min).');
    }
    
    throw new Error(`Credenciais inválidas. ${MAX_LOGIN_ATTEMPTS - newAttempts} tentativas restantes.`);
  };

  const loginWithEmail = async (email, password) => {
    const cleanEmail = String(email).trim().toLowerCase();
    let userRecord = null;
    try {
      const users = await pb.collection('users').getFullList({ filter: `email = "${cleanEmail}"`, $autoCancel: false });
      if (users.length > 0) userRecord = users[0];
      
      if (userRecord) await checkUserLockout(userRecord);

      const authData = await pb.collection('users').authWithPassword(cleanEmail, password, { $autoCancel: false });

      if (authData.record.status === 'Bloqueado') {
        pb.authStore.clear();
        throw new Error('Usuário bloqueado. Entre em contato com o administrador.');
      }
      if (authData.record.status === 'Inativo') {
        pb.authStore.clear();
        throw new Error('Usuário inativo. Entre em contato com o administrador.');
      }
      
      await handleLoginSuccess(authData);
      return authData;
    } catch (error) {
      if (error.message.includes('bloqueada') || error.message.includes('bloqueado') || error.message.includes('inativo')) {
        throw error;
      }
      if (userRecord) {
        await handleLoginFailure(userRecord);
      } else {
        throw new Error('Credenciais inválidas');
      }
    }
  };

  const loginWithId = async (idUnico, password) => {
    try {
      const users = await pb.collection('users').getFullList({
        filter: `id_unico="${String(idUnico).trim()}"`,
        $autoCancel: false
      });

      if (users.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      const user = users[0];

      if (user.is_blocked === true) {
        throw new Error('Usuário bloqueado');
      }

      const isMasterAdminAccount = user.email === 'dnmltda@hotmail.com';
      if (user.is_active === false && !isMasterAdminAccount) {
        throw new Error('Usuário inativo');
      }

      const authData = await pb.collection('users').authWithPassword(
        user.email,
        password,
        { $autoCancel: false }
      );

      await handleLoginSuccess(authData);
      return authData;
    } catch (error) {
      console.error("Erro completo:", error);
      throw error;
    }
  };

  const loginWithUsername = async (username, password) => {
    try {
      const users = await pb.collection('users').getFullList({
        filter: `username="${String(username).trim()}"`,
        $autoCancel: false
      });

      if (users.length === 0) {
        throw new Error('Usuário não encontrado');
      }

      const user = users[0];

      if (user.is_blocked === true) {
        throw new Error('Usuário bloqueado');
      }

      const isMasterAdminAccount = user.email === 'dnmltda@hotmail.com';
      if (user.is_active === false && !isMasterAdminAccount) {
        throw new Error('Usuário inativo');
      }

      const authData = await pb.collection('users').authWithPassword(
        user.email,
        password,
        { $autoCancel: false }
      );

      await handleLoginSuccess(authData);
      return authData;
    } catch (error) {
      console.error("Erro completo:", error);
      throw error;
    }
  };

  const requestPasswordReset = async (identifier, method = 'email') => {
    let filterStr = ``;
    if (method === 'email') filterStr += `email = "${identifier}"`;
    else if (method === 'id') filterStr += `id_unico = "${String(identifier).trim()}"`;
    else if (method === 'username') filterStr += `username = "${String(identifier).trim().toLowerCase()}"`;
    
    const users = await pb.collection('users').getFullList({ filter: filterStr, $autoCancel: false });
    if (users.length === 0) throw new Error('Usuário não encontrado');
    
    const user = users[0];
    const token = crypto.randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    
    await pb.collection('users').update(user.id, {
      password_reset_token: token,
      password_reset_expires: expires.toISOString()
    }, { $autoCancel: false });
    
    return { token, email: user.email };
  };

  const resetPassword = async (token, newPassword) => {
    const users = await pb.collection('users').getFullList({ 
      filter: `password_reset_token = "${token}"`,
      $autoCancel: false 
    });
    
    if (users.length === 0) throw new Error('Token inválido');
    const user = users[0];
    
    await pb.collection('users').update(user.id, {
      password: newPassword,
      passwordConfirm: newPassword,
      password_reset_token: '',
      password_reset_expires: ''
    }, { $autoCancel: false });
  };

  // Fluxo de convite de funcionário (ver EmployeeManagement.jsx ->
  // criarAcessoParaFuncionario e apps/pocketbase/pb_hooks/activate-invite.pb.js).
  // Endpoints públicos — não exigem sessão, pois o funcionário convidado
  // ainda não tem senha utilizável.
  const getInviteDetails = async (token) => {
    return await pb.send('/api/custom/get-invite-details', {
      method: 'POST',
      body: { token },
      $autoCancel: false
    });
  };

  const activateInvite = async (token, password, passwordConfirm) => {
    return await pb.send('/api/custom/activate-invite', {
      method: 'POST',
      body: { token, password, passwordConfirm: passwordConfirm || password },
      $autoCancel: false
    });
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!currentUser || !currentUser.company_id) {
      throw new Error('Usuário não autenticado ou company_id não disponível');
    }
    
    try {
      await pb.collection('users').authWithPassword(currentUser.email, currentPassword, { $autoCancel: false });
    } catch (error) {
      throw new Error('Senha atual incorreta');
    }
    
    await pb.collection('users').update(currentUser.id, {
      password: newPassword,
      passwordConfirm: newPassword
    }, { $autoCancel: false });
  };

  const updateProfile = async (data) => {
    if (!currentUser || !currentUser.company_id) {
      throw new Error('Usuário não autenticado ou company_id não disponível');
    }
    try {
      
      const updated = await pb.collection('users').update(currentUser.id, {
        ...data,
        role: data.role || currentUser.role || currentUser.cargo,
        status: data.status || currentUser.status,
        id_unico: data.id_unico || currentUser.id_unico,
        created_by: currentUser.created_by
      }, { $autoCancel: false });
      
      setCurrentUser(updated);
      
      const updatedUsers = await pb.collection('users').getFullList({
        filter: `company_id="${currentUser.company_id}"`,
        $autoCancel: false
      });
      
      window.dispatchEvent(new CustomEvent('usersUpdated', { detail: updatedUsers }));
      
      return updated;
    } catch (error) {
      console.error('=== ERRO AO ATUALIZAR USUÁRIO ===');
      console.error('Mensagem:', error.message);
      throw error;
    }
  };

  const uploadProfilePhoto = async (file) => {
    if (!currentUser) {
      throw new Error('Usuário não autenticado');
    }
    try {
      const formData = new FormData();
      formData.append('foto', file);

      const updated = await pb.collection('users').update(currentUser.id, formData, { $autoCancel: false });
      setCurrentUser(updated);

      await auditLog(AUDIT_ACTIONS.USER_UPDATED, AUDIT_MODULES.USERS, 'Usuário atualizou a foto de perfil');
      return updated;
    } catch (error) {
      console.error('Erro ao atualizar foto de perfil:', error.message);
      throw error;
    }
  };

  const createUser = async (userData) => {
    if (!currentUser || !currentUser.company_id) {
      throw new Error('Usuário não autenticado ou company_id não disponível');
    }
    
    setError(null);
    setLoading(true);
    try {

      if (userData.email) {
        const existingEmail = await pb.collection('users').getFullList({ filter: `email="${userData.email}"`, $autoCancel: false });
        if (existingEmail.length > 0) throw new Error('Já existe um usuário com este email.');
      }
      if (userData.username) {
        const existingUsername = await pb.collection('users').getFullList({ filter: `username="${String(userData.username).trim().toLowerCase()}"`, $autoCancel: false });
        if (existingUsername.length > 0) throw new Error('Já existe um usuário com este nome de usuário.');
      }
      if (userData.id_unico) {
        const existingId = await pb.collection('users').getFullList({ filter: `id_unico="${String(userData.id_unico).trim()}"`, $autoCancel: false });
        if (existingId.length > 0) throw new Error('Já existe um usuário com este ID único.');
      }

      const newUser = await pb.collection('users').create({
        email: userData.email,
        password: userData.password,
        passwordConfirm: userData.passwordConfirm || userData.password,
        name: userData.name,
        username: String(userData.username).trim().toLowerCase(),
        id_unico: String(userData.id_unico || crypto.randomUUID()).trim(),
        cargo: userData.cargo,
        role: userData.role || userData.cargo || 'user',
        telefone: userData.telefone,
        company_id: userData.company_id || currentUser.company_id,
        // status pode vir como 'Inativo' no fluxo de convite (ver
        // EmployeeManagement.jsx -> criarAcessoParaFuncionario): o usuário
        // só é considerado 'Ativo' depois que ele mesmo confirma os dados e
        // cria a própria senha pelo link (ver activate-invite.pb.js).
        status: userData.status || 'Ativo',
        // is_active só é true de imediato se NÃO houver um convite pendente.
        is_active: !userData.password_reset_token,
        is_blocked: false,
        login_attempts: 0,
        created_by: currentUser.id,
        funcionario_id: userData.funcionario_id || null,
        password_reset_token: userData.password_reset_token || '',
        password_reset_expires: userData.password_reset_expires || ''
      }, { $autoCancel: false });
      
      const updatedUsers = await pb.collection('users').getFullList({
        filter: `company_id="${currentUser.company_id}"`,
        $autoCancel: false
      });
      window.dispatchEvent(new CustomEvent('usersUpdated', { detail: updatedUsers }));
      
      await auditLog(AUDIT_ACTIONS.USER_CREATED, AUDIT_MODULES.USERS, `Usuário criado: ${newUser.email}`);
      return newUser;
    } catch (error) {
      console.error('=== ERRO AO CRIAR USUÁRIO ===');
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);
      setError(error.message || 'Erro ao criar usuário');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const blockUser = async (userId) => {
    if (!currentUser || !currentUser.company_id) {
      throw new Error('Usuário não autenticado ou company_id não disponível');
    }
    
    setLoading(true);
    try {
      
      const updated = await pb.collection('users').update(userId, {
        is_blocked: true,
        status: 'Bloqueado',
        locked_until: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        updated_by: currentUser.id
      }, { $autoCancel: false });
      
      
      const updatedUsers = await pb.collection('users').getFullList({
        filter: `company_id="${currentUser.company_id}"`,
        $autoCancel: false
      });
      
      window.dispatchEvent(new CustomEvent('usersUpdated', { detail: updatedUsers }));
      
      await auditLog(AUDIT_ACTIONS.USER_BLOCKED, AUDIT_MODULES.USERS, `Usuário bloqueado: ${updated.email}`);
      return updated;
    } catch (error) {
      console.error('=== ERRO AO BLOQUEAR USUÁRIO ===');
      console.error('Mensagem:', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (userId) => {
    if (!currentUser || !currentUser.company_id) {
      throw new Error('Usuário não autenticado ou company_id não disponível');
    }
    
    setLoading(true);
    try {
      const updated = await pb.collection('users').update(userId, {
        is_blocked: false,
        status: 'Ativo',
        login_attempts: 0,
        locked_until: '',
        updated_by: currentUser.id
      }, { $autoCancel: false });
      
      const updatedUsers = await pb.collection('users').getFullList({
        filter: `company_id="${currentUser.company_id}"`,
        $autoCancel: false
      });
      window.dispatchEvent(new CustomEvent('usersUpdated', { detail: updatedUsers }));
      
      await auditLog(AUDIT_ACTIONS.USER_UNBLOCKED, AUDIT_MODULES.USERS, `Usuário desbloqueado: ${updated.email}`);
      return updated;
    } finally {
      setLoading(false);
    }
  };

  const activateUser = async (userId) => {
    if (!currentUser || !currentUser.company_id) {
      throw new Error('Usuário não autenticado ou company_id não disponível');
    }
    
    setLoading(true);
    try {
      
      const updated = await pb.collection('users').update(userId, {
        is_active: true,
        status: 'Ativo',
        is_blocked: false,
        updated_by: currentUser.id
      }, { $autoCancel: false });
      
      
      const updatedUsers = await pb.collection('users').getFullList({
        filter: `company_id="${currentUser.company_id}"`,
        $autoCancel: false
      });
      
      window.dispatchEvent(new CustomEvent('usersUpdated', { detail: updatedUsers }));
      
      return updated;
    } catch (error) {
      console.error('=== ERRO AO ATIVAR USUÁRIO ===');
      console.error('Mensagem:', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deactivateUser = async (userId) => {
    if (!currentUser || !currentUser.company_id) {
      throw new Error('Usuário não autenticado ou company_id não disponível');
    }
    
    setLoading(true);
    try {
      
      const updated = await pb.collection('users').update(userId, {
        is_active: false,
        status: 'Inativo',
        updated_by: currentUser.id
      }, { $autoCancel: false });
      
      
      const updatedUsers = await pb.collection('users').getFullList({
        filter: `company_id="${currentUser.company_id}"`,
        $autoCancel: false
      });
      
      window.dispatchEvent(new CustomEvent('usersUpdated', { detail: updatedUsers }));
      
      return updated;
    } catch (error) {
      console.error('=== ERRO AO DESATIVAR USUÁRIO ===');
      console.error('Mensagem:', error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetUserPassword = async (userId, newPassword) => {
    if (!currentUser || !currentUser.company_id) {
      throw new Error('Usuário não autenticado ou company_id não disponível');
    }
    
    setLoading(true);
    try {
      const updated = await pb.collection('users').update(userId, {
        password: newPassword,
        passwordConfirm: newPassword,
        updated_by: currentUser.id
      }, { $autoCancel: false });
      return updated;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    pb.authStore.clear();
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    loginWithEmail,
    loginWithId,
    loginWithUsername,
    requestPasswordReset,
    resetPassword,
    getInviteDetails,
    activateInvite,
    changePassword,
    updateProfile,
    uploadProfilePhoto,
    createUser,
    blockUser,
    unblockUser,
    activateUser,
    deactivateUser,
    resetUserPassword,
    logout,
    isAuthenticated: !!currentUser,
    // isMasterAdmin: identificacao EXCLUSIVA por email, separada de isAdmin.
    // NAO usa id_unico, NAO usa cargo, NAO usa company_id.
    isMasterAdmin: currentUser?.email === 'dnmltda@hotmail.com',
    isAdmin: currentUser?.role === 'admin' || currentUser?.cargo === 'Administrador' || currentUser?.username === 'dnmltda' || currentUser?.email === 'dnmltda@hotmail.com',
    initialLoading,
    loading,
    error
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
