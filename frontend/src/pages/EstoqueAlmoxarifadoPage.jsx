import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useNavigate } from 'react-router-dom';
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
  Search, AlertCircle, Package, Boxes, TrendingDown, Wallet,
  ArrowDownCircle, ArrowUpCircle, History, Plus, Minus,
  ChevronLeft, ChevronRight, X, ClipboardCheck, ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';
import { mensagemErro } from '@/lib/erros.js';
import { generateNumeroSolicitacao } from '@/utils/solicitacoesValidations.js';
import { ehAdmin, cargoDe, podeAutorizarAjuste } from '@/lib/permissoes.js';
import { MOTIVOS_DIVERGENCIA, TIPOS_DIVERGENCIA, QUEM_AUTORIZA } from '@/lib/divergencia.js';

const AUDIT_MODULE = 'Estoque';
const PER_PAGE = 10;

// Tipos de movimentação (mesmos valores da collection `movimentacoes`)
const TIPOS_SAIDA = ['Saída', 'Consumo de Obra', 'Perda', 'Retirada por Funcionário'];
// Tipo que dispara o fluxo de saldo por funcionário
const TIPO_RETIRADA_FUNC = 'Retirada por Funcionário';

const STATUS_ESTOQUE = {
  OK: { label: 'Em estoque', color: 'bg-green-500/10 text-green-700 border-green-500/20' },
  BAIXO: { label: 'Estoque baixo', color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  VAZIO: { label: 'Sem estoque', color: 'bg-red-500/10 text-red-700 border-red-500/20' },
  INATIVO: { label: 'Inativo', color: 'bg-gray-500/10 text-gray-700 border-gray-500/20' },
};

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

// Classifica o status de estoque de um material
const classificarEstoque = (m) => {
  if (m.status === 'inactive') return 'INATIVO';
  const qtd = Number(m.quantity_in_stock || 0);
  const min = Number(m.min_quantity || 0);
  if (qtd <= 0) return 'VAZIO';
  if (min > 0 && qtd <= min) return 'BAIXO';
  return 'OK';
};

// ---------- Permissões por role ----------
const usePermissions = (currentUser) => {
  // Cargos oficiais (lib/permissoes.js). Antes comparava pedaços de texto
  // ("gerente") e não reconhecia "Gerência" nem "Engenheiro".
  const cargo = cargoDe(currentUser);
  const isAdmin = ehAdmin(currentUser) || cargo === 'Diretoria';
  const isGerente = ['Gerência', 'Engenheiro', 'Mestre de Obras'].includes(cargo);
  const isAlmoxarife = cargo === 'Almoxarife';
  const isComprador = cargo === 'Comprador';
  const isFuncionario = !isAdmin && !isGerente && !isAlmoxarife && !isComprador;

  return {
    isAdmin,
    canMove: isAdmin || isGerente || isAlmoxarife || isComprador,
    canExport: true,
    isFuncionario,
  };
};

const emptyEntradaForm = {
  material_id: '',
  quantidade: '',
  valor_unitario: '',
  fornecedor_id: '',
  observacoes: '',
};

const emptySaidaForm = {
  material_id: '',
  quantidade: '',
  tipo: 'Saída',
  obra_id: '',
  funcionario_id: '',
  motivo_divergencia: '',
  observacoes: '',
};

const EstoqueAlmoxarifadoPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const companyId = currentUser?.company_id;
  const perms = usePermissions(currentUser);

  const [materiais, setMateriais] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [obras, setObras] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filtros estoque
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategoria, setFilterCategoria] = useState('all');

  // Paginação estoque
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filtros histórico
  const [histSearch, setHistSearch] = useState('');
  const [histTipo, setHistTipo] = useState('all');
  const [histMaterial, setHistMaterial] = useState('all');
  const [histDateFrom, setHistDateFrom] = useState('');
  const [histDateTo, setHistDateTo] = useState('');
  const [histPage, setHistPage] = useState(1);
  const [histTotalPages, setHistTotalPages] = useState(1);
  const [histTotalItems, setHistTotalItems] = useState(0);

  // Modais
  const [entradaOpen, setEntradaOpen] = useState(false);
  const [saidaOpen, setSaidaOpen] = useState(false);
  const [entradaForm, setEntradaForm] = useState(emptyEntradaForm);
  const [saidaForm, setSaidaForm] = useState(emptySaidaForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Conferir estoque (contagem) e diferenças aguardando autorização
  const [conferir, setConferir] = useState(null);
  const [contagem, setContagem] = useState({ quantidade: '', motivo_divergencia: '', observacoes: '' });
  const [pendentes, setPendentes] = useState([]);
  const [pedidosCompra, setPedidosCompra] = useState([]); // solicitações de compra em aberto
  const autorizador = podeAutorizarAjuste(currentUser);

  // Histórico por material
  const [histModalOpen, setHistModalOpen] = useState(false);
  const [histModalMaterial, setHistModalMaterial] = useState(null);
  const [histModalList, setHistModalList] = useState([]);
  const [histModalLoading, setHistModalLoading] = useState(false);

  const categorias = useMemo(
    () => [...new Set(materiais.map((m) => m.category).filter(Boolean))].sort(),
    [materiais],
  );

  // ---------- Carregar materiais ----------
  const fetchMateriais = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const data = await pb.collection('materiais').getFullList({
        filter: `company_id = "${companyId}"`,
        sort: 'name',
        expand: 'supplier_id',
        $autoCancel: false,
      });
      setMateriais(data);
    } catch (err) {
      console.error('Erro ao carregar materiais:', err);
      setError(true);
      toast.error('Erro ao carregar materiais');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // ---------- Carregar auxiliares ----------
  const fetchAux = useCallback(async () => {
    if (!companyId) return;
    try {
      const [fors, obs, funcs] = await Promise.all([
        pb.collection('fornecedores').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
        pb.collection('obras').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
        pb.collection('funcionarios').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
      ]);
      setFornecedores(fors);
      setObras(obs);
      setFuncionarios(funcs);
    } catch (err) {
      console.error('Erro ao carregar auxiliares:', err);
    }
  }, [companyId]);

  // ---------- Carregar movimentações (histórico paginado) ----------
  const buildHistFilter = useCallback(() => {
    if (!companyId) return '';
    const parts = [`company_id = "${companyId}"`];
    if (histTipo !== 'all') parts.push(`tipo = "${histTipo}"`);
    if (histMaterial !== 'all') parts.push(`material_id = "${histMaterial}"`);
    if (histDateFrom) parts.push(`data >= "${histDateFrom}"`);
    if (histDateTo) parts.push(`data <= "${histDateTo}"`);
    if (histSearch.trim()) {
      const q = histSearch.trim().replace(/"/g, '\\"');
      parts.push(`(numero_movimentacao ~ "${q}" || observacoes ~ "${q}" || codigo ~ "${q}")`);
    }
    return parts.join(' && ');
  }, [companyId, histTipo, histMaterial, histDateFrom, histDateTo, histSearch]);

  const fetchMovimentacoes = useCallback(async (p = 1) => {
    if (!companyId) return;
    try {
      const result = await pb.collection('movimentacoes').getList(p, PER_PAGE, {
        filter: buildHistFilter(),
        sort: '-created',
        expand: 'material_id,fornecedor_id,obra_id',
        $autoCancel: false,
      });
      setMovimentacoes(result.items);
      setHistTotalItems(result.totalItems);
      setHistTotalPages(result.totalPages);
      setHistPage(p);
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
      setMovimentacoes([]);
    }
  }, [companyId, buildHistFilter]);

  const fetchPendentes = useCallback(async () => {
    if (!companyId) return;
    try {
      const tipos = TIPOS_DIVERGENCIA.map((t) => `tipo = "${t}"`).join(' || ');
      setPendentes(await pb.collection('movimentacoes').getFullList({
        filter: `company_id = "${companyId}" && status = "Pendente" && (${tipos})`,
        sort: 'created', expand: 'material_id,criado_por', $autoCancel: false,
      }));
    } catch {
      setPendentes([]);
    }
  }, [companyId]);

  const fetchPedidosCompra = useCallback(async () => {
    if (!companyId) return;
    try {
      setPedidosCompra(await pb.collection('solicitacoes').getFullList({
        filter: `company_id = "${companyId}" && tipo = "Compra" && status != "Concluída" && status != "Cancelada" && status != "Rejeitada"`,
        fields: 'id,descricao', $autoCancel: false,
      }));
    } catch {
      setPedidosCompra([]);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchMateriais();
      fetchAux();
      fetchPendentes();
      fetchPedidosCompra();
      fetchMovimentacoes(1);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // ---------- Realtime materiais ----------
  useEffect(() => {
    if (!companyId) return;
    let unsubbed = false;
    const subscribe = async () => {
      try {
        await pb.collection('movimentacoes').subscribe('*', (e) => {
          if (unsubbed) return;
          if (e.record?.company_id !== companyId) return;
          // Atualiza histórico
          fetchMovimentacoes(histPage);
          fetchPendentes();
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
  }, [companyId, histPage, fetchMovimentacoes]);

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

  // ---------- Helpers ----------
  const materialNome = (id) => {
    const m = materiais.find((x) => x.id === id);
    return m ? `${m.name}${m.code ? ` (${m.code})` : ''}` : '-';
  };
  const fornecedorNome = (id) => fornecedores.find((x) => x.id === id)?.nome || '-';
  const obraNome = (id) => obras.find((x) => x.id === id)?.nome || '-';
  const expandNome = (rec, field, fallback) =>
    rec?.expand?.[field]?.name || rec?.expand?.[field]?.nome || fallback;

  // ---------- Dashboard ----------
  const dashboard = useMemo(() => {
    const ativos = materiais.filter((m) => m.status === 'active');
    const totalItens = ativos.length;
    const emEstoque = ativos.filter((m) => Number(m.quantity_in_stock || 0) > 0).length;
    const valorTotal = ativos.reduce(
      (s, m) => s + Number(m.quantity_in_stock || 0) * Number(m.unit_cost || 0), 0,
    );
    // Alerta só vale para material com estoque mínimo cadastrado (o mesmo
    // critério do aviso do servidor, pb_hooks/estoque-minimo.pb.js).
    const comMinimo = ativos.filter((m) => Number(m.min_quantity || 0) > 0 && Number(m.quantity_in_stock || 0) <= Number(m.min_quantity || 0));
    const baixoEstoque = comMinimo.filter((m) => Number(m.quantity_in_stock || 0) > 0).length;
    const semEstoque = comMinimo.length - baixoEstoque;
    return { totalItens, emEstoque, valorTotal, baixoEstoque, semEstoque };
  }, [materiais]);

  // ---------- Filtros estoque (client-side sobre getFullList) ----------
  const filteredMateriais = useMemo(() => {
    let list = materiais;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.code || '').toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q),
      );
    }
    if (filterCategoria !== 'all') list = list.filter((m) => m.category === filterCategoria);
    if (filterStatus !== 'all') list = list.filter((m) => classificarEstoque(m) === filterStatus);
    return list;
  }, [materiais, searchQuery, filterCategoria, filterStatus]);

  // Paginação client-side
  useEffect(() => {
    const tp = Math.max(1, Math.ceil(filteredMateriais.length / PER_PAGE));
    setTotalPages(tp);
    setTotalItems(filteredMateriais.length);
    if (page > tp) setPage(1);
  }, [filteredMateriais, page]);

  const pagedMateriais = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filteredMateriais.slice(start, start + PER_PAGE);
  }, [filteredMateriais, page]);

  // ---------- Abrir modais ----------
  const openEntrada = (material = null) => {
    setEntradaForm({ ...emptyEntradaForm, material_id: material?.id || '' });
    setFormErrors({});
    setEntradaOpen(true);
  };

  const openSaida = (material = null) => {
    setSaidaForm({ ...emptySaidaForm, material_id: material?.id || '' });
    setFormErrors({});
    setSaidaOpen(true);
  };

  // ---------- Registrar Entrada ----------
  const handleEntrada = async (e) => {
    e?.preventDefault();
    if (!companyId) { toast.error('Empresa não identificada'); return; }
    if (!perms.canMove) { toast.error('Sem permissão para movimentar estoque'); return; }

    const errs = {};
    if (!entradaForm.material_id) errs.material_id = 'Selecione um material';
    const qtd = Number(entradaForm.quantidade);
    if (!entradaForm.quantidade || Number.isNaN(qtd) || qtd <= 0) errs.quantidade = 'Quantidade deve ser maior que zero';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const material = materiais.find((m) => m.id === entradaForm.material_id);
      if (!material) throw new Error('Material não encontrado');

      const numero = await generateNumero();
      const valorUnit = entradaForm.valor_unitario !== ''
        ? Number(entradaForm.valor_unitario)
        : Number(material.unit_cost || 0);
      const valorTotal = Number((qtd * valorUnit).toFixed(2));

      // 1. Criar movimentação
      await pb.collection('movimentacoes').create({
        numero_movimentacao: numero,
        data: todayISO(),
        hora: nowTime(),
        tipo: 'Entrada',
        material_id: material.id,
        categoria: material.category || '',
        codigo: material.code || '',
        quantidade: qtd,
        unidade: material.unit || '',
        valor_unitario: valorUnit,
        valor_total: valorTotal,
        origem: 'Almoxarifado',
        fornecedor_id: entradaForm.fornecedor_id || null,
        responsavel_id: currentUser.id,
        observacoes: entradaForm.observacoes || null,
        status: 'Aprovado',
        company_id: companyId,
        criado_por: currentUser.id,
      }, { $autoCancel: false });

      // 2. O servidor já somou a entrada ao saldo (estoque-servidor.pb.js).
      // Aqui só atualiza preço/fornecedor, se informados, e relê o material.
      const updateData = {};
      if (entradaForm.valor_unitario !== '') updateData.unit_cost = valorUnit;
      if (entradaForm.fornecedor_id) updateData.supplier_id = entradaForm.fornecedor_id;
      const updated = Object.keys(updateData).length
        ? await pb.collection('materiais').update(material.id, updateData, { $autoCancel: false })
        : await pb.collection('materiais').getOne(material.id, { $autoCancel: false });

      // Atualiza estado local
      setMateriais((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));

      toast.success(`Entrada registrada: ${numero} (+${formatNumber(qtd)} ${material.unit || ''})`);
      await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULE,
        `Entrada de estoque ${numero}: ${material.name} (+${formatNumber(qtd)} ${material.unit || ''})`);

      setEntradaOpen(false);
      fetchMovimentacoes(1);
    } catch (err) {
      console.error('Erro ao registrar entrada:', err);
      const msg = mensagemErro(err, 'Erro ao registrar entrada');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ---------- Registrar Saída ----------
  const handleSaida = async (e) => {
    e?.preventDefault();
    if (!companyId) { toast.error('Empresa não identificada'); return; }
    if (!perms.canMove) { toast.error('Sem permissão para movimentar estoque'); return; }

    const errs = {};
    if (!saidaForm.material_id) errs.material_id = 'Selecione um material';
    const qtd = Number(saidaForm.quantidade);
    if (!saidaForm.quantidade || Number.isNaN(qtd) || qtd <= 0) errs.quantidade = 'Quantidade deve ser maior que zero';
    if (saidaForm.tipo === TIPO_RETIRADA_FUNC && !saidaForm.funcionario_id) errs.funcionario_id = 'Selecione o funcionário';
    if (saidaForm.tipo === 'Perda' && !saidaForm.motivo_divergencia) errs.motivo_divergencia = 'Escolha o motivo da perda';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const material = materiais.find((m) => m.id === saidaForm.material_id);
      if (!material) throw new Error('Material não encontrado');

      const estoqueAtual = Number(material.quantity_in_stock || 0);
      if (qtd > estoqueAtual) {
        setFormErrors((p) => ({ ...p, quantidade: `Estoque insuficiente. Disponível: ${formatNumber(estoqueAtual)} ${material.unit || ''}` }));
        setSaving(false);
        return;
      }

      const numero = await generateNumero();
      const valorUnit = Number(material.unit_cost || 0);
      const valorTotal = Number((qtd * valorUnit).toFixed(2));

      // 1. Criar movimentação
      const movData = {
        numero_movimentacao: numero,
        data: todayISO(),
        hora: nowTime(),
        tipo: saidaForm.tipo,
        material_id: material.id,
        categoria: material.category || '',
        codigo: material.code || '',
        quantidade: qtd,
        unidade: material.unit || '',
        valor_unitario: valorUnit,
        valor_total: valorTotal,
        obra_id: saidaForm.obra_id || null,
        destino: saidaForm.tipo === 'Consumo de Obra' ? 'Obra' : (saidaForm.tipo === TIPO_RETIRADA_FUNC ? 'Funcionário' : 'Saída'),
        responsavel_id: currentUser.id,
        observacoes: saidaForm.observacoes || null,
        status: 'Aprovado',
        company_id: companyId,
        criado_por: currentUser.id,
      };
      if (saidaForm.tipo === 'Perda') movData.motivo_divergencia = saidaForm.motivo_divergencia;
      if (saidaForm.tipo === TIPO_RETIRADA_FUNC) {
        movData.funcionario_id = saidaForm.funcionario_id;
      }
      const movRec = await pb.collection('movimentacoes').create(movData, { $autoCancel: false });

      // 1a. Se for retirada por funcionário, criar registro no razão saldo_funcionario
      if (saidaForm.tipo === TIPO_RETIRADA_FUNC) {
        const func = funcionarios.find((f) => f.id === saidaForm.funcionario_id);
        await pb.collection('saldo_funcionario').create({
          company_id: companyId,
          funcionario_id: saidaForm.funcionario_id,
          material_id: material.id,
          tipo_operacao: 'Retirada',
          quantidade: qtd,
          data_operacao: todayISO(),
          hora_operacao: nowTime(),
          obra_id: saidaForm.obra_id || null,
          movimentacao_id: movRec.id,
          responsavel_id: currentUser.id,
          observacoes: saidaForm.observacoes || null,
          criado_por: currentUser.id,
        }, { $autoCancel: false, requestKey: 'create-saldo-retirada' });
        toast.success(`Retirada registrada: ${numero} (-${formatNumber(qtd)} ${material.unit || ''}) para ${func?.nome || 'funcionário'}`);
      } else if (movRec.status === 'Pendente') {
        toast.success(`${saidaForm.tipo} registrada (${numero}). O estoque só baixa depois da autorização de ${QUEM_AUTORIZA}.`, { duration: 8000 });
      } else {
        toast.success(`Saída registrada: ${numero} (-${formatNumber(qtd)} ${material.unit || ''})`);
      }
      fetchPendentes();

      // 2. O servidor já descontou a saída do saldo; relê o material.
      const updated = await pb.collection('materiais').getOne(material.id, { $autoCancel: false });

      setMateriais((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));

      const auditMsg = saidaForm.tipo === TIPO_RETIRADA_FUNC
        ? `Retirada por funcionário ${numero}: ${material.name} (-${formatNumber(qtd)} ${material.unit || ''})`
        : `Saída de estoque ${numero}: ${material.name} (-${formatNumber(qtd)} ${material.unit || ''})`;
      await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULE, auditMsg);

      setSaidaOpen(false);
      fetchMovimentacoes(1);
    } catch (err) {
      console.error('Erro ao registrar saída:', err);
      const msg = mensagemErro(err, 'Erro ao registrar saída');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ---------- Conferir estoque (contagem física) ----------
  const openConferir = (material) => {
    setConferir(material);
    setContagem({ quantidade: '', motivo_divergencia: '', observacoes: '' });
  };

  const diferencaContagem = conferir && contagem.quantidade !== ''
    ? Number(contagem.quantidade) - Number(conferir.quantity_in_stock || 0) : null;

  const handleConferir = async () => {
    const qtd = Number(contagem.quantidade);
    if (contagem.quantidade === '' || Number.isNaN(qtd) || qtd < 0) { toast.error('Digite quanto você contou'); return; }
    if (diferencaContagem !== 0 && !contagem.motivo_divergencia) { toast.error('Escolha o motivo da diferença'); return; }
    setSaving(true);
    try {
      const numero = await generateNumero();
      const rec = await pb.collection('movimentacoes').create({
        numero_movimentacao: numero, data: todayISO(), hora: nowTime(), tipo: 'Inventário',
        material_id: conferir.id, categoria: conferir.category || '', codigo: conferir.code || '',
        quantidade: qtd, unidade: conferir.unit || '', origem: 'Almoxarifado',
        motivo_divergencia: diferencaContagem !== 0 ? contagem.motivo_divergencia : '',
        observacoes: contagem.observacoes || null, responsavel_id: currentUser.id,
        status: 'Aprovado', company_id: companyId, criado_por: currentUser.id,
      }, { $autoCancel: false });
      const un = conferir.unit || '';
      if (rec.status === 'Pendente') {
        toast.success(`Contagem registrada. A diferença de ${formatNumber(rec.diferenca_contagem)} ${un} espera a autorização de ${QUEM_AUTORIZA}.`, { duration: 8000 });
      } else if (Number(rec.diferenca_contagem) === 0) {
        toast.success('Contagem confere com o sistema. Tudo certo!');
      } else {
        toast.success(`Estoque ajustado para ${formatNumber(qtd)} ${un}.`);
      }
      await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULE, `Contagem ${numero}: ${conferir.name} contado ${formatNumber(qtd)} ${un}`);
      setConferir(null);
      fetchMateriais();
      fetchPendentes();
      fetchMovimentacoes(1);
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível registrar a contagem'));
    } finally {
      setSaving(false);
    }
  };

  const decidirAjuste = async (mov, autorizar) => {
    setSaving(true);
    try {
      await pb.collection('movimentacoes').update(mov.id, autorizar
        ? { status: 'Aprovado', atualizado_por: currentUser.id }
        : { status: 'Cancelado', motivo_cancelamento: `Ajuste recusado por ${currentUser.name || currentUser.email}`, atualizado_por: currentUser.id },
      { $autoCancel: false });
      toast.success(autorizar ? 'Ajuste autorizado. O estoque foi atualizado.' : 'Ajuste recusado. O estoque não mudou.');
      fetchMateriais();
      fetchPendentes();
      fetchMovimentacoes(1);
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível salvar'));
    } finally {
      setSaving(false);
    }
  };

  // ---------- Materiais acabando (estoque mínimo) ----------
  const acabando = useMemo(() => materiais
    .filter((m) => m.status !== 'inactive' && Number(m.min_quantity || 0) > 0 && Number(m.quantity_in_stock || 0) <= Number(m.min_quantity || 0))
    .sort((a, b) => Number(a.quantity_in_stock || 0) - Number(b.quantity_in_stock || 0)), [materiais]);
  const pedidoDe = (m) => pedidosCompra.find((p) => (p.descricao || '').startsWith(`Comprar ${m.name}:`));
  const sugestao = (m) => Math.max(Number(m.min_quantity || 0) * 2 - Number(m.quantity_in_stock || 0), 1);

  const pedirCompra = async (m) => {
    setSaving(true);
    try {
      const saldo = Number(m.quantity_in_stock || 0);
      const sol = await pb.collection('solicitacoes').create({
        company_id: companyId,
        numero_solicitacao: generateNumeroSolicitacao(),
        tipo: 'Compra',
        solicitante_id: currentUser.id,
        prioridade: saldo <= 0 ? 'Urgente' : 'Alta',
        descricao: `Comprar ${m.name}: sugestão ${formatNumber(sugestao(m))} ${m.unit || ''} `
          + `(estoque ${formatNumber(saldo)}, mínimo ${formatNumber(m.min_quantity)} ${m.unit || ''})`,
        data_solicitacao: todayISO(),
        status: 'Aberta',
      }, { $autoCancel: false });
      toast.success(`Pedido de compra de ${m.name} criado.`, {
        action: { label: 'Abrir', onClick: () => navigate(`/solicitacoes/${sol.id}`) },
      });
      fetchPedidosCompra();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível criar o pedido de compra'));
    } finally {
      setSaving(false);
    }
  };

  // ---------- Histórico por material ----------
  const openHistModal = async (material) => {
    setHistModalMaterial(material);
    setHistModalOpen(true);
    setHistModalLoading(true);
    try {
      const data = await pb.collection('movimentacoes').getFullList({
        filter: `company_id = "${companyId}" && material_id = "${material.id}"`,
        sort: '-created',
        $autoCancel: false,
      });
      setHistModalList(data);
    } catch (err) {
      console.error('Erro ao carregar histórico do material:', err);
      setHistModalList([]);
    } finally {
      setHistModalLoading(false);
    }
  };

  // ---------- Limpar filtros ----------
  const clearEstoqueFilters = () => {
    setSearchQuery(''); setFilterStatus('all'); setFilterCategoria('all');
  };
  const clearHistFilters = () => {
    setHistSearch(''); setHistTipo('all'); setHistMaterial('all');
    setHistDateFrom(''); setHistDateTo('');
  };

  const activeEstoqueFilters = [filterStatus, filterCategoria].filter((v) => v && v !== 'all').length + (searchQuery ? 1 : 0);
  const activeHistFilters = [histTipo, histMaterial, histDateFrom, histDateTo].filter((v) => v && v !== 'all').length + (histSearch ? 1 : 0);

  // ---------- Render guards ----------
  if (loading && materiais.length === 0) {
    return (
      <>
        <Helmet><title>Estoque / Almoxarifado - DNM&LTDA</title><meta name="description" content="Gestão de estoque e almoxarifado" /></Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-12 w-full mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (error && materiais.length === 0) {
    return (
      <>
        <Helmet><title>Estoque / Almoxarifado - DNM&LTDA</title><meta name="description" content="Gestão de estoque e almoxarifado" /></Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar estoque</h2>
          <p className="text-muted-foreground mb-6">Houve um problema ao conectar com o banco de dados.</p>
          <Button onClick={fetchMateriais}>Tentar novamente</Button>
        </div>
      </>
    );
  }

  if (!companyId) {
    return (
      <>
        <Helmet><title>Estoque / Almoxarifado - DNM&LTDA</title><meta name="description" content="Gestão de estoque e almoxarifado" /></Helmet>
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
        <title>Estoque / Almoxarifado - DNM&LTDA</title>
        <meta name="description" content="Gestão de estoque e almoxarifado do sistema integrado de gestão para construção civil" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1">Estoque / Almoxarifado</h1>
            <p className="text-muted-foreground">
              Estoque geral: entradas, saídas e histórico. O que já foi para cada obra está em{' '}
              <button type="button" className="underline" onClick={() => navigate('/estoque-obras')}>Estoque por Obra</button>.
            </p>
          </div>
          {perms.canMove && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openEntrada()} className="bg-green-600 hover:bg-green-700">
                <ArrowDownCircle className="w-4 h-4 mr-2" />Registrar Entrada
              </Button>
              <Button onClick={() => openSaida()} variant="destructive">
                <ArrowUpCircle className="w-4 h-4 mr-2" />Registrar Saída
              </Button>
            </div>
          )}
        </div>

        {/* Dashboard KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Package} label="Total de itens" value={dashboard.totalItens} sub="materiais ativos" color="text-primary" />
          <KpiCard icon={Boxes} label="Em estoque" value={dashboard.emEstoque} sub="com quantidade > 0" color="text-green-600" />
          <KpiCard icon={Wallet} label="Valor em estoque" value={formatCurrency(dashboard.valorTotal)} sub="valor total" color="text-blue-600" />
          <KpiCard icon={TrendingDown} label="Alertas" value={dashboard.baixoEstoque + dashboard.semEstoque} sub={`${dashboard.baixoEstoque} baixo · ${dashboard.semEstoque} sem`} color="text-amber-600" />
        </div>

        {acabando.length > 0 && (
          <Card className="mb-6 border-red-500/40">
            <CardContent className="p-4 space-y-2">
              <p className="font-semibold">Materiais acabando ({acabando.length})</p>
              {acabando.map((m) => {
                const saldo = Number(m.quantity_in_stock || 0);
                const pedido = pedidoDe(m);
                return (
                  <div key={m.id} data-testid="material-acabando" className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-2 text-sm">
                    <div>
                      <strong>{m.name}</strong>
                      <span className={saldo <= 0 ? 'text-red-600 font-semibold' : 'text-amber-700 font-semibold'}>
                        {saldo <= 0 ? ' · acabou' : ` · restam ${formatNumber(saldo)} ${m.unit || ''}`}
                      </span>
                      <span className="text-muted-foreground"> · mínimo {formatNumber(m.min_quantity)} {m.unit || ''} · sugestão: comprar {formatNumber(sugestao(m))} {m.unit || ''}</span>
                    </div>
                    {pedido ? (
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/solicitacoes/${pedido.id}`)}>Pedido de compra já feito</Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={saving} onClick={() => pedirCompra(m)}>
                        <ShoppingCart className="w-4 h-4 mr-1" />Pedir compra
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {pendentes.length > 0 && (
          <Card className="mb-6 border-amber-500/40">
            <CardContent className="p-4 space-y-2">
              <p className="font-semibold">Diferenças de estoque aguardando autorização ({pendentes.length})</p>
              {!autorizador && <p className="text-xs text-muted-foreground">Quem autoriza: {QUEM_AUTORIZA}.</p>}
              {pendentes.map((p) => {
                const un = p.unidade || p.expand?.material_id?.unit || '';
                const dif = Number(p.diferenca_contagem || 0);
                return (
                  <div key={p.id} data-testid="ajuste-pendente" className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-2 text-sm">
                    <div>
                      <strong>{p.expand?.material_id?.name || 'Material'}</strong>
                      {p.tipo === 'Perda'
                        ? <> · perda de {formatNumber(p.quantidade)} {un}</>
                        : <> · sistema {formatNumber(p.saldo_sistema)} {un}, contado {formatNumber(p.quantidade)} {un}</>}
                      <span className={dif < 0 ? 'text-red-600 font-semibold' : 'text-green-700 font-semibold'}> ({dif > 0 ? '+' : ''}{formatNumber(dif)} {un})</span>
                      <span className="text-muted-foreground"> · {p.motivo_divergencia || 'sem motivo'}{p.observacoes ? ` — ${p.observacoes}` : ''}</span>
                      <span className="text-muted-foreground"> · por {p.expand?.criado_por?.name || '-'}</span>
                    </div>
                    {autorizador && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={saving} onClick={() => decidirAjuste(p, false)}>Recusar</Button>
                        <Button size="sm" disabled={saving} onClick={() => decidirAjuste(p, true)}>Autorizar</Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="estoque" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="estoque">Estoque</TabsTrigger>
            <TabsTrigger value="historico">Histórico de Movimentações</TabsTrigger>
          </TabsList>

          {/* ---------- TAB ESTOQUE ---------- */}
          <TabsContent value="estoque">
            {/* Filtros */}
            <Card className="mb-6">
              <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Buscar por nome, código ou categoria..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    className="border-none shadow-none focus-visible:ring-0 px-0 text-base"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={filterCategoria} onValueChange={(v) => { setFilterCategoria(v); setPage(1); }}>
                    <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
                    <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      {Object.entries(STATUS_ESTOQUE).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {activeEstoqueFilters > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearEstoqueFilters}><X className="w-4 h-4 mr-1" />Limpar</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tabela */}
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="hidden md:table-cell">Categoria</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead className="hidden lg:table-cell">Mínimo</TableHead>
                      <TableHead>Preço Unit.</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedMateriais.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          {searchQuery || activeEstoqueFilters > 0
                            ? 'Nenhum material encontrado com os filtros aplicados'
                            : 'Nenhum material cadastrado. Cadastre materiais na página Materiais.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedMateriais.map((m) => {
                        const status = classificarEstoque(m);
                        const stCfg = STATUS_ESTOQUE[status];
                        const valorTotal = Number(m.quantity_in_stock || 0) * Number(m.unit_cost || 0);
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{m.name}</span>
                                <span className="text-xs text-muted-foreground md:hidden">{m.category || '-'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs px-2 py-1 bg-muted rounded-full">{m.category || '-'}</span>
                            </TableCell>
                            <TableCell>{m.code || '-'}</TableCell>
                            <TableCell>
                              <span className={status === 'BAIXO' || status === 'VAZIO' ? 'text-amber-600 font-semibold' : ''}>
                                {formatNumber(m.quantity_in_stock || 0)} {m.unit || ''}
                              </span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">{formatNumber(m.min_quantity || 0)} {m.unit || ''}</TableCell>
                            <TableCell>{formatCurrency(m.unit_cost)}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(valorTotal)}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${stCfg.color}`}>
                                {stCfg.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {perms.canMove && (
                                  <>
                                    <Button size="sm" variant="ghost" title="Registrar entrada" onClick={() => openEntrada(m)} className="text-green-600 hover:bg-green-500/10">
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" title="Registrar saída" onClick={() => openSaida(m)} className="text-red-600 hover:bg-red-500/10" disabled={Number(m.quantity_in_stock || 0) <= 0}>
                                      <Minus className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => openConferir(m)}>
                                      <ClipboardCheck className="w-4 h-4 mr-1" />Conferir
                                    </Button>
                                  </>
                                )}
                                <Button size="sm" variant="ghost" title="Histórico do material" onClick={() => openHistModal(m)}>
                                  <History className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">Página {page} de {totalPages} • {totalItems} material(is)</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="w-4 h-4" />Anterior
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    Próxima<ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ---------- TAB HISTÓRICO ---------- */}
          <TabsContent value="historico">
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Buscar por número, código ou observações..."
                      value={histSearch}
                      onChange={(e) => setHistSearch(e.target.value)}
                      className="border-none shadow-none focus-visible:ring-0 px-0 text-base"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={histTipo} onValueChange={setHistTipo}>
                      <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os tipos</SelectItem>
                        {['Entrada', 'Saída', 'Transferência', 'Devolução', 'Perda', 'Ajuste de Estoque', 'Inventário', 'Consumo de Obra', 'Retorno ao Almoxarifado', 'Retirada por Funcionário', 'Devolução de Funcionário'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={histMaterial} onValueChange={setHistMaterial}>
                      <SelectTrigger className="w-[180px]"><SelectValue placeholder="Material" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os materiais</SelectItem>
                        {materiais.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="date" value={histDateFrom} onChange={(e) => setHistDateFrom(e.target.value)} className="w-[150px]" />
                    <Input type="date" value={histDateTo} onChange={(e) => setHistDateTo(e.target.value)} className="w-[150px]" />
                    <Button size="sm" onClick={() => fetchMovimentacoes(1)}>Aplicar</Button>
                    {activeHistFilters > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearHistFilters}><X className="w-4 h-4 mr-1" />Limpar</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead className="hidden md:table-cell">Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead className="hidden lg:table-cell">Valor</TableHead>
                      <TableHead className="hidden xl:table-cell">Obra</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          {activeHistFilters > 0
                            ? 'Nenhuma movimentação encontrada com os filtros aplicados'
                            : 'Nenhuma movimentação registrada. Use "Registrar Entrada" ou "Registrar Saída".'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      movimentacoes.map((m) => (
                        <TableRow key={m.id} className={m.status === 'Cancelado' ? 'opacity-60' : ''}>
                          <TableCell className="font-medium">{m.numero_movimentacao || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell">{formatDate(m.data)}<span className="block text-xs text-muted-foreground">{m.hora}</span></TableCell>
                          <TableCell>{m.tipo || '-'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{expandNome(m, 'material_id', materialNome(m.material_id))}</TableCell>
                          <TableCell>{formatNumber(m.quantidade)} {m.unidade}</TableCell>
                          <TableCell className="hidden lg:table-cell font-semibold">{formatCurrency(m.valor_total)}</TableCell>
                          <TableCell className="hidden xl:table-cell">{expandNome(m, 'obra_id', obraNome(m.obra_id))}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
                              m.status === 'Aprovado' ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' :
                              m.status === 'Finalizado' ? 'bg-green-500/10 text-green-700 border-green-500/20' :
                              m.status === 'Cancelado' ? 'bg-red-500/10 text-red-700 border-red-500/20' :
                              'bg-amber-500/10 text-amber-700 border-amber-500/20'
                            }`}>{m.status || 'Pendente'}</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {histTotalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">Página {histPage} de {histTotalPages} • {histTotalItems} movimentação(ões)</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={histPage <= 1} onClick={() => fetchMovimentacoes(histPage - 1)}>
                    <ChevronLeft className="w-4 h-4" />Anterior
                  </Button>
                  <Button size="sm" variant="outline" disabled={histPage >= histTotalPages} onClick={() => fetchMovimentacoes(histPage + 1)}>
                    Próxima<ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ---------- Modal Entrada ---------- */}
      <Dialog open={entradaOpen} onOpenChange={(open) => { setEntradaOpen(open); if (!open) setFormErrors({}); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar Entrada no Estoque</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEntrada} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ent_material">Material *</Label>
              <Select value={entradaForm.material_id || 'none'} onValueChange={(v) => setEntradaForm({ ...entradaForm, material_id: v === 'none' ? '' : v })}>
                <SelectTrigger id="ent_material" className={formErrors.material_id ? 'border-destructive' : ''}><SelectValue placeholder="Selecione um material" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {materiais.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} {m.code ? `(${m.code})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
              {formErrors.material_id && <p className="text-xs text-destructive">{formErrors.material_id}</p>}
              {materiais.length === 0 && <p className="text-xs text-muted-foreground">Nenhum material cadastrado.</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ent_qtd">Quantidade *</Label>
                <Input id="ent_qtd" type="number" step="0.01" min="0" value={entradaForm.quantidade}
                  onChange={(e) => setEntradaForm({ ...entradaForm, quantidade: e.target.value })}
                  className={formErrors.quantidade ? 'border-destructive' : ''} />
                {formErrors.quantidade && <p className="text-xs text-destructive">{formErrors.quantidade}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ent_vu">Preço Unitário (R$)</Label>
                <Input id="ent_vu" type="number" step="0.01" min="0" value={entradaForm.valor_unitario}
                  onChange={(e) => setEntradaForm({ ...entradaForm, valor_unitario: e.target.value })}
                  placeholder="Atualizar preço (opcional)" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ent_forn">Fornecedor</Label>
              <Select value={entradaForm.fornecedor_id || 'none'} onValueChange={(v) => setEntradaForm({ ...entradaForm, fornecedor_id: v === 'none' ? '' : v })}>
                <SelectTrigger id="ent_forn"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome || f.razao_social || 'Fornecedor'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ent_obs">Observações</Label>
              <Textarea id="ent_obs" value={entradaForm.observacoes} rows={2}
                onChange={(e) => setEntradaForm({ ...entradaForm, observacoes: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEntradaOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? 'Salvando...' : 'Confirmar Entrada'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal Saída ---------- */}
      <Dialog open={saidaOpen} onOpenChange={(open) => { setSaidaOpen(open); if (!open) setFormErrors({}); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar Saída do Estoque</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaida} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sai_material">Material *</Label>
              <Select value={saidaForm.material_id || 'none'} onValueChange={(v) => setSaidaForm({ ...saidaForm, material_id: v === 'none' ? '' : v })}>
                <SelectTrigger id="sai_material" className={formErrors.material_id ? 'border-destructive' : ''}><SelectValue placeholder="Selecione um material" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {materiais.filter((m) => Number(m.quantity_in_stock || 0) > 0).map((m) => <SelectItem key={m.id} value={m.id}>{m.name} {m.code ? `(${m.code})` : ''} — {formatNumber(m.quantity_in_stock)} {m.unit || ''}</SelectItem>)}
                </SelectContent>
              </Select>
              {formErrors.material_id && <p className="text-xs text-destructive">{formErrors.material_id}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sai_qtd">Quantidade *</Label>
                <Input id="sai_qtd" type="number" step="0.01" min="0" value={saidaForm.quantidade}
                  onChange={(e) => setSaidaForm({ ...saidaForm, quantidade: e.target.value })}
                  className={formErrors.quantidade ? 'border-destructive' : ''} />
                {formErrors.quantidade && <p className="text-xs text-destructive">{formErrors.quantidade}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sai_tipo">Motivo / Tipo *</Label>
                <Select value={saidaForm.tipo} onValueChange={(v) => setSaidaForm({ ...saidaForm, tipo: v })}>
                  <SelectTrigger id="sai_tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_SAIDA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sai_obra">Obra (opcional)</Label>
              <Select value={saidaForm.obra_id || 'none'} onValueChange={(v) => setSaidaForm({ ...saidaForm, obra_id: v === 'none' ? '' : v })}>
                <SelectTrigger id="sai_obra"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {saidaForm.tipo === 'Perda' && (
              <div className="space-y-2">
                <Label htmlFor="sai_motivo">Motivo da perda *</Label>
                <Select value={saidaForm.motivo_divergencia || 'none'} onValueChange={(v) => setSaidaForm({ ...saidaForm, motivo_divergencia: v === 'none' ? '' : v })}>
                  <SelectTrigger id="sai_motivo" className={formErrors.motivo_divergencia ? 'border-destructive' : ''}><SelectValue placeholder="Escolha o motivo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Escolha o motivo...</SelectItem>
                    {MOTIVOS_DIVERGENCIA.filter((m) => m !== 'Contagem diferente do sistema').map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.motivo_divergencia && <p className="text-xs text-destructive">{formErrors.motivo_divergencia}</p>}
                {!autorizador && <p className="text-xs text-muted-foreground">A perda só sai do estoque depois da autorização de {QUEM_AUTORIZA}.</p>}
              </div>
            )}

            {saidaForm.tipo === TIPO_RETIRADA_FUNC && (
              <div className="space-y-2">
                <Label htmlFor="sai_func">Funcionário *</Label>
                <Select value={saidaForm.funcionario_id || 'none'} onValueChange={(v) => setSaidaForm({ ...saidaForm, funcionario_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="sai_func" className={formErrors.funcionario_id ? 'border-destructive' : ''}><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}{f.cpf ? ` — ${f.cpf}` : ''}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.funcionario_id && <p className="text-xs text-destructive">{formErrors.funcionario_id}</p>}
                {funcionarios.length === 0 && <p className="text-xs text-muted-foreground">Nenhum funcionário cadastrado para esta empresa.</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sai_obs">Observações</Label>
              <Textarea id="sai_obs" value={saidaForm.observacoes} rows={2}
                onChange={(e) => setSaidaForm({ ...saidaForm, observacoes: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSaidaOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} variant="destructive">
                {saving ? 'Salvando...' : 'Confirmar Saída'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Modal Conferir estoque ---------- */}
      <Dialog open={!!conferir} onOpenChange={(open) => { if (!open) setConferir(null); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader><DialogTitle>Conferir estoque</DialogTitle></DialogHeader>
          {conferir && (
            <div className="space-y-3">
              <p className="text-sm">
                <strong>{conferir.name}</strong><br />
                No sistema: <strong>{formatNumber(conferir.quantity_in_stock || 0)} {conferir.unit || ''}</strong>
              </p>
              <div className="space-y-1">
                <Label htmlFor="conf_qtd">Quanto você contou? *</Label>
                <Input id="conf_qtd" type="number" step="0.01" min="0" inputMode="decimal" value={contagem.quantidade}
                  onChange={(e) => setContagem({ ...contagem, quantidade: e.target.value })} />
              </div>
              {diferencaContagem !== null && (
                <p data-testid="resultado-contagem" className={`text-sm font-semibold ${diferencaContagem === 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {diferencaContagem === 0
                    ? 'Bate certinho com o sistema.'
                    : diferencaContagem < 0
                      ? `Faltam ${formatNumber(-diferencaContagem)} ${conferir.unit || ''}.`
                      : `Sobram ${formatNumber(diferencaContagem)} ${conferir.unit || ''}.`}
                </p>
              )}
              {diferencaContagem !== null && diferencaContagem !== 0 && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="conf_motivo">Por que deu diferença? *</Label>
                    <Select value={contagem.motivo_divergencia || 'none'} onValueChange={(v) => setContagem({ ...contagem, motivo_divergencia: v === 'none' ? '' : v })}>
                      <SelectTrigger id="conf_motivo"><SelectValue placeholder="Escolha o motivo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Escolha o motivo...</SelectItem>
                        {MOTIVOS_DIVERGENCIA.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="conf_obs">Observação (opcional)</Label>
                    <Textarea id="conf_obs" rows={2} value={contagem.observacoes} onChange={(e) => setContagem({ ...contagem, observacoes: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {autorizador ? 'Ao confirmar, o estoque passa a ser o que você contou.' : `O estoque só muda depois da autorização de ${QUEM_AUTORIZA}.`}
                  </p>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConferir(null)}>Cancelar</Button>
                <Button onClick={handleConferir} disabled={saving || contagem.quantidade === ''}>Registrar contagem</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Modal Histórico por Material ---------- */}
      <Dialog open={histModalOpen} onOpenChange={setHistModalOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico — {histModalMaterial?.name || ''}</DialogTitle>
          </DialogHeader>
          {histModalLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : histModalList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação registrada para este material.</p>
          ) : (
            <div className="space-y-2">
              {histModalList.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-b pb-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{m.numero_movimentacao || '-'}</span>
                    <span className="ml-2 text-muted-foreground">{m.tipo}</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(m.data)} {m.hora}</span>
                  </div>
                  <div className="text-right ml-2">
                    <span className={`font-semibold ${['Entrada', 'Retorno ao Almoxarifado', 'Devolução', 'Devolução de Funcionário'].includes(m.tipo) ? 'text-green-600' : 'text-red-600'}`}>
                      {['Entrada', 'Retorno ao Almoxarifado', 'Devolução', 'Devolução de Funcionário'].includes(m.tipo) ? '+' : '-'}{formatNumber(m.quantidade)} {m.unidade}
                    </span>
                    <span className="block text-xs text-muted-foreground">{m.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EstoqueAlmoxarifadoPage;
