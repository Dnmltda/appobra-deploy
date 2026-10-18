// Validações para o Módulo Cadastro de Usuários — APP OBRA
// Email, username, senha forte, CPF, telefone e validação completa do formulário.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_REGEX = /^[a-z0-9._-]{3,40}$/;

export const PERFIS_ACESSO = [
  "Administrador",
  "Gerência",
  "Engenheiro",
  "Mestre de Obras",
  "Almoxarife",
  "Comprador",
  "Financeiro",
  "RH",
  "Funcionário",
  "Cliente",
];

export const STATUS_USUARIO = ["Ativo", "Inativo"];

export const isValidEmail = (email) =>
  !!email && EMAIL_REGEX.test(String(email).trim().toLowerCase());

export const isValidUsername = (username) =>
  !!username && USERNAME_REGEX.test(String(username).trim().toLowerCase());

// Senha forte: mínimo 8 chars, maiúscula, minúscula, número, caractere especial
export const isStrongPassword = (pwd) => {
  if (!pwd || String(pwd).length < 8) return false;
  const s = String(pwd);
  if (!/[A-Z]/.test(s)) return false;
  if (!/[a-z]/.test(s)) return false;
  if (!/[0-9]/.test(s)) return false;
  if (!/[^A-Za-z0-9]/.test(s)) return false;
  return true;
};

export const passwordStrengthLabel = (pwd) => {
  if (!pwd) return { label: "—", color: "text-muted-foreground" };
  let score = 0;
  if (String(pwd).length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (String(pwd).length >= 12) score++;
  if (score <= 2) return { label: "Fraca", color: "text-red-600" };
  if (score <= 4) return { label: "Média", color: "text-amber-600" };
  return { label: "Forte", color: "text-green-600" };
};

// CPF — algoritmo dos dígitos verificadores
export const isValidCPF = (cpf) => {
  if (!cpf) return false;
  const cleaned = String(cpf).replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned.charAt(i), 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cleaned.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned.charAt(i), 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cleaned.charAt(10), 10);
};

// Telefone brasileiro — 10 ou 11 dígitos
export const isValidPhone = (phone) => {
  if (!phone) return false;
  const cleaned = String(phone).replace(/\D/g, "");
  return cleaned.length === 10 || cleaned.length === 11;
};

// Formatação — apenas exibição
export const formatCPF = (value) => {
  const c = String(value || "").replace(/\D/g, "").slice(0, 11);
  return c
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const formatPhone = (value) => {
  const c = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (c.length === 11) return c.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (c.length === 10) return c.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return c;
};

// Gera ID único numérico sequencial simples (fallback quando não informado)
export const generateIdUnico = () => {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `${ts}${rand}`;
};

// Gera senha temporária forte
export const generateTempPassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const nums = "23456789";
  const sym = "!@#$%&*";
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let pwd =
    pick(upper) + pick(lower) + pick(nums) + pick(sym) +
    Array.from({ length: 6 }, () => pick(upper + lower + nums + sym)).join("");
  return pwd
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

// Validação completa do formulário de usuário
// mode: "create" | "edit"
export const validateUsuarioForm = (data, mode = "create") => {
  const errors = {};

  if (!data.nome_completo || data.nome_completo.trim().length < 3)
    errors.nome_completo = "Nome completo é obrigatório (mín. 3 caracteres).";

  if (!data.email || !isValidEmail(data.email))
    errors.email = "Email inválido.";

  if (!data.username || !isValidUsername(data.username))
    errors.username = "Username inválido (3-40 chars: a-z, 0-9, . _ -).";

  if (!data.id_unico || String(data.id_unico).trim().length === 0)
    errors.id_unico = "ID único é obrigatório.";

  if (mode === "create") {
    if (!data.password || !isStrongPassword(data.password))
      errors.password = "Senha fraca: mín. 8 chars com maiúscula, minúscula, número e especial.";
    if (!data.passwordConfirm || data.passwordConfirm !== data.password)
      errors.passwordConfirm = "As senhas não correspondem.";
  } else if (data.password) {
    if (!isStrongPassword(data.password))
      errors.password = "Senha fraca: mín. 8 chars com maiúscula, minúscula, número e especial.";
    if (!data.passwordConfirm || data.passwordConfirm !== data.password)
      errors.passwordConfirm = "As senhas não correspondem.";
  }

  if (!data.cargo || String(data.cargo).trim().length === 0)
    errors.cargo = "Cargo é obrigatório.";

  if (!data.perfil_acesso)
    errors.perfil_acesso = "Selecione o perfil de acesso.";

  if (!data.company_id)
    errors.company_id = "Empresa é obrigatória.";

  if (data.telefone && !isValidPhone(data.telefone))
    errors.telefone = "Telefone inválido (10 ou 11 dígitos).";

  if (data.cpf && !isValidCPF(data.cpf))
    errors.cpf = "CPF inválido.";

  return { valid: Object.keys(errors).length === 0, errors };
};

export default {
  PERFIS_ACESSO,
  STATUS_USUARIO,
  isValidEmail,
  isValidUsername,
  isStrongPassword,
  passwordStrengthLabel,
  isValidCPF,
  isValidPhone,
  formatCPF,
  formatPhone,
  generateIdUnico,
  generateTempPassword,
  validateUsuarioForm,
};
