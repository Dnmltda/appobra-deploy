// Marcas para escolher no cadastro de material, em vez de digitar (pedido do
// Diego, 19/10/2026). A lista muda conforme o material (pelo nome e pela
// categoria); "Outra marca" deixa digitar quando não estiver na lista.

const M = {
  tinta: ['Suvinil', 'Coral', 'Sherwin-Williams', 'Lukscolor', 'Eucatex', 'Iquine', 'Renner', 'Hidracor', 'Farben', 'Anjo',
    'Ypiranga', 'Dacar', 'Montana', 'Sayerlack', 'Vedacit', 'Quartzolit'],
  fio: ['SIL', 'Prysmian', 'Cobrecom', 'Corfio', 'Conduspar', 'Induscabos', 'Megatron', 'Nambei', 'Cordeiro', 'Lamesa'],
  eletrica: ['Tramontina', 'Pial Legrand', 'Schneider', 'Steck', 'WEG', 'Siemens', 'Margirius', 'Fame', 'Alumbra', 'Iriel',
    'Soprano', 'Lorenzetti', 'Tigre', 'Amanco', 'Intral', 'Avant', 'Philips', 'Osram', 'Taschibra'],
  hidraulica: ['Tigre', 'Amanco', 'Krona', 'Fortlev', 'Astra', 'Docol', 'Deca', 'Fabrimar', 'Plastilit', 'Viqua', 'Lorenzetti',
    'Censi', 'Herc', 'Acqualimp', 'Japi'],
  cimento: ['Votoran', 'Cauê', 'Itambé', 'Cimpor', 'Nassau', 'Tupi', 'CSN', 'Liz', 'Mizu', 'Ciplan', 'Apodi', 'Campeão', 'Holcim'],
  argamassa: ['Quartzolit', 'Votomassa', 'Precon', 'Cimentcola', 'Fortaleza', 'Ligamax', 'Portokoll', 'Biancogres', 'Vedacit',
    'Viapol', 'Denver', 'Sika', 'Matrix'],
  aco: ['Gerdau', 'ArcelorMittal', 'Belgo', 'CSN', 'Simec', 'Morlan', 'Votorantim'],
  ferramenta: ['Tramontina', 'Vonder', 'Bosch', 'Makita', 'DeWalt', 'Stanley', 'Black+Decker', 'Gedore', 'Irwin', 'Starrett',
    'Worker', 'Einhell', 'Starfer', 'Famastil', 'Cortag'],
  epi: ['3M', 'Marluvas', 'Bracol', 'Kalipso', 'Danny', 'Volk', 'Delta Plus', 'MSA', 'Steelflex', 'Carbografite', 'Libus', 'Plastcor',
    'Super Safety'],
  acabamento: ['Portobello', 'Eliane', 'Biancogres', 'Ceusa', 'Cecrisa', 'Incepa', 'Delta', 'Portinari', 'Deca', 'Celite', 'Roca',
    'Docol', 'Lorenzetti', 'Pado', 'Papaiz', 'Aliança'],
  madeira: ['Duratex', 'Eucatex', 'Placo', 'Knauf', 'Gypsum', 'Masisa', 'Berneck', 'Guararapes'],
  cobertura: ['Eternit', 'Brasilit', 'Precon', 'Isoeste', 'Perfilor', 'Imbralit'],
};

export function marcasPara(categoria = '', nome = '') {
  const n = `${nome}`.toLowerCase();
  if (/\b(tinta|esmalte|verniz|textura|massa corrida|massa acr|grafiato|spray|selador|fundo prep)/.test(n)) return M.tinta;
  if (/\b(fio|fios|cabo|cabos|cabinho)\b/.test(n)) return M.fio;
  if (/\b(cimento)\b/.test(n)) return M.cimento;
  if (/\b(argamassa|rejunte|reboco|impermeab|aditivo)/.test(n)) return M.argamassa;
  if (/\b(vergalh|ferro|a[cç]o|arame|prego|tela soldada|treli)/.test(n)) return M.aco;
  if (/\b(telha|cumeeira|caixa d.?[aá]gua)/.test(n)) return M.cobertura;
  if (/\b(tubo|tubos|cano|canos|conex|joelho|luva|registro|torneira|v[aá]lvula|sif[aã]o|ralo)/.test(n)) return M.hidraulica;
  if (/\b(tomada|interruptor|disjuntor|l[aâ]mpada|lumin|quadro|chuveiro|eletroduto|plug)/.test(n)) return M.eletrica;
  if (/\b(piso|porcelanato|azulejo|revestimento|vaso|pia|cuba|fechadura|lou[cç]a)/.test(n)) return M.acabamento;
  const porCategoria = {
    'Pintura': M.tinta, 'Elétrica': [...M.fio, ...M.eletrica], 'Hidráulica': M.hidraulica,
    'Materiais de Construção': [...M.cimento, ...M.argamassa, ...M.cobertura], 'Ferragens': M.aco, 'Metalúrgicos': M.aco,
    'Ferramentas': M.ferramenta, 'EPI': M.epi, 'Acabamento': M.acabamento, 'Madeira': M.madeira,
  };
  const lista = porCategoria[categoria];
  if (lista) return [...new Set(lista)];
  return [...new Set(Object.values(M).flat())].sort((a, b) => a.localeCompare(b));
}
