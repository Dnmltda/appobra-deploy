// Divergência de estoque (servidor: pb_hooks/divergencia-estoque.pb.js).
// Os motivos são os mesmos valores aceitos pelo servidor.
export const MOTIVOS_DIVERGENCIA = [
  'Contagem diferente do sistema',
  'Quebra ou dano',
  'Sumiço ou furto',
  'Vencido ou estragado',
  'Uso sem registro',
  'Erro de lançamento',
  'Outro',
];

// Tipos que mudam o saldo por diferença/perda e pedem motivo.
export const TIPOS_DIVERGENCIA = ['Inventário', 'Ajuste de Estoque', 'Perda'];

export const QUEM_AUTORIZA = 'Administrador, Diretoria, Gerência ou Engenheiro';
