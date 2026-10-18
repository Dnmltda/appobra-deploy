import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pencil, Search, AlertCircle, Eye, Download, FileSpreadsheet,
  Printer, XCircle, ChevronLeft, ChevronRight, Package,
  ArrowDownCircle, ArrowUpCircle, Wallet, Clock, History, Filter, X,
  Building2, Layers, Zap, Droplet, Wrench, Hammer, HardHat, TreePine, Cog, PaintBucket,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { mensagemErro } from '@/lib/erros.js';

const AUDIT_MODULE = 'Movimentações';
const PER_PAGE = 10;

const TIPOS = [
  'Entrada', 'Saída', 'Transferência', 'Devolução', 'Perda',
  'Ajuste de Estoque', 'Inventário', 'Consumo de Obra', 'Retorno ao Almoxarifado',
];
const STATUS_VALUES = ['Pendente', 'Aprovado', 'Cancelado', 'Finalizado'];

// Mesmo mapeamento de ícone por categoria usado em MateriaisPage.jsx — aqui
// serve pra filtrar visualmente a lista de materiais na hora de escolher
// qual material movimentou, em vez de rolar uma lista longa (pedido do
// Diego: o seletor por categoria também em Movimentações).
const CATEGORIA_ICONS = {
  'Materiais de Construção': Building2,
  'Acabamento': Layers,
  'Elétrica': Zap,
  'Hidráulica': Droplet,
  'Ferragens': Wrench,
  'Ferramentas': Hammer,
  'EPI': HardHat,
  'Madeira': TreePine,
  'Metalúrgicos': Cog,
  'Pintura': PaintBucket,
  'Outros': Package,
};
const getCategoriaIcon = (categoria) => CATEGORIA_ICONS[categoria] || Package;

const TIPO_COLORS = {
  'Entrada': '#16a34a',
  'Saída': '#dc2626',
  'Transferência': '#2563eb',
  'Devolução': '#0891b2',
  'Perda': '#b91c1c',
  'Ajuste de Estoque': '#ca8a04',
  'Inventário': '#7c3aed',
  'Consumo de Obra': '#ea580c',
  'Retorno ao Almoxarifado': '#0d9488',
};

const ENTRADA_TIPOS = ['Entrada', 'Retorno ao Almoxarifado', 'Devolução'];
const SAIDA_TIPOS = ['Saída', 'Consumo de Obra', 'Perda'];

const statusColor = (status) => {
  switch (status) {
    case 'Aprovado': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
    case 'Finalizado': return 'bg-green-500/10 text-green-700 border-green-500/20';
    case 'Cancelado': return 'bg-red-500/10 text-red-700 border-red-500/20';
    default: return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
  }
};

const tipoColor = (tipo) => TIPO_COLORS[tipo] || '#6b7280';

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatNumber = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const formatDate = (d) => {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const formatDateTime = (d) => {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const todayISO = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().split(' ')[0].slice(0, 5);

const emptyForm = {
  data: todayISO(),
  hora: nowTime(),
  tipo: 'Entrada',
  material_id: '',
  categoria: '',
  codigo: '',
  quantidade: '',
  unidade: '',
  valor_unitario: '',
  valor_total: 0,
  obra_id: '',
  centro_custo: '',
  origem: '',
  destino: '',
  fornecedor_id: '',
  solicitante_id: '',
  responsavel_id: '',
  funcionario_id: '',
  observacoes: '',
  status: 'Pendente',
};

// ---------- Permissões por role ----------
const usePermissions = (currentUser) => {
  const role = String(currentUser?.role || currentUser?.cargo || '').toLowerCase();
  const isAdmin = !!currentUser?.isAdmin || role === 'admin' || role === 'administrador' || role === 'diretoria';
  const isGerente = role.includes('gerente') || role.includes('mestre') || role.includes('diretor');
  const isAlmoxarife = role.includes('almoxar');
  const isComprador = role.includes('comprad');
  const isFuncionario = !isAdmin && !isGerente && !isAlmoxarife && !isComprador;

  return {
    isAdmin,
    canCreate: isAdmin || isGerente || isAlmoxarife || isComprador,
    canEdit: isAdmin || isGerente || isAlmoxarife, // apenas se Pendente
    canApprove: isAdmin || isGerente,
    canCancel: isAdmin || isGerente,
    canDelete: isAdmin,
    canExport: true,
    isFuncionario,
  };
};

const MovimentacoesPage = () => {
  const { currentUser } = useAuth();
  const companyId = currentUser?.company_id;
  const perms = usePermissions(currentUser);

  const [movimentacoes, setMovimentacoes] = useState([]);
  const [allMovimentacoes, setAllMovimentacoes] = useState([]); // para dashboard
  const [materiais, setMateriais] = useState([]);
  // Filtro por categoria (ícones) dentro do formulário de movimentação, só
  // pra encontrar o material mais rápido — não é enviado ao backend.
  const [categoriaFormFiltro, setCategoriaFormFiltro] = useState('all');
  const [obras, setObras] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMaterial, setFilterMaterial] = useState('all');
  const [filterFornecedor, setFilterFornecedor] = useState('all');
  const [filterObra, setFilterObra] = useState('all');
  const [filterResponsavel, setFilterResponsavel] = useState('all');
  const [filterFuncionario, setFilterFuncionario] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modal create/edit
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Detalhes
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState(null);

  // Cancelamento
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState('');

  const filtersRef = useRef(null);

  // ---------- Carregamento de dados auxiliares ----------
  const fetchAux = useCallback(async () => {
    if (!companyId) return;
    try {
      const [mats, obs, fors, funcs, users] = await Promise.all([
        pb.collection('materiais').getFullList({ filter: `company_id = "${companyId}"`, sort: 'name', $autoCancel: false }),
        pb.collection('obras').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
        pb.collection('fornecedores').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
        pb.collection('funcionarios').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
        pb.collection('users').getFullList({ filter: `company_id = "${companyId}"`, sort: 'name', $autoCancel: false }),
      ]);
      setMateriais(mats);
      setObras(obs);
      setFornecedores(fors);
      setFuncionarios(funcs);
      setUsuarios(users);
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  }, [companyId]);

  // ---------- Filtro para a listagem paginada ----------
  const buildFilter = useCallback(() => {
    if (!companyId) return '';
    const parts = [`company_id = "${companyId}"`];
    // Funcionário vê apenas suas próprias movimentações
    if (perms.isFuncionario) {
      parts.push(`responsavel_id = "${currentUser.id}"`);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().replace(/"/g, '\\"');
      parts.push(`(numero_movimentacao ~ "${q}" || observacoes ~ "${q}" || codigo ~ "${q}")`);
    }
    if (filterTipo !== 'all') parts.push(`tipo = "${filterTipo}"`);
    if (filterStatus !== 'all') parts.push(`status = "${filterStatus}"`);
    if (filterMaterial !== 'all') parts.push(`material_id = "${filterMaterial}"`);
    if (filterFornecedor !== 'all') parts.push(`fornecedor_id = "${filterFornecedor}"`);
    if (filterObra !== 'all') parts.push(`obra_id = "${filterObra}"`);
    if (filterResponsavel !== 'all') parts.push(`responsavel_id = "${filterResponsavel}"`);
    if (filterFuncionario !== 'all') parts.push(`funcionario_id = "${filterFuncionario}"`);
    if (filterDateFrom) parts.push(`data >= "${filterDateFrom}"`);
    if (filterDateTo) parts.push(`data <= "${filterDateTo}"`);
    return parts.join(' && ');
  }, [companyId, perms.isFuncionario, currentUser, searchQuery, filterTipo, filterStatus,
      filterMaterial, filterFornecedor, filterObra, filterResponsavel, filterFuncionario,
      filterDateFrom, filterDateTo]);

  const fetchMovimentacoes = useCallback(async (p = 1) => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const result = await pb.collection('movimentacoes').getList(p, PER_PAGE, {
        filter: buildFilter(),
        sort: '-created',
        expand: 'material_id,obra_id,fornecedor_id,solicitante_id,responsavel_id,funcionario_id,criado_por,atualizado_por',
        $autoCancel: false,
      });
      setMovimentacoes(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      setPage(p);
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
      setError(true);
      toast.error('Erro ao carregar movimentações');
    } finally {
      setLoading(false);
    }
  }, [companyId, buildFilter]);

  // ---------- Dashboard: carrega todos (até 500) para KPIs/gráficos ----------
  const fetchDashboardData = useCallback(async () => {
    if (!companyId) return;
    try {
      let filter = `company_id = "${companyId}"`;
      if (perms.isFuncionario) filter += ` && responsavel_id = "${currentUser.id}"`;
      const data = await pb.collection('movimentacoes').getFullList({
        filter,
        sort: '-created',
        perPage: 500,
        $autoCancel: false,
      });
      setAllMovimentacoes(data);
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
    }
  }, [companyId, perms.isFuncionario, currentUser]);

  useEffect(() => {
    if (companyId) {
      fetchAux();
      const t = setTimeout(() => fetchMovimentacoes(1), 300);
      return () => clearTimeout(t);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, searchQuery, filterTipo, filterStatus, filterMaterial,
      filterFornecedor, filterObra, filterResponsavel, filterFuncionario,
      filterDateFrom, filterDateTo]);

  useEffect(() => {
    if (companyId) fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // ---------- Realtime ----------
  useEffect(() => {
    if (!companyId) return;
    let unsubbed = false;
    const subscribe = async () => {
      try {
        await pb.collection('movimentacoes').subscribe('*', (e) => {
          if (unsubbed) return;
          // Atualiza dashboard
          setAllMovimentacoes((prev) => {
            if (e.action === 'delete') return prev.filter((m) => m.id !== e.record.id);
            if (e.action === 'create') return [e.record, ...prev].slice(0, 500);
            if (e.action === 'update') return prev.map((m) => m.id === e.record.id ? e.record : m);
            return prev;
          });
          // Atualiza listagem paginada (apenas se o registro pertence à empresa)
          if (e.record?.company_id !== companyId) return;
          setMovimentacoes((prev) => {
            if (e.action === 'delete') return prev.filter((m) => m.id !== e.record.id);
            if (e.action === 'create') return [e.record, ...prev];
            if (e.action === 'update') return prev.map((m) => m.id === e.record.id ? e.record : m);
            return prev;
          });
        }, { $autoCancel: false });
      } catch (err) {
        console.error('Realtime subscription failed', err);
      }
    };
    subscribe();
    return () => {
      unsubbed = true;
      pb.collection('movimentacoes').unsubscribe('*').catch(() => {});
    };
  }, [companyId]);

  // ---------- Geração do número ----------
  const generateNumero = useCallback(async () => {
    if (!companyId) return `MOV-${new Date().getFullYear()}-0001`;
    try {
      const year = new Date().getFullYear();
      const result = await pb.collection('movimentacoes').getList(1, 1, {
        filter: `company_id = "${companyId}" && numero_movimentacao ~ "MOV-${year}-"`,
        sort: '-numero_movimentacao',
        $autoCancel: false,
      });
      let next = 1;
      if (result.items.length > 0) {
        const last = result.items[0].numero_movimentacao || '';
        const match = last.match(/MOV-\d{4}-(\d+)$/);
        if (match) next = parseInt(match[1], 10) + 1;
      }
      return `MOV-${year}-${String(next).padStart(4, '0')}`;
    } catch (e) {
      return `MOV-${new Date().getFullYear()}-0001`;
    }
  }, [companyId]);

  // ---------- Cálculo valor total ----------
  const valorTotalCalc = useMemo(() => {
    const q = Number(formData.quantidade || 0);
    const vu = Number(formData.valor_unitario || 0);
    return Number((q * vu).toFixed(2));
  }, [formData.quantidade, formData.valor_unitario]);

  // ---------- Seletor de categoria (ícones) no formulário ----------
  const categoriasDoFormulario = useMemo(() => {
    const vistas = new Set();
    materiais.forEach((m) => { if (m.category) vistas.add(m.category); });
    return Array.from(vistas).sort();
  }, [materiais]);

  const materiaisFiltradosPorCategoria = useMemo(() => {
    if (categoriaFormFiltro === 'all') return materiais;
    return materiais.filter((m) => m.category === categoriaFormFiltro);
  }, [materiais, categoriaFormFiltro]);

  // ---------- Seleção de material preenche campos ----------
  const onSelectMaterial = (materialId) => {
    const mat = materiais.find((m) => m.id === materialId);
    setFormData((p) => ({
      ...p,
      material_id: materialId,
      codigo: mat?.code || p.codigo,
      categoria: mat?.category || p.categoria,
      unidade: mat?.unit || p.unidade,
      valor_unitario: mat?.unit_cost != null ? String(mat.unit_cost) : p.valor_unitario,
    }));
  };

  // ---------- Validação ----------
  const validateForm = () => {
    const errs = {};
    if (!formData.data) errs.data = 'Data é obrigatória';
    if (!formData.hora) errs.hora = 'Hora é obrigatória';
    if (!formData.tipo) errs.tipo = 'Tipo é obrigatório';
    if (!formData.material_id) errs.material_id = 'Material é obrigatório';
    if (!formData.quantidade || Number(formData.quantidade) <= 0) errs.quantidade = 'Quantidade deve ser maior que zero';
    if (!formData.unidade) errs.unidade = 'Unidade é obrigatória';
    if (formData.valor_unitario === '' || Number(formData.valor_unitario) < 0) errs.valor_unitario = 'Valor unitário inválido';
    if (!formData.responsavel_id) errs.responsavel_id = 'Responsável é obrigatório';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ---------- Submit ----------
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!companyId) { toast.error('Empresa não identificada'); return; }
    if (!perms.canCreate) { toast.error('Você não tem permissão para criar movimentações'); return; }
    setSaving(true);
    try {
      if (!validateForm()) { setSaving(false); return; }

      const payload = {
        data: formData.data,
        hora: formData.hora,
        tipo: formData.tipo,
        material_id: formData.material_id,
        categoria: formData.categoria || null,
        codigo: formData.codigo || null,
        quantidade: Number(formData.quantidade),
        unidade: formData.unidade,
        valor_unitario: Number(formData.valor_unitario || 0),
        valor_total: Number(valorTotalCalc),
        obra_id: formData.obra_id || null,
        centro_custo: formData.centro_custo || null,
        origem: formData.origem || null,
        destino: formData.destino || null,
        fornecedor_id: formData.fornecedor_id || null,
        solicitante_id: formData.solicitante_id || null,
        responsavel_id: formData.responsavel_id,
        funcionario_id: formData.funcionario_id || null,
        observacoes: formData.observacoes || null,
        status: formData.status || 'Pendente',
        company_id: companyId,
        atualizado_por: currentUser.id,
      };

      if (editing) {
        if (editing.status !== 'Pendente') {
          toast.error('Apenas movimentações Pendentes podem ser editadas');
          setSaving(false);
          return;
        }
        const updated = await pb.collection('movimentacoes').update(editing.id, payload, { $autoCancel: false });
        toast.success('Movimentação atualizada com sucesso');
        await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULE, `Movimentação atualizada: ${updated.numero_movimentacao || updated.id}`);
      } else {
        const numero = await generateNumero();
        const created = await pb.collection('movimentacoes').create(
          { ...payload, numero_movimentacao: numero, criado_por: currentUser.id },
          { $autoCancel: false },
        );
        toast.success(`Movimentação ${numero} cadastrada com sucesso`);
        await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULE, `Movimentação criada: ${created.numero_movimentacao}`);
      }

      setDialogOpen(false);
      resetForm();
      fetchMovimentacoes(page);
      fetchDashboardData();
    } catch (err) {
      console.error('Erro ao salvar movimentação:', err);
      const msg = mensagemErro(err, 'Erro ao salvar movimentação');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (mov) => {
    if (mov.status !== 'Pendente') {
      toast.error('Apenas movimentações Pendentes podem ser editadas');
      return;
    }
    if (!perms.canEdit) {
      toast.error('Você não tem permissão para editar');
      return;
    }
    setEditing(mov);
    setFormData({
      data: mov.data ? String(mov.data).split('T')[0] : todayISO(),
      hora: mov.hora || nowTime(),
      tipo: mov.tipo || 'Entrada',
      material_id: mov.material_id || '',
      categoria: mov.categoria || '',
      codigo: mov.codigo || '',
      quantidade: mov.quantidade != null ? String(mov.quantidade) : '',
      unidade: mov.unidade || '',
      valor_unitario: mov.valor_unitario != null ? String(mov.valor_unitario) : '',
      valor_total: mov.valor_total || 0,
      obra_id: mov.obra_id || '',
      centro_custo: mov.centro_custo || '',
      origem: mov.origem || '',
      destino: mov.destino || '',
      fornecedor_id: mov.fornecedor_id || '',
      solicitante_id: mov.solicitante_id || '',
      responsavel_id: mov.responsavel_id || '',
      funcionario_id: mov.funcionario_id || '',
      observacoes: mov.observacoes || '',
      status: mov.status || 'Pendente',
    });
    setFormErrors({});
    const matAtual = materiais.find((m) => m.id === mov.material_id);
    setCategoriaFormFiltro(matAtual?.category || 'all');
    setDialogOpen(true);
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (!perms.canCancel) { toast.error('Sem permissão para cancelar'); return; }
    if (!cancelMotivo.trim()) { toast.error('Informe o motivo do cancelamento'); return; }
    try {
      const updated = await pb.collection('movimentacoes').update(
        cancelTarget.id,
        { status: 'Cancelado', motivo_cancelamento: cancelMotivo.trim(), atualizado_por: currentUser.id },
        { $autoCancel: false },
      );
      toast.success('Movimentação cancelada');
      await auditLog('Movimentação cancelada', AUDIT_MODULE, `Movimentação ${updated.numero_movimentacao || updated.id} cancelada: ${cancelMotivo.trim()}`);
      setCancelTarget(null);
      setCancelMotivo('');
      fetchMovimentacoes(page);
      fetchDashboardData();
    } catch (err) {
      console.error('Erro ao cancelar:', err);
      toast.error(mensagemErro(err, 'Erro ao cancelar movimentação'));
    }
  };

  const handleStatusChange = async (mov, newStatus) => {
    if (mov.status === newStatus) return;
    if (newStatus === 'Aprovado' && !perms.canApprove) { toast.error('Sem permissão para aprovar'); return; }
    if (newStatus === 'Finalizado' && !perms.canApprove) { toast.error('Sem permissão para finalizar'); return; }
    try {
      const updated = await pb.collection('movimentacoes').update(
        mov.id, { status: newStatus, atualizado_por: currentUser.id }, { $autoCancel: false },
      );
      toast.success(`Status alterado para "${newStatus}"`);
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULE, `Status da movimentação ${updated.numero_movimentacao || updated.id} alterado para ${newStatus}`);
      fetchMovimentacoes(page);
      fetchDashboardData();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error(mensagemErro(err, 'Erro ao alterar status'));
    }
  };

  const handleView = (mov) => { setViewing(mov); setViewOpen(true); };

  const resetForm = () => { setFormData(emptyForm); setEditing(null); setFormErrors({}); setCategoriaFormFiltro('all'); };

  const clearFilters = () => {
    setSearchQuery(''); setFilterTipo('all'); setFilterStatus('all');
    setFilterMaterial('all'); setFilterFornecedor('all'); setFilterObra('all');
    setFilterResponsavel('all'); setFilterFuncionario('all');
    setFilterDateFrom(''); setFilterDateTo('');
  };

  const activeFiltersCount = [
    filterTipo, filterStatus, filterMaterial, filterFornecedor, filterObra,
    filterResponsavel, filterFuncionario, filterDateFrom, filterDateTo,
  ].filter((v) => v && v !== 'all').length;

  // ---------- Helpers de nomes ----------
  const materialNome = (id) => {
    const m = materiais.find((x) => x.id === id);
    return m ? `${m.name}${m.code ? ` (${m.code})` : ''}` : '-';
  };
  const obraNome = (id) => obras.find((x) => x.id === id)?.nome || '-';
  const fornecedorNome = (id) => fornecedores.find((x) => x.id === id)?.nome || '-';
  const funcionarioNome = (id) => funcionarios.find((x) => x.id === id)?.nome || '-';
  const usuarioNome = (id) => {
    const u = usuarios.find((x) => x.id === id);
    return u?.name || u?.email || u?.username || '-';
  };
  const expandNome = (rec, field, fallback) => rec?.expand?.[field]?.name || rec?.expand?.[field]?.nome || rec?.expand?.[field]?.email || fallback;

  // ---------- Dashboard / KPIs ----------
  const dashboard = useMemo(() => {
    const validos = allMovimentacoes.filter((m) => m.status !== 'Cancelado');
    const entradas = validos.filter((m) => ENTRADA_TIPOS.includes(m.tipo));
    const saidas = validos.filter((m) => SAIDA_TIPOS.includes(m.tipo));
    const totalEntradasQtd = entradas.reduce((s, m) => s + Number(m.quantidade || 0), 0);
    const totalSaidasQtd = saidas.reduce((s, m) => s + Number(m.quantidade || 0), 0);
    const totalEntradasVal = entradas.reduce((s, m) => s + Number(m.valor_total || 0), 0);
    const totalSaidasVal = saidas.reduce((s, m) => s + Number(m.valor_total || 0), 0);
    const saldoQtd = totalEntradasQtd - totalSaidasQtd;
    const valorMovimentado = validos.reduce((s, m) => s + Number(m.valor_total || 0), 0);
    const pendentes = allMovimentacoes.filter((m) => m.status === 'Pendente').length;
    const hoje = todayISO();
    const doDia = allMovimentacoes.filter((m) => String(m.data || '').split('T')[0] === hoje).length;

    // Top 5 materiais
    const porMaterial = {};
    validos.forEach((m) => {
      const key = m.material_id || 'unknown';
      if (!porMaterial[key]) porMaterial[key] = { id: key, qtd: 0, valor: 0 };
      porMaterial[key].qtd += Number(m.quantidade || 0);
      porMaterial[key].valor += Number(m.valor_total || 0);
    });
    const topMateriais = Object.values(porMaterial)
      .sort((a, b) => b.qtd - a.qtd).slice(0, 5)
      .map((x) => ({ ...x, nome: materialNome(x.id) }));

    // Por tipo (para gráficos)
    const porTipo = {};
    TIPOS.forEach((t) => { porTipo[t] = { tipo: t, quantidade: 0, valor: 0 }; });
    validos.forEach((m) => {
      if (porTipo[m.tipo]) {
        porTipo[m.tipo].quantidade += Number(m.quantidade || 0);
        porTipo[m.tipo].valor += Number(m.valor_total || 0);
      }
    });
    const chartTipoData = Object.values(porTipo).filter((x) => x.quantidade > 0 || x.valor > 0);

    // Entrada vs Saída (valor)
    const entradaSaidaData = [
      { name: 'Entradas', valor: totalEntradasVal, quantidade: totalEntradasQtd },
      { name: 'Saídas', valor: totalSaidasVal, quantidade: totalSaidasQtd },
    ];

    const ultimas = [...allMovimentacoes].sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, 10);

    return {
      totalEntradasQtd, totalSaidasQtd, saldoQtd, totalEntradasVal, totalSaidasVal,
      valorMovimentado, pendentes, doDia, topMateriais, chartTipoData, entradaSaidaData, ultimas,
      total: allMovimentacoes.length,
    };
  }, [allMovimentacoes, materiais]);

  // ---------- Exportações ----------
  const buildExportRows = (lista) => (lista || movimentacoes).map((m) => ({
    'Número': m.numero_movimentacao || '',
    'Data': formatDate(m.data),
    'Hora': m.hora || '',
    'Tipo': m.tipo || '',
    'Material': materialNome(m.material_id),
    'Categoria': m.categoria || '',
    'Código': m.codigo || '',
    'Quantidade': m.quantidade || 0,
    'Unidade': m.unidade || '',
    'Valor Unitário': m.valor_unitario || 0,
    'Valor Total': m.valor_total || 0,
    'Obra': obraNome(m.obra_id),
    'Centro de Custo': m.centro_custo || '',
    'Origem': m.origem || '',
    'Destino': m.destino || '',
    'Fornecedor': fornecedorNome(m.fornecedor_id),
    'Solicitante': usuarioNome(m.solicitante_id),
    'Responsável': usuarioNome(m.responsavel_id),
    'Funcionário': funcionarioNome(m.funcionario_id),
    'Status': m.status || '',
    'Observações': m.observacoes || '',
  }));

  const handleExportExcel = async () => {
    try {
      // Exporta todos os registros da empresa (até 500)
      let lista = allMovimentacoes;
      if (lista.length === 0) {
        toast.info('Nenhuma movimentação para exportar');
        return;
      }
      const rows = buildExportRows(lista);
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações');
      XLSX.writeFile(wb, `movimentacoes_${todayISO()}.xlsx`);
      toast.success('Excel exportado com sucesso');
      await auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULE, `Exportação Excel: ${lista.length} movimentações`);
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao exportar Excel');
    }
  };

  const handleExportPDF = async () => {
    try {
      const lista = allMovimentacoes;
      if (lista.length === 0) { toast.info('Nenhuma movimentação para exportar'); return; }
      const doc = new jsPDF({ orientation: 'landscape' });
      let y = 20;
      doc.setFontSize(16);
      doc.text('Relatório de Movimentações', 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.text(`Empresa: ${currentUser?.name || ''}  |  Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, y);
      doc.text(`Total de registros: ${lista.length}`, 14, y + 5);
      y += 14;

      const cols = ['Número', 'Data', 'Tipo', 'Material', 'Qtd', 'V.Total', 'Status'];
      const widths = [34, 22, 38, 70, 18, 28, 26];
      let x = 14;
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      cols.forEach((c, i) => { doc.text(c, x, y); x += widths[i]; });
      y += 4;
      doc.line(14, y, 280, y);
      y += 5;
      doc.setFont(undefined, 'normal');
      lista.forEach((m) => {
        if (y > 195) { doc.addPage(); y = 20; }
        x = 14;
        const cells = [
          (m.numero_movimentacao || '').substring(0, 16),
          formatDate(m.data),
          (m.tipo || '').substring(0, 18),
          materialNome(m.material_id).substring(0, 38),
          String(m.quantidade || 0),
          formatCurrency(m.valor_total),
          m.status || '',
        ];
        cells.forEach((c, i) => { doc.text(String(c), x, y); x += widths[i]; });
        y += 5;
      });
      doc.save(`movimentacoes_${todayISO()}.pdf`);
      toast.success('PDF gerado com sucesso');
      await auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULE, `Exportação PDF: ${lista.length} movimentações`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handlePrint = () => {
    window.print();
    auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULE, 'Impressão de relatório de movimentações');
  };

  // ---------- Render guards ----------
  if (loading && movimentacoes.length === 0) {
    return (
      <>
        <Helmet><title>Movimentações - DNM&LTDA</title><meta name="description" content="Gestão de movimentações de estoque" /></Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-12 w-full mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (error && movimentacoes.length === 0) {
    return (
      <>
        <Helmet><title>Movimentações - DNM&LTDA</title><meta name="description" content="Gestão de movimentações de estoque" /></Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar movimentações</h2>
          <p className="text-muted-foreground mb-6">Houve um problema ao conectar com o banco de dados.</p>
          <Button onClick={() => fetchMovimentacoes(1)}>Tentar novamente</Button>
        </div>
      </>
    );
  }

  if (!companyId) {
    return (
      <>
        <Helmet><title>Movimentações - DNM&LTDA</title><meta name="description" content="Gestão de movimentações de estoque" /></Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Empresa não identificada</h2>
          <p className="text-muted-foreground mb-6">Seu usuário não possui empresa vinculada.</p>
        </div>
      </>
    );
  }

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

  return (
    <>
      <Helmet>
        <title>Movimentações - DNM&LTDA</title>
        <meta name="description" content="Gestão de movimentações de estoque, equipamentos, compras e solicitações do sistema integrado de gestão para construção civil" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Movimentações</h1>
            <p className="text-muted-foreground">Histórico e consulta de movimentações. Novas movimentações são registradas via Estoque ou Saldo por Funcionário.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePrint} title="Imprimir"><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
            <Button variant="outline" onClick={handleExportExcel} title="Exportar Excel"><FileSpreadsheet className="w-4 h-4 mr-2" />Excel</Button>
            <Button variant="outline" onClick={handleExportPDF} title="Exportar PDF"><Download className="w-4 h-4 mr-2" />PDF</Button>
          </div>
        </div>

        {/* Dashboard KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={ArrowDownCircle} label="Total de Entradas" value={formatNumber(dashboard.totalEntradasQtd)} sub={formatCurrency(dashboard.totalEntradasVal)} color="text-green-600" />
          <KpiCard icon={ArrowUpCircle} label="Total de Saídas" value={formatNumber(dashboard.totalSaidasQtd)} sub={formatCurrency(dashboard.totalSaidasVal)} color="text-red-600" />
          <KpiCard icon={Wallet} label="Saldo Movimentado" value={formatNumber(dashboard.saldoQtd)} sub="quantidade líquida" color="text-blue-600" />
          <KpiCard icon={Package} label="Valor Movimentado" value={formatCurrency(dashboard.valorMovimentado)} sub={`${dashboard.total} registro(s)`} color="text-amber-600" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Clock} label="Pendentes" value={dashboard.pendentes} color="text-amber-600" />
          <KpiCard icon={History} label="Movimentações do Dia" value={dashboard.doDia} color="text-primary" />
          <KpiCard icon={ArrowDownCircle} label="Valor Entradas" value={formatCurrency(dashboard.totalEntradasVal)} color="text-green-600" />
          <KpiCard icon={ArrowUpCircle} label="Valor Saídas" value={formatCurrency(dashboard.totalSaidasVal)} color="text-red-600" />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Entradas vs Saídas (valor)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dashboard.entradaSaidaData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    <Cell fill="#16a34a" />
                    <Cell fill="#dc2626" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Movimentações por Tipo</h3>
              {dashboard.chartTipoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dashboard.chartTipoData} dataKey="quantidade" nameKey="tipo" cx="50%" cy="50%" outerRadius={75} label={({ tipo }) => tipo} labelLine={false}>
                      {dashboard.chartTipoData.map((entry, i) => (
                        <Cell key={i} fill={tipoColor(entry.tipo)} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sem dados para exibir</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top materiais + últimas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Materiais mais utilizados (Top 5)</h3>
              {dashboard.topMateriais.length > 0 ? (
                <div className="space-y-2">
                  {dashboard.topMateriais.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">{i + 1}. {m.nome}</span>
                      <span className="font-medium ml-2">{formatNumber(m.qtd)}</span>
                      <span className="text-muted-foreground ml-3 text-xs">{formatCurrency(m.valor)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Últimas movimentações</h3>
              {dashboard.ultimas.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {dashboard.ultimas.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm border-b pb-1">
                      <span className="truncate flex-1">
                        <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ background: tipoColor(m.tipo) }} />
                        {m.numero_movimentacao || '-'} · {materialNome(m.material_id)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">{formatDate(m.data)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Sem dados</p>}
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Buscar por número, código ou observações..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-none shadow-none focus-visible:ring-0 px-0 text-base"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    {STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => setShowFilters((s) => !s)}>
                  <Filter className="w-4 h-4 mr-1" />Filtros
                  {activeFiltersCount > 0 && <Badge className="ml-1 h-5 px-1.5">{activeFiltersCount}</Badge>}
                </Button>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4 mr-1" />Limpar</Button>
                )}
              </div>
            </div>

            {showFilters && (
              <div ref={filtersRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t">
                <div className="space-y-1">
                  <Label className="text-xs">Material</Label>
                  <Select value={filterMaterial} onValueChange={setFilterMaterial}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Material" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {materiais.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fornecedor</Label>
                  <Select value={filterFornecedor} onValueChange={setFilterFornecedor}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Obra</Label>
                  <Select value={filterObra} onValueChange={setFilterObra}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Obra" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Responsável</Label>
                  <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Funcionário</Label>
                  <Select value={filterFuncionario} onValueChange={setFilterFuncionario}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Funcionário" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Período - De</Label>
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Período - Até</Label>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-9" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="hidden lg:table-cell">Qtd</TableHead>
                  <TableHead className="hidden xl:table-cell">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      {searchQuery || activeFiltersCount > 0
                        ? 'Nenhuma movimentação encontrada com os filtros aplicados'
                        : <>Nenhuma movimentação cadastrada. Registre entradas e saídas na página <Link to="/estoque" className="text-primary font-medium underline hover:text-primary/80">Estoque</Link>.</>}
                    </TableCell>
                  </TableRow>
                ) : (
                  movimentacoes.map((m) => (
                    <TableRow key={m.id} className={m.status === 'Cancelado' ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{m.numero_movimentacao || '-'}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(m.data)}<span className="block text-xs text-muted-foreground">{m.hora}</span></TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: tipoColor(m.tipo) }} />
                          {m.tipo || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{expandNome(m, 'material_id', materialNome(m.material_id))}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatNumber(m.quantidade)} {m.unidade}</TableCell>
                      <TableCell className="hidden xl:table-cell font-semibold">{formatCurrency(m.valor_total)}</TableCell>
                      <TableCell>
                        <Select
                          value={m.status || 'Pendente'}
                          onValueChange={(v) => handleStatusChange(m, v)}
                          disabled={!perms.canApprove && m.status !== 'Pendente'}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(m.status)}`}>
                              {m.status || 'Pendente'}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" title="Visualizar" onClick={() => handleView(m)}><Eye className="w-4 h-4" /></Button>
                          {perms.canEdit && m.status === 'Pendente' && (
                            <Button size="sm" variant="ghost" title="Editar" onClick={() => handleEdit(m)}><Pencil className="w-4 h-4" /></Button>
                          )}
                          {perms.canCancel && m.status !== 'Cancelado' && m.status !== 'Finalizado' && (
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" title="Cancelar" onClick={() => { setCancelTarget(m); setCancelMotivo(''); }}>
                              <XCircle className="w-4 h-4" />
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

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages} • {totalItems} movimentação(ões)</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => fetchMovimentacoes(page - 1)}>
                <ChevronLeft className="w-4 h-4" />Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => fetchMovimentacoes(page + 1)}>
                Próxima<ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Modal Criar/Editar ---------- */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar Movimentação ${editing.numero_movimentacao || ''}` : 'Nova Movimentação'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mov_data">Data *</Label>
                <Input id="mov_data" type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} className={formErrors.data ? 'border-destructive' : ''} />
                {formErrors.data && <p className="text-xs text-destructive">{formErrors.data}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_hora">Hora *</Label>
                <Input id="mov_hora" type="time" value={formData.hora} onChange={(e) => setFormData({ ...formData, hora: e.target.value })} className={formErrors.hora ? 'border-destructive' : ''} />
                {formErrors.hora && <p className="text-xs text-destructive">{formErrors.hora}</p>}
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="mov_tipo">Tipo *</Label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger id="mov_tipo" className={formErrors.tipo ? 'border-destructive' : ''}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.tipo && <p className="text-xs text-destructive">{formErrors.tipo}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="mov_material">Material *</Label>
                {categoriasDoFormulario.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    <button
                      type="button"
                      onClick={() => setCategoriaFormFiltro('all')}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                        categoriaFormFiltro === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      Todas
                    </button>
                    {categoriasDoFormulario.map((cat) => {
                      const Icone = getCategoriaIcon(cat);
                      const ativo = categoriaFormFiltro === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoriaFormFiltro(cat)}
                          title={cat}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                            ativo ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <Icone className="w-3 h-3" /> {cat}
                        </button>
                      );
                    })}
                  </div>
                )}
                <Select value={formData.material_id || 'none'} onValueChange={(v) => onSelectMaterial(v === 'none' ? '' : v)}>
                  <SelectTrigger id="mov_material" className={formErrors.material_id ? 'border-destructive' : ''}><SelectValue placeholder="Selecione um material" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {materiaisFiltradosPorCategoria.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.marca ? ` — ${m.marca}` : ''} {m.code ? `(${m.code})` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.material_id && <p className="text-xs text-destructive">{formErrors.material_id}</p>}
                {materiaisFiltradosPorCategoria.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {categoriaFormFiltro === 'all' ? 'Nenhum material cadastrado.' : `Nenhum material cadastrado em "${categoriaFormFiltro}".`}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_categoria">Categoria</Label>
                <Input id="mov_categoria" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_codigo">Código</Label>
                <Input id="mov_codigo" value={formData.codigo} onChange={(e) => setFormData({ ...formData, codigo: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mov_qtd">{['Inventário', 'Ajuste de Estoque'].includes(formData.tipo) ? 'Quantidade contada *' : 'Quantidade *'}</Label>
                <Input id="mov_qtd" type="number" step="0.01" min="0" value={formData.quantidade} onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })} className={formErrors.quantidade ? 'border-destructive' : ''} />
                {['Inventário', 'Ajuste de Estoque'].includes(formData.tipo) && (
                  <p className="text-xs text-muted-foreground">Ao aprovar, o estoque passa a ser este número.</p>
                )}
                {formErrors.quantidade && <p className="text-xs text-destructive">{formErrors.quantidade}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_unidade">Unidade *</Label>
                <Input id="mov_unidade" value={formData.unidade} onChange={(e) => setFormData({ ...formData, unidade: e.target.value })} placeholder="un, kg, m..." className={formErrors.unidade ? 'border-destructive' : ''} />
                {formErrors.unidade && <p className="text-xs text-destructive">{formErrors.unidade}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_vu">Valor Unitário *</Label>
                <Input id="mov_vu" type="number" step="0.01" min="0" value={formData.valor_unitario} onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })} className={formErrors.valor_unitario ? 'border-destructive' : ''} />
                {formErrors.valor_unitario && <p className="text-xs text-destructive">{formErrors.valor_unitario}</p>}
              </div>
              <div className="space-y-1">
                <Label>Valor Total</Label>
                <div className="h-9 flex items-center font-semibold text-primary px-2 border rounded-md bg-muted/30">{formatCurrency(valorTotalCalc)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mov_obra">Obra</Label>
                <Select value={formData.obra_id || 'none'} onValueChange={(v) => setFormData({ ...formData, obra_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="mov_obra"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_cc">Centro de Custo</Label>
                <Input id="mov_cc" value={formData.centro_custo} onChange={(e) => setFormData({ ...formData, centro_custo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_origem">Origem</Label>
                <Input id="mov_origem" value={formData.origem} onChange={(e) => setFormData({ ...formData, origem: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_destino">Destino</Label>
                <Input id="mov_destino" value={formData.destino} onChange={(e) => setFormData({ ...formData, destino: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_forn">Fornecedor</Label>
                <Select value={formData.fornecedor_id || 'none'} onValueChange={(v) => setFormData({ ...formData, fornecedor_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="mov_forn"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_func">Funcionário</Label>
                <Select value={formData.funcionario_id || 'none'} onValueChange={(v) => setFormData({ ...formData, funcionario_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="mov_func"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_solic">Solicitante</Label>
                <Select value={formData.solicitante_id || 'none'} onValueChange={(v) => setFormData({ ...formData, solicitante_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="mov_solic"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mov_resp">Responsável *</Label>
                <Select value={formData.responsavel_id || 'none'} onValueChange={(v) => setFormData({ ...formData, responsavel_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="mov_resp" className={formErrors.responsavel_id ? 'border-destructive' : ''}><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.responsavel_id && <p className="text-xs text-destructive">{formErrors.responsavel_id}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mov_status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger id="mov_status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="mov_obs">Observações</Label>
              <Textarea id="mov_obs" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Atualizar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Detalhes + Timeline ---------- */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Movimentação {viewing?.numero_movimentacao || ''}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Tipo</p>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: tipoColor(viewing.tipo) }} />{viewing.tipo}
                  </span>
                </div>
                <div><p className="text-xs text-muted-foreground">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor(viewing.status)}`}>{viewing.status}</span>
                </div>
                <div><p className="text-xs text-muted-foreground">Data / Hora</p><p className="font-medium">{formatDate(viewing.data)} {viewing.hora}</p></div>
                <div><p className="text-xs text-muted-foreground">Material</p><p className="font-medium">{expandNome(viewing, 'material_id', materialNome(viewing.material_id))}</p></div>
                <div><p className="text-xs text-muted-foreground">Quantidade</p><p className="font-medium">{formatNumber(viewing.quantidade)} {viewing.unidade}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor Total</p><p className="font-medium">{formatCurrency(viewing.valor_total)}</p></div>
                <div><p className="text-xs text-muted-foreground">Valor Unitário</p><p className="font-medium">{formatCurrency(viewing.valor_unitario)}</p></div>
                <div><p className="text-xs text-muted-foreground">Código / Categoria</p><p className="font-medium">{viewing.codigo || '-'} / {viewing.categoria || '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Obra</p><p className="font-medium">{expandNome(viewing, 'obra_id', obraNome(viewing.obra_id))}</p></div>
                <div><p className="text-xs text-muted-foreground">Centro de Custo</p><p className="font-medium">{viewing.centro_custo || '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Origem</p><p className="font-medium">{viewing.origem || '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Destino</p><p className="font-medium">{viewing.destino || '-'}</p></div>
                <div><p className="text-xs text-muted-foreground">Fornecedor</p><p className="font-medium">{expandNome(viewing, 'fornecedor_id', fornecedorNome(viewing.fornecedor_id))}</p></div>
                <div><p className="text-xs text-muted-foreground">Funcionário</p><p className="font-medium">{expandNome(viewing, 'funcionario_id', funcionarioNome(viewing.funcionario_id))}</p></div>
                <div><p className="text-xs text-muted-foreground">Solicitante</p><p className="font-medium">{expandNome(viewing, 'solicitante_id', usuarioNome(viewing.solicitante_id))}</p></div>
                <div><p className="text-xs text-muted-foreground">Responsável</p><p className="font-medium">{expandNome(viewing, 'responsavel_id', usuarioNome(viewing.responsavel_id))}</p></div>
              </div>

              {viewing.observacoes && (
                <div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm whitespace-pre-wrap">{viewing.observacoes}</p></div>
              )}
              {viewing.motivo_cancelamento && (
                <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5">
                  <p className="text-xs text-red-700 font-medium">Motivo do cancelamento</p>
                  <p className="text-sm">{viewing.motivo_cancelamento}</p>
                </div>
              )}

              {/* Anexos */}
              {viewing.anexos && (Array.isArray(viewing.anexos) ? viewing.anexos.length > 0 : viewing.anexos) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Anexos</p>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(viewing.anexos) ? viewing.anexos : [viewing.anexos]).map((file, i) => {
                      const url = typeof file === 'string' ? pb.files.getURL(viewing, file) : pb.files.getURL(viewing, file);
                      const name = typeof file === 'string' ? file : file?.name || `anexo-${i + 1}`;
                      return (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted">
                          <Download className="w-3 h-3" />{String(name).substring(0, 30)}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="pt-2 border-t">
                <p className="text-sm font-semibold mb-3">Linha do tempo</p>
                <div className="relative pl-5 space-y-4">
                  <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                  <TimelineItem color="#16a34a" title="Criação" date={viewing.created} user={expandNome(viewing, 'criado_por', usuarioNome(viewing.criado_por))} />
                  {viewing.updated && viewing.updated !== viewing.created && (
                    <TimelineItem color="#2563eb" title="Última atualização" date={viewing.updated} user={expandNome(viewing, 'atualizado_por', usuarioNome(viewing.atualizado_por))} />
                  )}
                  {viewing.status === 'Cancelado' && (
                    <TimelineItem color="#dc2626" title="Cancelada" date={viewing.updated} desc={viewing.motivo_cancelamento} />
                  )}
                  {viewing.status === 'Aprovado' && (
                    <TimelineItem color="#0891b2" title="Aprovada" date={viewing.updated} />
                  )}
                  {viewing.status === 'Finalizado' && (
                    <TimelineItem color="#16a34a" title="Finalizada" date={viewing.updated} />
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handleExportPDF()}><Download className="w-4 h-4 mr-2" />Exportar PDF</Button>
                {perms.canEdit && viewing.status === 'Pendente' && (
                  <Button variant="outline" onClick={() => { setViewOpen(false); handleEdit(viewing); }}><Pencil className="w-4 h-4 mr-2" />Editar</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Cancelamento ---------- */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelMotivo(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Movimentação</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo do cancelamento da movimentação <strong>{cancelTarget?.numero_movimentacao}</strong>. O registro será mantido no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} placeholder="Motivo do cancelamento..." rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleCancel}>Confirmar Cancelamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const TimelineItem = ({ color, title, date, user, desc }) => (
  <div className="relative">
    <span className="absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full border-2 border-background" style={{ background: color }} />
    <p className="text-sm font-medium">{title}</p>
    {date && <p className="text-xs text-muted-foreground">{formatDateTime(date)}</p>}
    {user && <p className="text-xs text-muted-foreground">por {user}</p>}
    {desc && <p className="text-xs text-muted-foreground italic">{desc}</p>}
  </div>
);

export default MovimentacoesPage;
