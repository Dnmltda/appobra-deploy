import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient.js';
import { podeAcessar } from '@/lib/permissoes.js';
import {
  Building2, ClipboardList, Package, PackagePlus, AlertTriangle, HardHat, Wrench, PackageCheck, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BlockCard, EmptyState, BlockError, BlockSkeleton, ListRow, StatusPill, QuickAction,
} from './DashboardBlocks.jsx';
import { useBlock, formatDate, formatNumber, statusPedidoClasse } from './dashboardUtils.js';

// Painel simples de quem trabalha na obra (Pedreiro, Servente, Encanador,
// Eletricista, Funcionário...): minha obra, meus pedidos, o material que está
// comigo e botões grandes para o que mais se faz no dia a dia.

const STATUS_OBRA_CLASSE = {
  'Em Andamento': 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  'Planejamento': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  'Pausada': 'bg-muted text-muted-foreground border-border',
  'Concluída': 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
};

const ObraPainel = ({ user, refreshKey }) => {
  const cid = user.company_id;
  const C = `company_id = "${cid}"`;
  const fid = user.funcionario_id || '';
  const pode = (m) => podeAcessar(user, m);
  const verPedidos = pode('solicitacoes');
  const verSaldo = pode('saldo_funcionario');
  const verMinhaObra = pode('minha_obra');

  // ---------- Minha obra ----------
  const minhaObra = useBlock(async () => {
    const f = await pb.collection('funcionarios').getOne(fid, {
      expand: 'obraId', fields: 'id,nome,obraId,expand.obraId.id,expand.obraId.nome,expand.obraId.status', $autoCancel: false,
    });
    return f.expand?.obraId || null;
  }, [fid, refreshKey], !!fid);

  // ---------- Meus pedidos ----------
  const meusPedidos = useBlock(async () => {
    const [ultimos, prontos] = await Promise.all([
      pb.collection('solicitacoes').getList(1, 5, {
        filter: `${C} && solicitante_id = "${user.id}"`, sort: '-created',
        fields: 'id,numero_solicitacao,descricao,status,created', $autoCancel: false,
      }),
      pb.collection('solicitacoes').getFullList({
        filter: `${C} && solicitante_id = "${user.id}" && status = "Pronto para retirada"`, sort: '-created',
        fields: 'id,numero_solicitacao,descricao', $autoCancel: false,
      }),
    ]);
    return { itens: ultimos.items, total: ultimos.totalItems, prontos };
  }, [cid, user.id, refreshKey], verPedidos);

  // ---------- Material comigo ----------
  // Mesma conta da tela Saldo por Funcionário: Retirada soma, o resto subtrai.
  const saldo = useBlock(async () => {
    const lanc = await pb.collection('saldo_funcionario').getFullList({
      filter: `${C} && funcionario_id = "${fid}"`, expand: 'material_id',
      fields: 'material_id,tipo_operacao,quantidade,expand.material_id.name,expand.material_id.unit',
      $autoCancel: false,
    });
    const mapa = new Map();
    lanc.forEach((l) => {
      if (!l.material_id) return;
      const atual = mapa.get(l.material_id) || {
        id: l.material_id, nome: l.expand?.material_id?.name || 'Material', unidade: l.expand?.material_id?.unit || '', qtd: 0,
      };
      atual.qtd += (l.tipo_operacao === 'Retirada' ? 1 : -1) * Number(l.quantidade || 0);
      mapa.set(l.material_id, atual);
    });
    return [...mapa.values()].filter((m) => m.qtd > 0).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [cid, fid, refreshKey], verSaldo && !!fid);

  const acoes = useMemo(() => {
    const a = [];
    if (verPedidos) a.push({ to: '/solicitacoes', icon: PackagePlus, label: 'Pedir material' });
    if (pode('ocorrencias')) a.push({ to: '/ocorrencias', icon: AlertTriangle, label: 'Registrar ocorrência' });
    if (pode('epis')) a.push({ to: '/rh/epis', icon: HardHat, label: 'EPIs' });
    if (pode('equipamentos')) a.push({ to: '/equipamentos', icon: Wrench, label: 'Equipamentos' });
    if (verSaldo) a.push({ to: '/saldo-funcionario', icon: Package, label: 'Material comigo' });
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const obra = minhaObra.data;
  const prontos = meusPedidos.data?.prontos || [];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Aviso de pedido pronto: o mais importante para quem está na obra. */}
      {prontos.length > 0 && (
        <Link
          to={prontos.length === 1 ? `/solicitacoes/${prontos[0].id}` : '/solicitacoes'}
          className="flex items-center gap-3 rounded-xl border border-green-500/40 bg-green-500/10 p-4 min-h-[64px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PackageCheck className="w-7 h-7 text-green-700 dark:text-green-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">
              {prontos.length === 1 ? 'Seu pedido está pronto para retirada' : `${prontos.length} pedidos prontos para retirada`}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {prontos.map((p) => p.numero_solicitacao).filter(Boolean).join(', ') || 'Toque para ver'}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
        </Link>
      )}

      {/* Minha obra */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="p-3 rounded-lg bg-primary/10 text-primary shrink-0"><Building2 className="w-6 h-6" aria-hidden="true" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">Minha obra</p>
              {!fid ? (
                <p className="text-sm text-foreground mt-1">
                  Seu usuário ainda não está ligado a um cadastro de funcionário. Peça ao escritório para fazer essa ligação.
                </p>
              ) : minhaObra.loading ? (
                <Skeleton className="h-7 w-48 mt-1" />
              ) : minhaObra.error ? (
                <p className="text-sm text-muted-foreground mt-1">Não foi possível carregar sua obra agora.</p>
              ) : !obra ? (
                <p className="text-sm text-foreground mt-1">Você ainda não está em nenhuma obra. Fale com o mestre de obras ou o escritório.</p>
              ) : (
                <>
                  <p className="text-xl font-bold text-foreground break-words">{obra.nome || 'Obra sem nome'}</p>
                  {obra.status && <StatusPill className={`mt-1 ${STATUS_OBRA_CLASSE[obra.status] || ''}`}>{obra.status}</StatusPill>}
                </>
              )}
            </div>
          </div>
          {verMinhaObra && obra && (
            <Link
              to="/minha-obra"
              className="mt-4 flex items-center justify-center gap-1 rounded-lg bg-primary text-primary-foreground font-medium h-11 px-4 hover:bg-primary/90"
            >
              Abrir minha obra <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          )}
        </CardContent>
      </Card>

      {acoes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {acoes.map((a) => <QuickAction key={a.to} {...a} />)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {verPedidos && (
          <BlockCard title="Meus pedidos" icon={ClipboardList} to="/solicitacoes">
            {meusPedidos.loading ? <BlockSkeleton rows={3} /> : meusPedidos.error ? <BlockError /> : meusPedidos.data.itens.length === 0 ? (
              <EmptyState
                icon={ClipboardList} title="Você ainda não fez nenhum pedido"
                text="Precisa de material ou EPI? Faça o pedido por aqui."
                actionLabel="Pedir material" actionTo="/solicitacoes"
              />
            ) : (
              <div className="space-y-2">
                {meusPedidos.data.itens.map((s) => (
                  <ListRow
                    key={s.id} to={`/solicitacoes/${s.id}`} title={s.numero_solicitacao || 'Pedido'}
                    subtitle={`${formatDate(s.created)}${s.descricao ? ` · ${s.descricao}` : ''}`}
                    right={<StatusPill className={statusPedidoClasse(s.status)}>{s.status || 'Sem status'}</StatusPill>}
                  />
                ))}
                {meusPedidos.data.total > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">Mostrando os 5 mais recentes de {meusPedidos.data.total}.</p>
                )}
              </div>
            )}
          </BlockCard>
        )}

        {verSaldo && (
          <BlockCard title="Material comigo" icon={Package} to="/saldo-funcionario" description="Material que você retirou e ainda não devolveu nem usou.">
            {!fid ? (
              <EmptyState icon={Package} title="Sem cadastro de funcionário" text="Peça ao escritório para ligar seu usuário ao seu cadastro." />
            ) : saldo.loading ? <BlockSkeleton rows={3} /> : saldo.error ? <BlockError /> : saldo.data.length === 0 ? (
              <EmptyState icon={Package} title="Nenhum material com você" text="Quando você retirar material do almoxarifado, ele aparece aqui." />
            ) : (
              <ul className="divide-y divide-border">
                {saldo.data.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-3 min-h-[48px]">
                    <span className="text-sm font-medium text-foreground min-w-0 break-words">{m.nome}</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground shrink-0">{formatNumber(m.qtd)} {m.unidade}</span>
                  </li>
                ))}
              </ul>
            )}
          </BlockCard>
        )}
      </div>
    </div>
  );
};

export default ObraPainel;
