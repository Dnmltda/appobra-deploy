import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { auditLog, AUDIT_ACTIONS } from '@/lib/auditLogger.js';
import Header from '@/components/Header.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search, AlertCircle, Users, Package, Wallet, Boxes,
  Undo2, Eye, Download, X,
} from 'lucide-react';
import { toast } from 'sonner';

const AUDIT_MODULE = 'Saldo por Funcionário';

const TIPO_RETIRADA_FUNC = 'Retirada por Funcionário';
const TIPO_DEVOLUCAO_FUNC = 'Devolução de Funcionário';

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatNumber = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const formatDate = (d) => {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const todayISO = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().split(' ')[0].slice(0, 5);

const usePermissions = (currentUser) => {
  const role = String(currentUser?.role || currentUser?.cargo || '').toLowerCase();
  const isAdmin = !!currentUser?.isAdmin || role === 'admin' || role === 'administrador' || role === 'diretoria';
  const isGerente = role.includes('gerente') || role.includes('mestre') || role.includes('diretor');
  const isAlmoxarife = role.includes('almoxar');
  const isComprador = role.includes('comprad');
  return {
    isAdmin,
    canMove: isAdmin || isGerente || isAlmoxarife || isComprador,
  };
};

const emptyDevolucaoForm = {
  material_id: '',
  quantidade: '',
  obra_id: '',
  observacoes: '',
};

const SaldoFuncionarioPage = () => {
  const { currentUser } = useAuth();
  const companyId = currentUser?.company_id;
  const perms = usePermissions(currentUser);

  const [lancamentos, setLancamentos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [obras, setObras] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterObra, setFilterObra] = useState('all');
  const [onlyComSaldo, setOnlyComSaldo] = useState('com');

  // Detalhe do funcionário
  const [detalheOpen, setDetalheOpen] = useState(false);
  const [detalheFunc, setDetalheFunc] = useState(null);

  // Devolução
  const [devolucaoOpen, setDevolucaoOpen] = useState(false);
  const [devolucaoFunc, setDevolucaoFunc] = useState(null);
  const [devolucaoForm, setDevolucaoForm] = useState(emptyDevolucaoForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // ---------- Carregar dados ----------
  const fetchAll = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const [lanc, funcs, mats, obs] = await Promise.all([
        pb.collection('saldo_funcionario').getFullList({
          filter: `company_id = "${companyId}"`,
          sort: '-created',
          expand: 'funcionario_id,material_id,obra_id,responsavel_id',
          $autoCancel: false,
        }),
        pb.collection('funcionarios').getFullList({
          filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false,
        }),
        pb.collection('materiais').getFullList({
          filter: `company_id = "${companyId}"`, sort: 'name', $autoCancel: false,
        }),
        pb.collection('obras').getFullList({
          filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false,
        }),
      ]);
      setLancamentos(lanc);
      setFuncionarios(funcs);
      setMateriais(mats);
      setObras(obs);
    } catch (err) {
      console.error('Erro ao carregar saldos por funcionário:', err);
      setError(true);
      toast.error('Erro ao carregar saldos por funcionário');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) fetchAll();
    else setLoading(false);
  }, [companyId, fetchAll]);

  // ---------- Realtime (LIVE DATA) ----------
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void pb.collection('saldo_funcionario').subscribe('*', (e) => {
      if (cancelled) return;
      if (e.record?.company_id !== companyId) return;
      fetchAll();
    }).catch((err) => console.error('Realtime subscription failed', err));
    return () => {
      cancelled = true;
      void pb.collection('saldo_funcionario').unsubscribe('*').catch(() => {});
    };
  }, [companyId, fetchAll]);

  // ---------- Cálculo de saldo por funcionário/material ----------
  // Retirada soma, Devolução subtrai.
  const saldoPorFuncionario = useMemo(() => {
    const map = new Map();
    lancamentos.forEach((l) => {
      const funcId = l.funcionario_id;
      const matId = l.material_id;
      if (!funcId || !matId) return;
      if (!map.has(funcId)) map.set(funcId, new Map());
      const mats = map.get(funcId);
      const sinal = l.tipo_operacao === 'Devolução' ? -1 : 1;
      mats.set(matId, (mats.get(matId) || 0) + sinal * Number(l.quantidade || 0));
    });
    return map;
  }, [lancamentos]);

  const materialById = useCallback(
    (id) => materiais.find((m) => m.id === id),
    [materiais],
  );

  // Linhas agregadas por funcionário para a listagem
  const linhasFuncionarios = useMemo(() => {
    return funcionarios.map((f) => {
      const mats = saldoPorFuncionario.get(f.id) || new Map();
      const itens = [];
      let totalQtd = 0;
      let valorTotal = 0;
      mats.forEach((qtd, matId) => {
        if (qtd <= 0) return;
        const mat = materialById(matId);
        itens.push({
          material_id: matId,
          nome: mat?.name || 'Material',
          codigo: mat?.code || '',
          unidade: mat?.unit || '',
          quantidade: qtd,
          valor: qtd * Number(mat?.unit_cost || 0),
        });
        totalQtd += qtd;
        valorTotal += qtd * Number(mat?.unit_cost || 0);
      });
      itens.sort((a, b) => a.nome.localeCompare(b.nome));
      return {
        funcionario: f,
        itens,
        totalItens: itens.length,
        totalQtd,
        valorTotal,
      };
    });
  }, [funcionarios, saldoPorFuncionario, materialById]);

  const filteredLinhas = useMemo(() => {
    let list = linhasFuncionarios;
    if (onlyComSaldo === 'com') list = list.filter((l) => l.totalItens > 0);
    if (onlyComSaldo === 'sem') list = list.filter((l) => l.totalItens === 0);
    if (filterObra !== 'all') {
      const funcIdsNaObra = new Set(
        lancamentos.filter((l) => l.obra_id === filterObra).map((l) => l.funcionario_id),
      );
      list = list.filter((l) => funcIdsNaObra.has(l.funcionario.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((l) =>
        (l.funcionario.nome || '').toLowerCase().includes(q) ||
        (l.funcionario.cpf || '').toLowerCase().includes(q) ||
        (l.funcionario.matricula || '').toLowerCase().includes(q) ||
        l.itens.some((i) => i.nome.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [linhasFuncionarios, onlyComSaldo, filterObra, searchQuery, lancamentos]);

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const comSaldo = linhasFuncionarios.filter((l) => l.totalItens > 0);
    const totalItens = comSaldo.reduce((s, l) => s + l.totalQtd, 0);
    const valorTotal = comSaldo.reduce((s, l) => s + l.valorTotal, 0);
    const retiradas = lancamentos.filter((l) => l.tipo_operacao === 'Retirada').length;
    const devolucoes = lancamentos.filter((l) => l.tipo_operacao === 'Devolução').length;
    return {
      funcionariosComSaldo: comSaldo.length,
      totalItens,
      valorTotal,
      operacoes: retiradas + devolucoes,
    };
  }, [linhasFuncionarios, lancamentos]);

  // ---------- Histórico de um funcionário ----------
  const historicoDoFuncionario = useCallback(
    (funcId) => lancamentos.filter((l) => l.funcionario_id === funcId),
    [lancamentos],
  );

  const linhaDoFuncionario = useCallback(
    (funcId) => linhasFuncionarios.find((l) => l.funcionario.id === funcId),
    [linhasFuncionarios],
  );

  const openDetalhe = (linha) => {
    setDetalheFunc(linha.funcionario);
    setDetalheOpen(true);
  };

  const openDevolucao = (linha) => {
    setDevolucaoFunc(linha.funcionario);
    setDevolucaoForm(emptyDevolucaoForm);
    setFormErrors({});
    setDevolucaoOpen(true);
  };

  // Materiais que o funcionário tem em posse (para o select de devolução)
  const materiaisEmPosse = useMemo(() => {
    if (!devolucaoFunc) return [];
    return linhaDoFuncionario(devolucaoFunc.id)?.itens || [];
  }, [devolucaoFunc, linhaDoFuncionario]);

  // ---------- Gerar número de movimentação ----------
  const generateNumero = useCallback(async () => {
    const year = new Date().getFullYear();
    if (!companyId) return `MOV-${year}-0001`;
    try {
      const result = await pb.collection('movimentacoes').getList(1, 1, {
        filter: `company_id = "${companyId}" && numero_movimentacao ~ "MOV-${year}-"`,
        sort: '-numero_movimentacao',
        $autoCancel: false,
      });
      let next = 1;
      if (result.items.length > 0) {
        const match = (result.items[0].numero_movimentacao || '').match(/MOV-\d{4}-(\d+)$/);
        if (match) next = parseInt(match[1], 10) + 1;
      }
      return `MOV-${year}-${String(next).padStart(4, '0')}`;
    } catch (e) {
      return `MOV-${year}-0001`;
    }
  }, [companyId]);

  // ---------- Registrar Devolução ----------
  const handleDevolucao = async (e) => {
    e?.preventDefault();
    if (!companyId) { toast.error('Empresa não identificada'); return; }
    if (!perms.canMove) { toast.error('Sem permissão para registrar devolução'); return; }
    if (!devolucaoFunc) return;

    const errs = {};
    if (!devolucaoForm.material_id) errs.material_id = 'Selecione um material';
    const qtd = Number(devolucaoForm.quantidade);
    if (!devolucaoForm.quantidade || Number.isNaN(qtd) || qtd <= 0) {
      errs.quantidade = 'Quantidade deve ser maior que zero';
    }
    const emPosse = materiaisEmPosse.find((i) => i.material_id === devolucaoForm.material_id);
    if (devolucaoForm.material_id && emPosse && qtd > emPosse.quantidade) {
      errs.quantidade = `Saldo insuficiente. Em posse: ${formatNumber(emPosse.quantidade)} ${emPosse.unidade}`;
    }
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const material = materialById(devolucaoForm.material_id);
      if (!material) throw new Error('Material não encontrado');

      const numero = await generateNumero();
      const valorUnit = Number(material.unit_cost || 0);
      const valorTotal = Number((qtd * valorUnit).toFixed(2));

      // 1. Criar movimentação de devolução (entrada no estoque)
      const movRec = await pb.collection('movimentacoes').create({
        numero_movimentacao: numero,
        data: todayISO(),
        hora: nowTime(),
        tipo: TIPO_DEVOLUCAO_FUNC,
        material_id: material.id,
        categoria: material.category || '',
        codigo: material.code || '',
        quantidade: qtd,
        unidade: material.unit || '',
        valor_unitario: valorUnit,
        valor_total: valorTotal,
        obra_id: devolucaoForm.obra_id || null,
        origem: 'Funcionário',
        destino: 'Almoxarifado',
        funcionario_id: devolucaoFunc.id,
        responsavel_id: currentUser.id,
        observacoes: devolucaoForm.observacoes || null,
        status: 'Aprovado',
        company_id: companyId,
        criado_por: currentUser.id,
      }, { $autoCancel: false });

      // 2. Criar lançamento de devolução no razão
      await pb.collection('saldo_funcionario').create({
        company_id: companyId,
        funcionario_id: devolucaoFunc.id,
        material_id: material.id,
        tipo_operacao: 'Devolução',
        quantidade: qtd,
        data_operacao: todayISO(),
        hora_operacao: nowTime(),
        obra_id: devolucaoForm.obra_id || null,
        movimentacao_id: movRec.id,
        responsavel_id: currentUser.id,
        observacoes: devolucaoForm.observacoes || null,
        criado_por: currentUser.id,
      }, { $autoCancel: false });

      // 3. Devolver a quantidade ao estoque do material
      const novoEstoque = Number(material.quantity_in_stock || 0) + qtd;
      const updated = await pb.collection('materiais').update(material.id, {
        quantity_in_stock: novoEstoque,
      }, { $autoCancel: false });
      setMateriais((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));

      toast.success(
        `Devolução registrada: ${numero} (+${formatNumber(qtd)} ${material.unit || ''}) de ${devolucaoFunc.nome}`,
      );
      await auditLog(
        AUDIT_ACTIONS.RECORD_CREATED,
        AUDIT_MODULE,
        `Devolução ${numero}: ${devolucaoFunc.nome} devolveu ${formatNumber(qtd)} ${material.unit || ''} de ${material.name}`,
      );

      setDevolucaoOpen(false);
      fetchAll();
    } catch (err) {
      console.error('Erro ao registrar devolução:', err);
      const msg = err?.response?.data
        ? Object.values(err.response.data).map((d) => d?.message).filter(Boolean).join(', ')
        : err.message || 'Erro ao registrar devolução';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ---------- Exportar CSV ----------
  const handleExport = () => {
    const rows = [['Funcionário', 'CPF', 'Material', 'Código', 'Quantidade', 'Unidade', 'Valor']];
    filteredLinhas.forEach((l) => {
      if (l.itens.length === 0) {
        rows.push([l.funcionario.nome || '', l.funcionario.cpf || '', '-', '', '0', '', '0']);
        return;
      }
      l.itens.forEach((i) => {
        rows.push([
          l.funcionario.nome || '', l.funcionario.cpf || '',
          i.nome, i.codigo, String(i.quantidade), i.unidade, String(i.valor.toFixed(2)),
        ]);
      });
    });
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `saldo-funcionarios-${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Exportação gerada');
    auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULE, 'Exportou saldo de materiais por funcionário');
  };

  const clearFilters = () => {
    setSearchQuery(''); setFilterObra('all'); setOnlyComSaldo('com');
  };
  const activeFilters = (searchQuery ? 1 : 0) + (filterObra !== 'all' ? 1 : 0) + (onlyComSaldo !== 'com' ? 1 : 0);

  const KpiCard = ({ icon: Icon, label, value, sub, color }) => (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className={`text-xl font-bold ${color || 'text-primary'} truncate`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
        <Icon className="w-8 h-8 text-primary/30 shrink-0" />
      </CardContent>
    </Card>
  );

  // ---------- Render guards ----------
  if (loading && lancamentos.length === 0 && funcionarios.length === 0) {
    return (
      <>
        <Helmet>
          <title>Saldo por Funcionário - DNM&LTDA</title>
          <meta name="description" content="Controle de materiais em posse de cada funcionário" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-72 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-12 w-full mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (!companyId) {
    return (
      <>
        <Helmet>
          <title>Saldo por Funcionário - DNM&LTDA</title>
          <meta name="description" content="Controle de materiais em posse de cada funcionário" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Empresa não identificada</h2>
          <p className="text-muted-foreground mb-6">Seu usuário não possui empresa vinculada.</p>
        </div>
      </>
    );
  }

  if (error && lancamentos.length === 0) {
    return (
      <>
        <Helmet>
          <title>Saldo por Funcionário - DNM&LTDA</title>
          <meta name="description" content="Controle de materiais em posse de cada funcionário" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar saldos</h2>
          <p className="text-muted-foreground mb-6">Houve um problema ao conectar com o banco de dados.</p>
          <Button onClick={fetchAll}>Tentar novamente</Button>
        </div>
      </>
    );
  }

  const detalheLinha = detalheFunc ? linhaDoFuncionario(detalheFunc.id) : null;
  const detalheHistorico = detalheFunc ? historicoDoFuncionario(detalheFunc.id) : [];

  return (
    <>
      <Helmet>
        <title>Saldo por Funcionário - DNM&LTDA</title>
        <meta name="description" content="Controle de materiais em posse de cada funcionário, com histórico de retiradas e devoluções integrado ao estoque" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Saldo por Funcionário</h1>
            <p className="text-muted-foreground">
              Materiais em posse de cada funcionário, com histórico de retiradas e devoluções
            </p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />Exportar
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Users} label="Funcionários com saldo" value={kpis.funcionariosComSaldo} sub="com materiais em posse" color="text-primary" />
          <KpiCard icon={Package} label="Itens em posse" value={formatNumber(kpis.totalItens)} sub="quantidade total" color="text-amber-600" />
          <KpiCard icon={Wallet} label="Valor em posse" value={formatCurrency(kpis.valorTotal)} sub="valor total" color="text-blue-600" />
          <KpiCard icon={Boxes} label="Operações" value={kpis.operacoes} sub="retiradas + devoluções" color="text-green-600" />
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <Input
                placeholder="Buscar por funcionário, CPF, matrícula ou material..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 px-0 text-base"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={onlyComSaldo} onValueChange={setOnlyComSaldo}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="com">Com saldo em posse</SelectItem>
                  <SelectItem value="sem">Sem saldo</SelectItem>
                  <SelectItem value="todos">Todos os funcionários</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterObra} onValueChange={setFilterObra}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Obra" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as obras</SelectItem>
                  {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela de funcionários */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead className="hidden md:table-cell">CPF</TableHead>
                  <TableHead>Materiais em posse</TableHead>
                  <TableHead>Qtd. total</TableHead>
                  <TableHead>Valor em posse</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinhas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {activeFilters > 0
                        ? 'Nenhum funcionário encontrado com os filtros aplicados'
                        : <>Nenhum funcionário com materiais em posse. Registre uma <Link to="/estoque" className="text-primary font-medium underline hover:text-primary/80">Retirada por Funcionário</Link> na página Estoque.</>}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLinhas.map((l) => (
                    <TableRow key={l.funcionario.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{l.funcionario.nome}</span>
                          <span className="text-xs text-muted-foreground md:hidden">{l.funcionario.cpf || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{l.funcionario.cpf || '-'}</TableCell>
                      <TableCell>
                        {l.itens.length === 0 ? (
                          <span className="text-muted-foreground text-sm">Nenhum</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 max-w-[320px]">
                            {l.itens.slice(0, 3).map((i) => (
                              <span key={i.material_id} className="text-xs px-2 py-1 bg-muted rounded-full">
                                {i.nome} · {formatNumber(i.quantidade)} {i.unidade}
                              </span>
                            ))}
                            {l.itens.length > 3 && (
                              <span className="text-xs px-2 py-1 bg-muted rounded-full">
                                +{l.itens.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{formatNumber(l.totalQtd)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(l.valorTotal)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" title="Ver histórico" onClick={() => openDetalhe(l)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {perms.canMove && (
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Registrar devolução"
                              className="text-green-600 hover:bg-green-500/10"
                              disabled={l.itens.length === 0}
                              onClick={() => openDevolucao(l)}
                            >
                              <Undo2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ---------- Modal Detalhe / Histórico ---------- */}
      <Dialog open={detalheOpen} onOpenChange={setDetalheOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalheFunc?.nome || 'Funcionário'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            CPF: {detalheFunc?.cpf || '-'} · Matrícula: {detalheFunc?.matricula || '-'}
          </p>

          <Tabs defaultValue="saldo" className="w-full">
            <TabsList className="mb-3">
              <TabsTrigger value="saldo">Saldo atual</TabsTrigger>
              <TabsTrigger value="retiradas">Retiradas</TabsTrigger>
              <TabsTrigger value="devolucoes">Devoluções</TabsTrigger>
            </TabsList>

            <TabsContent value="saldo">
              {!detalheLinha || detalheLinha.itens.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Este funcionário não possui materiais em posse.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalheLinha.itens.map((i) => (
                      <TableRow key={i.material_id}>
                        <TableCell className="font-medium">{i.nome}</TableCell>
                        <TableCell>{i.codigo || '-'}</TableCell>
                        <TableCell>{formatNumber(i.quantidade)} {i.unidade}</TableCell>
                        <TableCell>{formatCurrency(i.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {['Retirada', 'Devolução'].map((tipo) => (
              <TabsContent key={tipo} value={tipo === 'Retirada' ? 'retiradas' : 'devolucoes'}>
                {detalheHistorico.filter((h) => h.tipo_operacao === tipo).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma {tipo.toLowerCase()} registrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {detalheHistorico
                      .filter((h) => h.tipo_operacao === tipo)
                      .map((h) => (
                        <div key={h.id} className="flex items-start justify-between border-b pb-2 text-sm gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">
                              {h.expand?.material_id?.name || materialById(h.material_id)?.name || 'Material'}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatDate(h.data_operacao)} {h.hora_operacao || ''}
                              {' · '}Lançado por: {h.expand?.responsavel_id?.name || h.expand?.responsavel_id?.email || '-'}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Obra: {h.expand?.obra_id?.nome || '-'}
                              {h.observacoes ? ` · ${h.observacoes}` : ''}
                            </span>
                          </div>
                          <span className={`font-semibold shrink-0 ${tipo === 'Retirada' ? 'text-red-600' : 'text-green-600'}`}>
                            {tipo === 'Retirada' ? '-' : '+'}{formatNumber(h.quantidade)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal Devolução ---------- */}
      <Dialog open={devolucaoOpen} onOpenChange={(open) => { setDevolucaoOpen(open); if (!open) setFormErrors({}); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar Devolução — {devolucaoFunc?.nome || ''}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDevolucao} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dev_material">Material *</Label>
              <Select
                value={devolucaoForm.material_id || 'none'}
                onValueChange={(v) => setDevolucaoForm({ ...devolucaoForm, material_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger id="dev_material" className={formErrors.material_id ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Selecione um material em posse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {materiaisEmPosse.map((i) => (
                    <SelectItem key={i.material_id} value={i.material_id}>
                      {i.nome} — em posse: {formatNumber(i.quantidade)} {i.unidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.material_id && <p className="text-xs text-destructive">{formErrors.material_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dev_qtd">Quantidade *</Label>
              <Input
                id="dev_qtd" type="number" step="0.01" min="0"
                value={devolucaoForm.quantidade}
                onChange={(e) => setDevolucaoForm({ ...devolucaoForm, quantidade: e.target.value })}
                className={formErrors.quantidade ? 'border-destructive' : ''}
              />
              {formErrors.quantidade && <p className="text-xs text-destructive">{formErrors.quantidade}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dev_obra">Obra (opcional)</Label>
              <Select
                value={devolucaoForm.obra_id || 'none'}
                onValueChange={(v) => setDevolucaoForm({ ...devolucaoForm, obra_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger id="dev_obra"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dev_obs">Observações</Label>
              <Textarea
                id="dev_obs" rows={2} value={devolucaoForm.observacoes}
                onChange={(e) => setDevolucaoForm({ ...devolucaoForm, observacoes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDevolucaoOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? 'Salvando...' : 'Confirmar Devolução'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SaldoFuncionarioPage;
