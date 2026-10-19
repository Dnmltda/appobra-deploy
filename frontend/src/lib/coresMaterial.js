// Cores para escolher no cadastro de material, em vez de digitar (pedido do
// Diego, 19/10/2026). A lista muda conforme a categoria: fio tem as cores da
// norma (NBR 5410), tubo e conexão as cores de cada linha, tinta as cores
// mais vendidas; o resto usa a lista geral.

const C = (nome, hex, dica = '') => ({ nome, hex, dica });

export const CORES_FIO = [
  C('Preto', '#111827', 'fase'),
  C('Vermelho', '#dc2626', 'fase'),
  C('Branco', '#ffffff', 'fase ou retorno'),
  C('Marrom', '#7c4a1e', 'fase'),
  C('Cinza', '#9ca3af', 'fase ou retorno'),
  C('Amarelo', '#facc15', 'retorno'),
  C('Laranja', '#f97316', 'retorno'),
  C('Violeta', '#7c3aed', 'retorno'),
  C('Rosa', '#f472b6'),
  C('Azul claro', '#7dd3fc', 'neutro'),
  C('Azul escuro', '#1e3a8a'),
  C('Verde', '#16a34a', 'terra / proteção'),
  C('Verde-amarelo', 'linear-gradient(90deg,#16a34a 50%,#facc15 50%)', 'terra / proteção'),
];

export const CORES_TUBO = [
  C('Marrom', '#7c4a1e', 'água fria soldável'),
  C('Branco', '#ffffff', 'esgoto ou roscável'),
  C('Laranja', '#f97316', 'água quente (CPVC)'),
  C('Azul', '#2563eb', 'PPR água fria / pressão'),
  C('Verde', '#16a34a', 'PPR água quente'),
  C('Cinza', '#9ca3af', 'PPR / elétrica'),
  C('Preto', '#111827', 'corrugado / mangueira'),
  C('Amarelo', '#facc15', 'eletroduto corrugado / gás'),
  C('Vermelho', '#dc2626', 'incêndio'),
  C('Transparente', 'repeating-linear-gradient(45deg,#e5e7eb 0 4px,#ffffff 4px 8px)', 'mangueira de nível'),
];

export const CORES_TINTA = [
  C('Branco neve', '#ffffff'),
  C('Branco gelo', '#f1f5f9'),
  C('Marfim', '#fdf6e3'),
  C('Palha', '#efe2b3'),
  C('Areia', '#d8c3a5'),
  C('Bege', '#e7d3b0'),
  C('Pérola', '#ece7dd'),
  C('Concreto', '#a8a29e'),
  C('Cinza', '#9ca3af'),
  C('Grafite', '#374151'),
  C('Preto', '#111827'),
  C('Amarelo', '#facc15'),
  C('Laranja', '#f97316'),
  C('Vermelho', '#dc2626'),
  C('Terracota', '#c2552d'),
  C('Marrom', '#7c4a1e'),
  C('Verde', '#16a34a'),
  C('Azul', '#2563eb'),
  C('Rosa', '#f472b6'),
  C('Lilás', '#c4b5fd'),
  C('Incolor', 'repeating-linear-gradient(45deg,#e5e7eb 0 4px,#ffffff 4px 8px)', 'verniz / selador'),
];

export const CORES_GERAL = [
  C('Branco', '#ffffff'),
  C('Preto', '#111827'),
  C('Cinza', '#9ca3af'),
  C('Grafite', '#374151'),
  C('Prata', '#cbd5e1'),
  C('Inox', '#d1d5db'),
  C('Galvanizado', '#b6bfc8'),
  C('Bege', '#e7d3b0'),
  C('Marfim', '#fdf6e3'),
  C('Areia', '#d8c3a5'),
  C('Marrom', '#7c4a1e'),
  C('Tabaco', '#6b4423'),
  C('Madeira natural', '#c19a6b'),
  C('Amarelo', '#facc15'),
  C('Laranja', '#f97316'),
  C('Vermelho', '#dc2626'),
  C('Terracota', '#c2552d'),
  C('Rosa', '#f472b6'),
  C('Violeta', '#7c3aed'),
  C('Azul', '#2563eb'),
  C('Azul claro', '#7dd3fc'),
  C('Verde', '#16a34a'),
  C('Verde-amarelo', 'linear-gradient(90deg,#16a34a 50%,#facc15 50%)'),
  C('Dourado', '#d4a017'),
  C('Bronze', '#a97142'),
  C('Cobre', '#b87333'),
  C('Transparente', 'repeating-linear-gradient(45deg,#e5e7eb 0 4px,#ffffff 4px 8px)'),
];

// Qual lista mostrar: pelo nome (fio, cabo, tubo, tinta...) e pela categoria.
export function coresPara(categoria = '', nome = '') {
  const n = `${nome}`.toLowerCase();
  if (/\b(fio|fios|cabo|cabos|cabinho)\b/.test(n)) return CORES_FIO;
  if (/\b(tubo|tubos|cano|canos|conex|joelho|luva|t[eê]|registro|mangueira|eletroduto)/.test(n)) return CORES_TUBO;
  if (/\b(tinta|esmalte|verniz|textura|massa corrida|grafiato|spray)/.test(n) || categoria === 'Pintura') return CORES_TINTA;
  if (categoria === 'Elétrica') return CORES_FIO;
  if (categoria === 'Hidráulica') return CORES_TUBO;
  return CORES_GERAL;
}

export const todasAsCores = () => {
  const vistas = new Map();
  [...CORES_FIO, ...CORES_TUBO, ...CORES_TINTA, ...CORES_GERAL].forEach((c) => { if (!vistas.has(c.nome)) vistas.set(c.nome, c); });
  return [...vistas.values()];
};

export const corPorNome = (nome) => todasAsCores().find((c) => c.nome === nome);

// O nome do material leva a cor (ex.: "Fio 2,5 mm Azul claro"), para os
// pedidos e o estoque mostrarem a diferença sem mudar todas as telas.
export function nomeComCor(nome, cor) {
  const n = String(nome || '').trim();
  if (!cor || n.toLowerCase().includes(String(cor).toLowerCase())) return n;
  return `${n} ${cor}`;
}
