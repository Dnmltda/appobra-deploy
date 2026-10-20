import { useEffect, useState } from 'react';

// Utilidades do painel inicial. Tudo aqui trabalha com dados reais do
// PocketBase: nada de número de exemplo.

export const STATUS_FECHADOS = ['Concluída', 'Cancelada', 'Rejeitada'];

// Mesma regra de pb_hooks/estoque-lib.js (SOMA / SUBTRAI).
export const TIPOS_ENTRADA = ['Entrada', 'Devolução', 'Retorno ao Almoxarifado', 'Devolução de Funcionário'];
export const TIPOS_SAIDA = ['Saída', 'Consumo de Obra', 'Retirada por Funcionário', 'Perda'];

// Ordem do fluxo do pedido (para o gráfico de status).
export const ORDEM_STATUS_PEDIDO = [
  'Aberta', 'Em análise', 'Aguardando aprovação', 'Aprovada', 'Em separação',
  'Pronto para retirada', 'Em execução', 'Concluída', 'Cancelada', 'Rejeitada',
];

// Próximo passo de cada status, do ponto de vista de quem gere os pedidos.
export const PROXIMO_PASSO_GESTAO = {
  'Aberta': 'Analisar o pedido',
  'Em análise': 'Terminar a análise',
  'Aguardando aprovação': 'Aprovar ou recusar',
  'Aprovada': 'Separar o material',
  'Em separação': 'Avisar que está pronto',
};

// Séries dos gráficos (paleta categórica validada: azul e laranja).
export const COR_SERIE_1 = '#2a78d6';
export const COR_SERIE_2 = '#eb6834';

export const formatCurrency = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatCurrencyCurto = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000000) return `R$ ${(n / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return formatCurrency(n);
};

export const formatNumber = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export const parseData = (d) => {
  if (!d) return null;
  const date = new Date(String(d).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDate = (d) => {
  const date = parseData(d);
  return date ? date.toLocaleDateString('pt-BR') : '-';
};

// Chave AAAA-MM-DD no fuso local.
export const chaveDia = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// Data no formato que o filtro do PocketBase entende (UTC).
export const dataFiltroPb = (date) => date.toISOString().replace('T', ' ').slice(0, 19);

export const statusPedidoClasse = (status) => {
  switch (status) {
    case 'Aprovada':
    case 'Concluída':
      return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30';
    case 'Em execução':
    case 'Em separação':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
    case 'Pronto para retirada':
      return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30';
    case 'Em análise':
    case 'Aguardando aprovação':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
    case 'Rejeitada':
    case 'Cancelada':
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30';
    default:
      return 'bg-muted text-foreground border-border';
  }
};

// Carrega um bloco do painel de forma isolada: se a coleção falhar, só
// aquele bloco mostra o erro, o resto da página continua.
// `fn` recebe nada e devolve uma Promise com os dados; `ativo` false = não busca.
export const useBlock = (fn, deps, ativo = true) => {
  const [state, setState] = useState({ loading: ativo, error: false, data: null });
  useEffect(() => {
    if (!ativo) { setState({ loading: false, error: false, data: null }); return undefined; }
    let vivo = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    (async () => {
      try {
        const data = await fn();
        if (vivo) setState({ loading: false, error: false, data });
      } catch (err) {
        console.error('[Painel] falha ao carregar bloco', err);
        if (vivo) setState({ loading: false, error: true, data: null });
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, ...deps]);
  return state;
};
