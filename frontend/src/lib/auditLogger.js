import pb from '@/lib/pocketbaseClient';

const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  let browserName = 'Unknown';
  
  if (ua.indexOf('Firefox') > -1) browserName = 'Firefox';
  else if (ua.indexOf('Chrome') > -1) browserName = 'Chrome';
  else if (ua.indexOf('Safari') > -1) browserName = 'Safari';
  else if (ua.indexOf('Edge') > -1) browserName = 'Edge';
  else if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident') > -1) browserName = 'IE';
  
  return browserName;
};

export const auditLog = async (action, module, details = '', status = 'success') => {
  try {
    const currentUser = pb.authStore.model;
    
    if (!currentUser) {
      console.warn('Cannot create audit log: no authenticated user');
      return;
    }

    const now = new Date();
    const logData = {
      usuario_id: currentUser.id,
      usuario: currentUser.name || currentUser.email || currentUser.username,
      perfil: currentUser.cargo || currentUser.role || 'Usuário',
      data: now.toISOString().split('T')[0],
      hora: now.toTimeString().split(' ')[0],
      acao: action,
      modulo: module,
      detalhes: details,
      navegador: getBrowserInfo(),
      user_agent: navigator.userAgent,
      ip_address: '127.0.0.1', // Placeholder as browser doesn't natively expose local IP reliably
      status: status
    };

    // Using audit_logs collection which contains all the correct fields for security tracking
    await pb.collection('audit_logs').create(logData, { $autoCancel: false });
  } catch (error) {
    console.error('Error creating audit log:', error);
  }
};

export const auditLogUnauthenticated = async (action, module, user_identifier, status, details = '') => {
  try {
    const now = new Date();
    const logData = {
      usuario_id: null, // Explicitly set to null for unauthenticated events
      usuario: user_identifier || 'Unknown',
      perfil: 'Não Autenticado',
      data: now.toISOString().split('T')[0],
      hora: now.toTimeString().split(' ')[0],
      acao: action,
      modulo: module,
      detalhes: details,
      navegador: getBrowserInfo(),
      user_agent: navigator.userAgent,
      ip_address: '127.0.0.1', // Placeholder
      status: status
    };

    // Using audit_logs collection which contains all the correct fields for security tracking
    await pb.collection('audit_logs').create(logData, { $autoCancel: false });
  } catch (error) {
    console.error('Error creating unauthenticated audit log:', error);
  }
};

// Predefined audit actions
export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'Login bem-sucedido',
  LOGIN_FAILED: 'Tentativa de login falhou',
  LOGOUT: 'Logout',
  PASSWORD_CHANGE: 'Senha alterada',
  PASSWORD_RESET_REQUEST: 'Solicitação de recuperação de senha',
  PASSWORD_RESET_SUCCESS: 'Senha redefinida',
  USER_CREATED: 'Usuário criado',
  USER_UPDATED: 'Usuário atualizado',
  USER_DELETED: 'Usuário deletado',
  USER_BLOCKED: 'Usuário bloqueado',
  USER_UNBLOCKED: 'Usuário desbloqueado',
  USER_DEACTIVATED: 'Usuário desativado',
  USER_ACTIVATED: 'Usuário ativado',
  RECORD_CREATED: 'Registro criado',
  RECORD_UPDATED: 'Registro atualizado',
  RECORD_DELETED: 'Registro deletado',
  EXPORT_DATA: 'Dados exportados',
  IMPORT_DATA: 'Dados importados'
};

// Predefined modules
export const AUDIT_MODULES = {
  AUTH: 'Autenticação',
  USERS: 'Usuários',
  EMPLOYEES: 'Funcionários',
  PROJECTS: 'Obras',
  PURCHASES: 'Compras',
  FINANCIAL: 'Financeiro',
  HR: 'RH',
  FLEET: 'Frota',
  INVENTORY: 'Estoque',
  DOCUMENTS: 'Documentos',
  SETTINGS: 'Configurações'
};