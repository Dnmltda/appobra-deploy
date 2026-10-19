// Utilitários de validação para o Portal de Acesso (APP OBRA)
// Validações de formulário de login, recuperação de senha e criação de conta.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Validação de email (formato)
export const isValidEmail = (email) => {
  if (!email) return false;
  return EMAIL_REGEX.test(String(email).trim().toLowerCase());
};

// Validação de nome de usuário (mínimo 3 caracteres, alfanumérico + _ . -)
export const isValidUsername = (username) => {
  if (!username) return false;
  return /^[a-z0-9_.-]{3,30}$/i.test(String(username).trim());
};

// Validação de ID único do funcionário (formato livre, mínimo 2 caracteres)
export const isValidEmployeeId = (id) => {
  if (!id) return false;
  return String(id).trim().length >= 2;
};

// Política de senha forte:
// - mínimo 8 caracteres
// - ao menos 1 maiúscula
// - ao menos 1 minúscula
// - ao menos 1 número
// - ao menos 1 caractere especial
export const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

export const validatePasswordStrength = (password) => {
  if (!password) return { valid: false, message: 'Senha é obrigatória.' };
  const errors = [];
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`mínimo de ${PASSWORD_POLICY.minLength} caracteres`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('uma letra maiúscula');
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('uma letra minúscula');
  }
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push('um número');
  }
  if (PASSWORD_POLICY.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('um caractere especial');
  }
  if (errors.length > 0) {
    return { valid: false, message: `A senha deve conter: ${errors.join(', ')}.` };
  }
  return { valid: true, message: 'Senha válida.' };
};

// Pontuação de força da senha (0 a 4) para feedback visual
export const passwordStrengthScore = (password) => {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
};

export const STRENGTH_LABELS = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];

// Validação de confirmação de senha
export const passwordsMatch = (password, confirmation) => {
  return !!password && password === confirmation;
};

// Validação de CNPJ (formato + dígitos verificadores)
export const isValidCNPJ = (cnpj) => {
  if (!cnpj) return false;
  const cleaned = String(cnpj).replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false; // todos iguais
  let size = cleaned.length - 2;
  let digits = cleaned.substring(0, size);
  const validators = cleaned.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(digits.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(validators.charAt(0), 10)) return false;
  size += 1;
  digits = cleaned.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(digits.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(validators.charAt(1), 10)) return false;
  return true;
};

// Validação de telefone (apenas dígitos, 10 ou 11)
// Validação de CPF (dígitos verificadores reais)
export const isValidCPF = (cpf) => {
  if (!cpf) return false;
  const cleaned = String(cpf).replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false; // todos iguais
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned.charAt(i), 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cleaned.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned.charAt(i), 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cleaned.charAt(10), 10)) return false;
  return true;
};

// Aceita CPF (pessoa física) OU CNPJ (empresa) no mesmo campo — detecta pelo
// tamanho (11 = CPF, 14 = CNPJ) e valida com o dígito verificador correto.
export const isValidCpfCnpj = (value) => {
  if (!value) return false;
  const cleaned = String(value).replace(/\D/g, '');
  if (cleaned.length === 11) return isValidCPF(cleaned);
  if (cleaned.length === 14) return isValidCNPJ(cleaned);
  return false;
};

export const isValidPhone = (phone) => {
  if (!phone) return false;
  const cleaned = String(phone).replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 11;
};

// Valida o identificador conforme o método de login escolhido
export const validateIdentifier = (method, value) => {
  switch (method) {
    case 'email':
      return isValidEmail(value)
        ? { valid: true }
        : { valid: false, message: 'Informe um email válido.' };
    case 'username':
      return isValidUsername(value)
        ? { valid: true }
        : { valid: false, message: 'Usuário deve ter 3 a 30 caracteres (letras, números, _ . -).' };
    case 'id':
      return isValidEmployeeId(value)
        ? { valid: true }
        : { valid: false, message: 'Informe um ID de funcionário válido.' };
    default:
      return { valid: false, message: 'Método de login inválido.' };
  }
};

// Validação completa do formulário de login
export const validateLoginForm = ({ method, identifier, password }) => {
  const errors = {};
  const idResult = validateIdentifier(method, identifier);
  if (!idResult.valid) errors.identifier = idResult.message;
  if (!password || password.length === 0) errors.password = 'Senha é obrigatória.';
  return { valid: Object.keys(errors).length === 0, errors };
};

// Validação do formulário de criação de conta
export const validateCreateAccountForm = (data) => {
  const errors = {};
  if (!data.name || data.name.trim().length < 3) errors.name = 'Nome completo é obrigatório (mínimo 3 caracteres).';
  if (!isValidEmail(data.email)) errors.email = 'Email inválido.';
  if (!isValidUsername(data.username)) errors.username = 'Usuário inválido (3 a 30 caracteres alfanuméricos).';
  if (data.cpfCnpj && !isValidCpfCnpj(data.cpfCnpj)) errors.cpfCnpj = 'CPF ou CNPJ inválido.';
  const pwdResult = validatePasswordStrength(data.password);
  if (!pwdResult.valid) errors.password = pwdResult.message;
  if (!passwordsMatch(data.password, data.passwordConfirm)) errors.passwordConfirm = 'As senhas não conferem.';
  return { valid: Object.keys(errors).length === 0, errors };
};

// Validação do formulário de criação de empresa
export const validateCreateCompanyForm = (data) => {
  const errors = {};
  if (!data.name || data.name.trim().length < 2) errors.name = 'Nome da empresa é obrigatório.';
  if (data.cnpj && !isValidCNPJ(data.cnpj)) errors.cnpj = 'CNPJ inválido.';
  if (data.email && !isValidEmail(data.email)) errors.email = 'Email institucional inválido.';
  if (data.phone && !isValidPhone(data.phone)) errors.phone = 'Telefone inválido.';
  return { valid: Object.keys(errors).length === 0, errors };
};

// Validação do formulário de recuperação de senha (etapa de solicitação)
export const validateRecoveryRequest = (method, identifier) => {
  const result = validateIdentifier(method, identifier);
  return result;
};

// Validação da etapa de redefinição (código + nova senha)
export const validateRecoveryReset = ({ code, newPassword, confirmPassword }) => {
  const errors = {};
  if (!code || code.trim().length < 4) errors.code = 'Informe o código de recuperação recebido.';
  const pwdResult = validatePasswordStrength(newPassword);
  if (!pwdResult.valid) errors.newPassword = pwdResult.message;
  if (!passwordsMatch(newPassword, confirmPassword)) errors.confirmPassword = 'As senhas não conferem.';
  return { valid: Object.keys(errors).length === 0, errors };
};

// Validação do formulário de contato
export const validateContactForm = (data) => {
  const errors = {};
  if (!data.name || data.name.trim().length < 3) errors.name = 'Informe seu nome.';
  if (!isValidEmail(data.email)) errors.email = 'Email inválido.';
  if (!data.message || data.message.trim().length < 10) errors.message = 'A mensagem deve ter ao menos 10 caracteres.';
  return { valid: Object.keys(errors).length === 0, errors };
};

export default {
  isValidEmail,
  isValidUsername,
  isValidEmployeeId,
  validatePasswordStrength,
  passwordStrengthScore,
  STRENGTH_LABELS,
  passwordsMatch,
  isValidCNPJ,
  isValidCPF,
  isValidCpfCnpj,
  isValidPhone,
  validateIdentifier,
  validateLoginForm,
  validateCreateAccountForm,
  validateCreateCompanyForm,
  validateRecoveryRequest,
  validateRecoveryReset,
  validateContactForm,
};
