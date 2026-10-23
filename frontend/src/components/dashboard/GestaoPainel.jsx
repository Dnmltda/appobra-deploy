import React, { useMemo } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { podeAcessar, podeGerirSolicitacoes } from '@/lib/permissoes.js';
import {
  Building2, Users, PackageMinus, ClipboardList, AlertTriangle, CheckCircle2,
  BarChart3, ArrowLeftRight, Wallet, PackageCheck, ListChecks, Rocket, Package,
} from 'lucide-react';
import {
  KpiCard, BlockCard, EmptyState, BlockError, BlockSkeleton, ListRow, StatusPill,
} from './DashboardBlocks.jsx';
import { ListaEntrada } from '@/components/marca/Entrada.jsx';
import { GastoPorObraChart, MovimentacoesDiaChart, PedidosStatusChart } from './DashboardCharts.jsx';
import {
  useBlock, STATUS_FECHADOS, TIPOS_ENTRADA, TIPOS_SAIDA, ORDEM_STATUS_PEDIDO, PROXIMO_PASSO_GESTAO,
  formatCurrency, formatNumber, formatDate, parseData, chaveDia, dataFiltroPb, statusPedidoClasse,
} from './dashboardUtils.js';

// Painel de quem gere (escritório, engenharia, almoxarifado, compras, RH...).
// Cada bloco só aparece se o cargo tem acesso ao módulo, e cada um busca seus
// dados sozinho: se uma coleção falhar, os outros blocos continuam.

const STATUS_OBRA_CLASSE = {
  'Em Andamento': 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  'Planejamento': 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
  'Pausada': 'bg-muted text-muted-foreground border-border',
  'Concluída': 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
};
const ORDEM_OBRA = ['Em Andamento', 'Planejamento', 'Pausada', 'Concluída'];

const GestaoPainel = ({ user, refreshKey }) => {
  const cid = user.company_id;
  const C = `company_id = "${cid}"`;
  const pode = (m) => podeAcessar(user, m);
  const gereSolicitacoes = podeGerirSolicitacoes(user);
  const verObras = pode('obras');
  const verFuncionarios = pode('funcionarios');
  const verMateriais = pode('materiais') || pode('estoque');
  const rotaMateriais = pode('materiais') ? '/materiais' : '/estoque';
  const verPedidos = pode('solicitacoes');
  const verOcorrencias = pode('ocorrencias');
  const verGasto = pode('materiais_obra');
  const verMov = pode('movimentacoes');

  // ---------- Obras ----------
  const obras = useBlock(async () => pb.collection('obras').getFullList({
    filter: C, sort: 'nome', fields: 'id,nome,status', $autoCancel: false,
  }), [cid, refreshKey], verObras);

  // ---------- Funcionários ativos ----------
  // Mesmo critério da tela de Funcionários: status vazio conta como Ativo.
  const funcionarios = useBlock(async () => {
    const r = await pb.collection('funcionarios').getList(1, 1, {
      filter: `${C} && deleted_at = "" && status != "Inativo" && status != "Afastado"`,
      fields: 'id', $autoCancel: false,
    });
    return r.totalItems;
  }, [cid, refreshKey], verFuncionarios);

  // ---------- Materiais abaixo do mínimo ----------
  // Mesmo critério do servidor (pb_hooks/estoque-minimo-lib.js).
  const materiais = useBlock(async () => {
    const [total, comMinimo] = await Promise.all([
      pb.collection('materiais').getList(1, 1, { filter: C, fields: 'id', $autoCancel: false }),
      pb.collection('materiais').getFullList({
        filter: `${C} && min_quantity > 0 && status != "inactive" && deleted_at = ""`,
        fields: 'id,name,unit,quantity_in_stock,min_quantity', sort: 'name', $autoCancel: false,
      }),
    ]);
    const baixos = comMinimo
      .filter((m) => Number(m.quantity_in_stock || 0) <= Number(m.min_quantity || 0))
      .sort((a, b) => (Number(a.quantity_in_stock || 0) / Number(a.min_quantity))
        - (Number(b.quantity_in_stock || 0) / Number(b.min_quantity)));
    return { total: total.totalItems, baixos };
  }, [cid, refreshKey], verMateriais);

  // ---------- Pedidos de material ----------
  const pedidos = useBlock(async () => pb.collection('solicitacoes').getFullList({
    filter: C, sort: '-created',
    fields: 'id,status,numero_solicitacao,descricao,solicitante_id,created,prioridade,tipo',
    $autoCancel: false,
  }), [cid, refreshKey], verPedidos);

  // ---------- Ocorrências abertas ----------
  const ocorrencias = useBlock(async () => pb.collection('ocorrencias').getFullList({
    filter: `${C} && (status = "Aberta" || status = "Em andamento")`, sort: '-created',
    fields: 'id,numero,descricao,gravidade,status,tipo,created', $autoCancel: false,
  }), [cid, refreshKey], verOcorrencias);

  // ---------- Gasto de material por obra ----------
  const gasto = useBlock(async () => {
    const [obs, consumos, usos] = await Promise.all([
      pb.collection('obras').getFullList({ filter: C, fields: 'id,nome', $autoCancel: false }),
      pb.collection('movimentacoes').getFullList({
        filter: `${C} && tipo = "Consumo de Obra" && estoque_aplicado = true && obra_id != ""`,
        fields: 'obra_id,valor_total', $autoCancel: false,
      }),
      pb.collection('saldo_funcionario').getFullList({
        filter: `${C} && tipo_operacao = "Utilização" && obra_id != ""`,
        fields: 'obra_id,valor_total', $autoCancel: false,
      }).catch(() => []),
    ]);
    const nomes = new Map(obs.map((o) => [o.id, o.nome || 'Obra sem nome']));
    const porObra = new Map();
    const somar = (obraId, campo, valor) => {
      if (!porObra.has(obraId)) porObra.set(obraId, { nome: nomes.get(obraId) || 'Obra removida', entregue: 0, usado: 0, total: 0 });
      const linha = porObra.get(obraId);
      linha[campo] += valor;
      linha.total += valor;
    };
    consumos.forEach((m) => somar(m.obra_id, 'entregue', Number(m.valor_total || 0)));
    usos.forEach((u) => somar(u.obra_id, 'usado', Number(u.valor_total || 0)));
    const linhas = [...porObra.values()].sort((a, b) => b.total - a.total);
    return {
      registros: consumos.length + usos.length,
      linhas: linhas.filter((l) => l.total > 0).slice(0, 8),
      totalGeral: linhas.reduce((s, l) => s + l.total, 0),
      obrasComValor: linhas.filter((l) => l.total > 0).length,
    };
  }, [cid, refreshKey], verGasto);

  // ---------- Movimentações dos últimos 30 dias ----------
  const movs = useBlock(async () => {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - 29);
    const desde = dataFiltroPb(inicio);
    const lista = await pb.collection('movimentacoes').getFullList({
      filter: `${C} && (status = "Aprovado" || status = "Finalizado") && (data >= "${desde}" || (data = "" && created >= "${desde}"))`,
      fields: 'tipo,data,created', $autoCancel: false,
    });
    const dias = [];
    const idx = new Map();
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      const linha = { dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), entradas: 0, saidas: 0 };
      idx.set(chaveDia(d), linha);
      dias.push(linha);
    }
    let entradas = 0;
    let saidas = 0;
    lista.forEach((m) => {
      const d = parseData(m.data) || parseData(m.created);
      const linha = d && idx.get(chaveDia(d));
      if (!linha) return;
      if (TIPOS_ENTRADA.includes(m.tipo)) { linha.entradas += 1; entradas += 1; }
      else if (TIPOS_SAIDA.includes(m.tipo)) { linha.saidas += 1; saidas += 1; }
    });
    return { dias, entradas, saidas, total: lista.length };
  }, [cid, refreshKey], verMov);

  // ---------- Derivados ----------
  const obrasResumo = useMemo(() => {
    const lista = obras.data || [];
    const contagem = {};
    lista.forEach((o) => { const s = o.status || 'Sem status'; contagem[s] = (contagem[s] || 0) + 1; });
    const ordenadas = [...lista].sort((a, b) => {
      const ia = ORDEM_OBRA.indexOf(a.status); const ib = ORDEM_OBRA.indexOf(b.status);
      return (ia === -1 ? 9 : ia) - (ib === -1 ? 9 : ib);
    });
    return { total: lista.length, emAndamento: contagem['Em Andamento'] || 0, contagem, ordenadas };
  }, [obras.data]);

  const pedidosAbertos = useMemo(
    () => (pedidos.data || []).filter((s) => !STATUS_FECHADOS.includes(s.status)),
    [pedidos.data],
  );

  const pedidosPorStatus = useMemo(() => {
    const cont = {};
    (pedidos.data || []).forEach((s) => { const st = s.status || 'Sem status'; cont[st] = (cont[st] || 0) + 1; });
    const ordem = [...ORDEM_STATUS_PEDIDO, ...Object.keys(cont).filter((k) => !ORDEM_STATUS_PEDIDO.includes(k))];
    return ordem.filter((s) => cont[s]).map((s) => ({ status: s, total: cont[s] }));
  }, [pedidos.data]);

  const ocorrenciasAltas = useMemo(
    () => (ocorrencias.data || []).filter((o) => o.gravidade === 'Alta'),
    [ocorrencias.data],
  );

  // "Precisa da sua atenção": o que espera uma ação de alguém.
  const atencao = useMemo(() => {
    const itens = [];
    (pedidos.data || [])
      .filter((s) => s.status === 'Pronto para retirada' && s.solicitante_id === user.id)
      .forEach((s) => itens.push({
        key: `p-${s.id}`, to: `/solicitacoes/${s.id}`, icon: PackageCheck, tone: 'green',
        title: `${s.numero_solicitacao || 'Seu pedido'} está pronto para você retirar`,
        subtitle: s.descricao || 'Pedido de material',
      }));
    ocorrenciasAltas.forEach((o) => itens.push({
      key: `o-${o.id}`, to: '/ocorrencias', icon: AlertTriangle, tone: 'red',
      title: `Ocorrência grave: ${o.tipo || 'ocorrência'}${o.numero ? ` (${o.numero})` : ''}`,
      subtitle: o.descricao || `Registrada em ${formatDate(o.created)}`,
    }));
    if (gereSolicitacoes) {
      (pedidos.data || [])
        .filter((s) => PROXIMO_PASSO_GESTAO[s.status])
        .forEach((s) => itens.push({
          key: `g-${s.id}`, to: `/solicitacoes/${s.id}`, icon: ClipboardList, tone: 'amber',
          title: `${s.numero_solicitacao || 'Pedido'}: ${PROXIMO_PASSO_GESTAO[s.status]}`,
          subtitle: `${s.status}${s.descricao ? ` · ${s.descricao}` : ''}`,
        }));
    }
    (materiais.data?.baixos || []).forEach((m) => itens.push({
      key: `m-${m.id}`, to: rotaMateriais, icon: PackageMinus, tone: 'amber',
      title: `${m.name} abaixo do mínimo`,
      subtitle: `Tem ${formatNumber(m.quantity_in_stock)} ${m.unit || ''} · mínimo ${formatNumber(m.min_quantity)} ${m.unit || ''}`,
    }));
    return itens;
  }, [pedidos.data, ocorrenciasAltas, materiais.data, gereSolicitacoes, user.id, rotaMateriais]);

  const fontesAtencao = [verPedidos && pedidos, verOcorrencias && ocorrencias, verMateriais && materiais].filter(Boolean);
  const mostrarAtencao = fontesAtencao.length > 0;
  const atencaoCarregando = fontesAtencao.some((f) => f.loading);
  const atencaoErro = mostrarAtencao && fontesAtencao.every((f) => f.error);
  const atencaoParcial = !atencaoErro && fontesAtencao.some((f) => f.error);
  const LIMITE_ATENCAO = 8;

  // ---------- KPIs ----------
  const kpis = [];
  if (verObras) {
    kpis.push(
      <KpiCard
        key="obras" to="/projects" icon={Building2} label="Obras em andamento"
        value={obrasResumo.emAndamento} loading={obras.loading} error={obras.error}
        hint={obrasResumo.total ? `de ${obrasResumo.total} cadastrada(s)` : 'Nenhuma obra cadastrada'}
      />,
    );
  }
  if (verFuncionarios) {
    kpis.push(
      <KpiCard
        key="func" to="/employees" icon={Users} label="Funcionários ativos" tone="blue"
        value={funcionarios.data ?? 0} loading={funcionarios.loading} error={funcionarios.error}
      />,
    );
  }
  if (verMateriais) {
    const nBaixo = materiais.data?.baixos.length ?? 0;
    kpis.push(
      <KpiCard
        key="mat" to={rotaMateriais} icon={PackageMinus} label="Materiais com estoque baixo"
        tone={nBaixo > 0 ? 'red' : 'green'} value={nBaixo}
        loading={materiais.loading} error={materiais.error}
        hint={materiais.data && materiais.data.total === 0 ? 'Nenhum material cadastrado' : undefined}
      />,
    );
  }
  if (verPedidos) {
    kpis.push(
      <KpiCard
        key="ped" to="/solicitacoes" icon={ClipboardList} label="Pedidos de material abertos"
        value={pedidosAbertos.length} loading={pedidos.loading} error={pedidos.error}
        hint={pedidos.data ? `${pedidos.data.length} no total` : undefined}
      />,
    );
  }
  if (verOcorrencias) {
    const n = ocorrencias.data?.length ?? 0;
    kpis.push(
      <KpiCard
        key="oco" to="/ocorrencias" icon={AlertTriangle} label="Ocorrências abertas"
        tone={ocorrenciasAltas.length > 0 ? 'red' : 'primary'} value={n}
        loading={ocorrencias.loading} error={ocorrencias.error}
        hint={ocorrenciasAltas.length ? `${ocorrenciasAltas.length} de gravidade alta` : undefined}
      />,
    );
  }

  // Empresa sem nada cadastrado: em vez de uma tela cheia de zeros, mostra
  // os primeiros passos (com links para onde cadastrar).
  const fontesBase = [
    verObras && { b: obras, vazio: (d) => d.length === 0 },
    verFuncionarios && { b: funcionarios, vazio: (d) => d === 0 },
    verMateriais && { b: materiais, vazio: (d) => d.total === 0 },
    verPedidos && { b: pedidos, vazio: (d) => d.length === 0 },
    verOcorrencias && { b: ocorrencias, vazio: (d) => d.length === 0 },
  ].filter(Boolean);
  const empresaVazia = (verObras || verMateriais) && fontesBase.length > 0
    && fontesBase.every(({ b, vazio }) => !b.loading && !b.error && b.data !== null && vazio(b.data));

  if (empresaVazia) {
    const passos = [];
    if (verObras) passos.push({ to: '/projects', icon: Building2, title: 'Cadastrar a primeira obra', subtitle: 'Nenhuma obra cadastrada ainda' });
    if (pode('materiais')) passos.push({ to: '/materiais', icon: Package, title: 'Cadastrar os materiais', subtitle: 'Com estoque mínimo, para o app avisar quando faltar' });
    if (verFuncionarios) passos.push({ to: '/employees', icon: Users, title: 'Cadastrar os funcionários', subtitle: 'E ligar cada um à sua obra' });
    if (verMov) passos.push({ to: '/movimentacoes', icon: ArrowLeftRight, title: 'Lançar a entrada de material', subtitle: 'O que já está no almoxarifado' });
    return (
      <BlockCard
        title="Vamos começar" icon={Rocket}
        description="Sua empresa ainda não tem dados cadastrados. Assim que você cadastrar, os números e gráficos aparecem aqui sozinhos."
      >
        <div className="space-y-2">
          {passos.map((p) => <ListRow key={p.to} {...p} />)}
        </div>
      </BlockCard>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {kpis.length > 0 && (
        <ListaEntrada className={`grid grid-cols-2 gap-3 sm:gap-4 ${kpis.length >= 5 ? 'md:grid-cols-3 xl:grid-cols-5' : kpis.length === 4 ? 'lg:grid-cols-4' : 'md:grid-cols-3'}`}>
          {kpis}
        </ListaEntrada>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {mostrarAtencao && (
          <BlockCard
            title="Precisa da sua atenção" icon={ListChecks} className="lg:col-span-2"
            description="Pedidos esperando o próximo passo, materiais abaixo do mínimo e ocorrências graves."
          >
            {atencaoParcial && !atencaoCarregando && (
              <p className="text-xs text-muted-foreground mb-2">Parte destas informações não pôde ser carregada agora.</p>
            )}
            {atencaoCarregando ? <BlockSkeleton rows={4} /> : atencaoErro ? <BlockError /> : atencao.length === 0 ? (
              <EmptyState
                icon={CheckCircle2} title={atencaoParcial ? 'Nada pendente no que foi carregado' : 'Tudo em dia'}
                text="Nenhum pedido parado, nenhum material abaixo do mínimo e nenhuma ocorrência grave aberta."
              />
            ) : (
              <div className="space-y-2">
                {atencao.slice(0, LIMITE_ATENCAO).map((i) => (
                  <ListRow key={i.key} to={i.to} icon={i.icon} iconTone={i.tone} title={i.title} subtitle={i.subtitle} />
                ))}
                {atencao.length > LIMITE_ATENCAO && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    E mais {atencao.length - LIMITE_ATENCAO} item(ns). Abra cada módulo para ver tudo.
                  </p>
                )}
              </div>
            )}
          </BlockCard>
        )}

        {verObras && (
          <BlockCard title="Obras" icon={Building2} to="/projects" className={mostrarAtencao ? '' : 'lg:col-span-3'}>
            {obras.loading ? <BlockSkeleton rows={3} /> : obras.error ? <BlockError /> : obrasResumo.total === 0 ? (
              <EmptyState
                icon={Building2} title="Nenhuma obra cadastrada ainda"
                text="Cadastre a primeira obra para acompanhar material, pedidos e equipe por obra."
                actionLabel="Cadastrar obra" actionTo="/projects"
              />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(obrasResumo.contagem).map(([s, n]) => (
                    <StatusPill key={s} className={STATUS_OBRA_CLASSE[s]}>{n} {s}</StatusPill>
                  ))}
                </div>
                <div className="space-y-2">
                  {obrasResumo.ordenadas.slice(0, 5).map((o) => (
                    <ListRow
                      key={o.id} to="/projects" icon={Building2} title={o.nome || 'Obra sem nome'}
                      subtitle={o.status || 'Sem status'}
                    />
                  ))}
                </div>
                {obrasResumo.total > 5 && (
                  <p className="text-xs text-muted-foreground text-center">Mostrando 5 de {obrasResumo.total} obras.</p>
                )}
              </div>
            )}
          </BlockCard>
        )}
      </div>

      {(verGasto || verMov || verPedidos) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {verGasto && (
            <BlockCard
              title="Gasto de material por obra" icon={Wallet} to="/materiais-por-obra" linkLabel="Detalhes"
              description={gasto.data && gasto.data.totalGeral > 0
                ? `Total: ${formatCurrency(gasto.data.totalGeral)} em ${gasto.data.obrasComValor} obra(s)`
                : 'Material entregue na obra + material usado por funcionário na obra'}
            >
              {gasto.loading ? <BlockSkeleton chart /> : gasto.error ? <BlockError /> : gasto.data.linhas.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title={gasto.data.registros > 0 ? 'Usos registrados ainda sem valor' : 'Nenhum material gasto em obra ainda'}
                  text={gasto.data.registros > 0
                    ? `Há ${gasto.data.registros} uso(s) de material em obra, mas sem preço. Cadastre o custo dos materiais para ver o gasto em reais.`
                    : 'Quando o almoxarifado entregar material para uma obra (Consumo de Obra) ou um funcionário registrar o uso, o gasto aparece aqui.'}
                  actionLabel="Ver materiais por obra" actionTo="/materiais-por-obra"
                />
              ) : (
                <GastoPorObraChart data={gasto.data.linhas} />
              )}
            </BlockCard>
          )}

          {verMov && (
            <BlockCard
              title="Movimentações de estoque" icon={ArrowLeftRight} to="/movimentacoes"
              description={movs.data && movs.data.total > 0
                ? `Últimos 30 dias: ${movs.data.entradas} entrada(s) e ${movs.data.saidas} saída(s) aprovadas`
                : 'Entradas e saídas aprovadas por dia, últimos 30 dias'}
            >
              {movs.loading ? <BlockSkeleton chart /> : movs.error ? <BlockError /> : (movs.data.entradas + movs.data.saidas) === 0 ? (
                <EmptyState
                  icon={ArrowLeftRight} title="Nenhuma entrada ou saída aprovada nos últimos 30 dias"
                  actionLabel="Registrar movimentação" actionTo="/movimentacoes"
                />
              ) : (
                <MovimentacoesDiaChart data={movs.data.dias} />
              )}
            </BlockCard>
          )}

          {verPedidos && (
            <BlockCard
              title="Pedidos por status" icon={BarChart3} to="/solicitacoes"
              description={pedidos.data && pedidos.data.length > 0 ? `${pedidos.data.length} pedido(s) no total` : undefined}
            >
              {pedidos.loading ? <BlockSkeleton chart /> : pedidos.error ? <BlockError /> : pedidosPorStatus.length === 0 ? (
                <EmptyState
                  icon={ClipboardList} title="Nenhum pedido de material ainda"
                  actionLabel="Fazer um pedido" actionTo="/solicitacoes"
                />
              ) : (
                <PedidosStatusChart data={pedidosPorStatus} />
              )}
            </BlockCard>
          )}

          {verPedidos && (
            <BlockCard title="Últimos pedidos" icon={ClipboardList} to="/solicitacoes">
              {pedidos.loading ? <BlockSkeleton rows={4} /> : pedidos.error ? <BlockError /> : pedidos.data.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nenhum pedido de material ainda" />
              ) : (
                <div className="space-y-2">
                  {pedidos.data.slice(0, 5).map((s) => (
                    <ListRow
                      key={s.id} to={`/solicitacoes/${s.id}`} title={s.numero_solicitacao || 'Pedido'}
                      subtitle={`${formatDate(s.created)}${s.descricao ? ` · ${s.descricao}` : ''}`}
                      right={<StatusPill className={statusPedidoClasse(s.status)}>{s.status || 'Sem status'}</StatusPill>}
                    />
                  ))}
                </div>
              )}
            </BlockCard>
          )}
        </div>
      )}
    </div>
  );
};

export default GestaoPainel;
