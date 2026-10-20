import React, { createContext, useContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { auditLog, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/auditLogger.js';

const AuthContext = createContext(null);


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

  // Login (Etapa 3 da auditoria). Antes as telas procuravam o usuário na
  // lista ANTES de entrar — um visitante não pode ler essa lista, então as
  // abas "ID" e "Usuário" nunca funcionaram e o contador de tentativas
  // nunca era gravado. Agora quem confere é o servidor.
  // Só o "status" decide (como no login por e-mail original): is_active e
  // is_blocked vêm falsos por padrão em contas criadas por alguns caminhos
  // e trancariam para fora quem está "Ativo".
  const confereSituacao = (record) => {
    if (record.status === 'Bloqueado') {
      pb.authStore.clear();
      throw new Error('Usuário bloqueado. Entre em contato com o administrador.');
    }
    if (record.status === 'Inativo' && record.email !== 'dnmltda@hotmail.com') {
      pb.authStore.clear();
      throw new Error('Usuário inativo. Entre em contato com o administrador.');
    }
  };

  const entrar = async (fazerLogin, mensagemErro) => {
    let authData;
    try {
      authData = await fazerLogin();
    } catch (error) {
      await auditLog(AUDIT_ACTIONS.LOGIN_FAILED, AUDIT_MODULES.AUTH, 'Tentativa de login sem sucesso').catch(() => {});
      // Mensagem do servidor que ajuda a pessoa (ex.: ID repetido em duas empresas,
      // conta travada por senhas erradas — pb_hooks/login-limite.pb.js).
      const doServidor = error?.response?.message || '';
      if (error?.status === 429) {
        // Limite por IP do próprio PocketBase (20 logins a cada 5 minutos).
        throw new Error('Muitas tentativas de login seguidas. Espere alguns minutos e tente de novo.');
      }
      throw new Error(/mais de uma empresa|Muitas tentativas/.test(doServidor) ? doServidor : mensagemErro);
    }
    confereSituacao(authData.record);
    await handleLoginSuccess(authData);
    return authData;
  };

  const loginWithEmail = (email, password) =>
    entrar(
      () => pb.collection('users').authWithPassword(String(email).trim().toLowerCase(), password, { $autoCancel: false }),
      'E-mail ou senha incorretos.',
    );

  // Pelo servidor: acha o usuário sem diferenciar maiúscula (contas antigas
  // gravadas como "Diego") — pb_hooks/login-e-senha.pb.js.
  const loginWithUsername = (username, password) =>
    entrar(async () => {
      const r = await pb.send('/api/custom/login-usuario', {
        method: 'POST', body: { username: String(username).trim().toLowerCase(), password }, $autoCancel: false,
      });
      pb.authStore.save(r.token, r.record);
      return r;
    }, 'Usuário ou senha incorretos.');

  // O ID curto (01, 02...) é por empresa; o servidor testa a senha em cada
  // usuário com aquele ID (pb_hooks/login-e-senha.pb.js).
  const loginWithId = (idUnico, password) =>
    entrar(async () => {
      const r = await pb.send('/api/custom/login-id', {
        method: 'POST', body: { id_unico: String(idUnico).trim(), password }, $autoCancel: false,
      });
      pb.authStore.save(r.token, r.record);
      return r;
    }, 'ID ou senha incorretos.');

  // "Esqueci minha senha": o servidor procura a conta (e-mail, usuário ou
  // ID) e envia o e-mail com o link; a resposta é sempre a mesma, exista ou
  // não a conta. O token é do próprio PocketBase e expira sozinho.
  const requestPasswordReset = async (identifier) => {
    await pb.send('/api/custom/esqueci-senha', {
      method: 'POST', body: { identificador: String(identifier).trim() }, $autoCancel: false,
    });
  };

  const resetPassword = async (token, newPassword) => {
    await pb.collection('users').confirmPasswordReset(token, newPassword, newPassword, { $autoCancel: false });
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

  const activateInvite = async (token, password, passwordConfirm, username) => {
    return await pb.send('/api/custom/activate-invite', {
      method: 'POST',
      body: { token, password, passwordConfirm: passwordConfirm || password, username: username || '' },
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
      oldPassword: currentPassword,
      password: newPassword,
      passwordConfirm: newPassword
    }, { $autoCancel: false });
    // Trocar a senha invalida a sessão atual; entra de novo com a senha nova.
    await pb.collection('users').authWithPassword(currentUser.email, newPassword, { $autoCancel: false });
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

      // E-mail repetido: quem decide é o servidor (pb_hooks/acesso-email-reuso.pb.js),
      // que reaproveita o e-mail de um acesso excluído/convite não aceito e dá
      // mensagem clara nos outros casos.
      if (userData.username) {
        const existingUsername = await pb.collection('users').getFullList({ filter: `username="${String(userData.username).trim().toLowerCase()}"`, $autoCancel: false });
        if (existingUsername.length > 0) throw new Error('Já existe um usuário com este nome de usuário.');
      }

      const newUser = await pb.collection('users').create({
        email: userData.email,
        password: userData.password,
        passwordConfirm: userData.passwordConfirm || userData.password,
        name: userData.name,
        username: String(userData.username).trim().toLowerCase(),
        // id_unico: o servidor dá o número por ordem de chegada (id-tempo-de-casa.pb.js).
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
