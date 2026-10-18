// Validações para o Módulo Cadastro de Empresas — APP OBRA
// CNPJ, CPF, email, telefone, CEP e validação completa do formulário.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (email) => {
  if (!email) return false;
  return EMAIL_REGEX.test(String(email).trim().toLowerCase());
};

// CNPJ — algoritmo de validação dos dígitos verificadores
export const isValidCNPJ = (cnpj) => {
  if (!cnpj) return false;
  const cleaned = String(cnpj).replace(/\D/g, "");
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  const calc = (slice) => {
    let size = slice.length;
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(slice.charAt(size - i), 10) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };

  let base = cleaned.substring(0, 12);
  const d1 = calc(base);
  base += d1;
  const d2 = calc(base);
  return cleaned.endsWith(`${d1}${d2}`);
};

// CPF — algoritmo de validação dos dígitos verificadores
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

// CEP — 8 dígitos
export const isValidCEP = (cep) => {
  if (!cep) return false;
  const cleaned = String(cep).replace(/\D/g, "");
  return cleaned.length === 8;
};

// Estado (UF) — 2 letras
export const isValidUF = (uf) => {
  if (!uf) return false;
  const ufs = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ];
  return ufs.includes(String(uf).trim().toUpperCase());
};

export const ESTADOS_BRASILEIROS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "TO", nome: "Tocantins" },
];

export const PLANOS = ["Básico", "Profissional", "Empresarial", "Enterprise"];
export const STATUS_EMPRESA = ["Ativo", "Inativo"];

// Formatação — apenas exibição
export const formatCNPJ = (value) => {
  const c = String(value || "").replace(/\D/g, "").slice(0, 14);
  return c
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

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

export const formatCEP = (value) => {
  const c = String(value || "").replace(/\D/g, "").slice(0, 8);
  return c.replace(/(\d{5})(\d)/, "$1-$2");
};

// Validação completa do formulário de empresa
export const validateEmpresaForm = (data) => {
  const errors = {};

  if (!data.razao_social || data.razao_social.trim().length < 2)
    errors.razao_social = "Razão social é obrigatória.";
  if (!data.nome_fantasia || data.nome_fantasia.trim().length < 2)
    errors.nome_fantasia = "Nome fantasia é obrigatório.";
  if (!data.cnpj || !isValidCNPJ(data.cnpj))
    errors.cnpj = "CNPJ inválido.";
  if (!data.cep || !isValidCEP(data.cep))
    errors.cep = "CEP inválido (8 dígitos).";
  if (!data.endereco || data.endereco.trim().length < 3)
    errors.endereco = "Endereço é obrigatório.";
  if (!data.numero || String(data.numero).trim().length === 0)
    errors.numero = "Número é obrigatório.";
  if (!data.bairro || data.bairro.trim().length < 2)
    errors.bairro = "Bairro é obrigatório.";
  if (!data.cidade || data.cidade.trim().length < 2)
    errors.cidade = "Cidade é obrigatória.";
  if (!data.estado || !isValidUF(data.estado))
    errors.estado = "Selecione um estado (UF) válido.";
  if (!data.telefone || !isValidPhone(data.telefone))
    errors.telefone = "Telefone inválido (10 ou 11 dígitos).";
  if (data.whatsapp && !isValidPhone(data.whatsapp))
    errors.whatsapp = "WhatsApp inválido.";
  if (!data.email || !isValidEmail(data.email))
    errors.email = "Email inválido.";
  if (data.website && !/^https?:\/\/.+\..+/.test(String(data.website).trim()))
    errors.website = "Website inválido (use http:// ou https://).";
  if (!data.responsavel_legal || data.responsavel_legal.trim().length < 3)
    errors.responsavel_legal = "Responsável legal é obrigatório.";
  if (!data.cpf_responsavel || !isValidCPF(data.cpf_responsavel))
    errors.cpf_responsavel = "CPF do responsável inválido.";

  return { valid: Object.keys(errors).length === 0, errors };
};

export default {
  isValidEmail,
  isValidCNPJ,
  isValidCPF,
  isValidPhone,
  isValidCEP,
  isValidUF,
  ESTADOS_BRASILEIROS,
  PLANOS,
  STATUS_EMPRESA,
  formatCNPJ,
  formatCPF,
  formatPhone,
  formatCEP,
  validateEmpresaForm,
};
