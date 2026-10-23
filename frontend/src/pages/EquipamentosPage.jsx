import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Pencil, Trash2, Search, AlertCircle, Eye, Download, ChevronLeft, ChevronRight,
  Package, Wrench, QrCode, Barcode, Copy, ArrowRightLeft, Archive, FileSpreadsheet, Printer, Filter, X, Truck, CheckCircle2,
  TrendingDown, Boxes, AlertTriangle, HandHelping, Undo2, Repeat,
} from 'lucide-react';
import IconeModulo3D from '@/components/marca/IconeModulo3D.jsx';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { mensagemErro } from '@/lib/erros.js';
import { ehAdmin, cargoDe } from '@/lib/permissoes.js';
import FotoRetirada from '@/components/FotoRetirada.jsx';
import FotoProtegida from '@/components/FotoProtegida.jsx';
import { QrImagem, CodigoBarras, linkDoItem, imprimirEtiqueta } from '@/components/CodigosItem.jsx';

const AUDIT_MODULE = 'Equipamentos';
const PER_PAGE = 10;

const SITUACAO_VALUES = [
  'Disponível', 'Em Uso', 'Reservado', 'Em Manutenção', 'Em Transporte',
  'Emprestado', 'Extraviado', 'Danificado', 'Inativo', 'Baixado',
];
const ESTADO_VALUES = ['Excelente', 'Bom', 'Regular', 'Ruim', 'Crítico'];
const MANUT_TIPO_VALUES = ['Preventiva', 'Corretiva', 'Emergencial', 'Calibração', 'Inspeção', 'Troca de peças'];
const MANUT_STATUS_VALUES = ['Agendada', 'Em Execução', 'Concluída', 'Cancelada'];

const CATEGORIA_SUGESTOES = [
  'Ferramentas', 'Equipamentos Pesados', 'Equipamentos Leves', 'Medição',
  'Segurança', 'Transporte', 'Informática', 'Mobiliário', 'Outros',
];

const SITUACAO_COLORS = {
  'Disponível': '#16a34a', 'Em Uso': '#2563eb', 'Reservado': '#0891b2',
  'Em Manutenção': '#d97706', 'Em Transporte': '#7c3aed', 'Emprestado': '#db2777',
  'Extraviado': '#dc2626', 'Danificado': '#b91c1c', 'Inativo': '#6b7280', 'Baixado': '#374151',
};
const ESTADO_COLORS = {
  'Excelente': '#16a34a', 'Bom': '#2563eb', 'Regular': '#d97706',
  'Ruim': '#ea580c', 'Crítico': '#dc2626',
};
const PIE_COLORS = ['#0A1F4D', '#E5B339', '#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#6b7280'];

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
  return date.toLocaleString('pt-BR');
};
const todayISO = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().split(' ')[0].slice(0, 5);

const situacaoColor = (s) => {
  const c = SITUACAO_COLORS[s];
  return c ? { color: c } : {};
};
const situacaoBadge = (s) => {
  const c = SITUACAO_COLORS[s] || '#6b7280';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{ color: c, borderColor: `${c}40`, background: `${c}14` }}>
      {s || '-'}
    </span>
  );
};
const estadoBadge = (s) => {
  const c = ESTADO_COLORS[s] || '#6b7280';
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{ color: c, borderColor: `${c}40`, background: `${c}14` }}>
      {s || '-'}
    </span>
  );
};

const emptyForm = {
  numero_patrimonial: '',
  codigo_interno: '',
  codigo_qr: '',
  codigo_barras: '',
  nome: '',
  descricao: '',
  categoria: '',
  marca: '',
  modelo: '',
  fabricante: '',
  numero_serie: '',
  fornecedor_id: '',
  data_compra: '',
  nota_fiscal: '',
  garantia: '',
  vida_util: '',
  valor_compra: '',
  valor_atual: '',
  estado_conservacao: 'Bom',
  situacao: 'Disponível',
  local_atual: '',
  obra_atual_id: '',
  responsavel_id: '',
  funcionario_id: '',
  centro_custo: '',
  observacoes: '',
};

// Local do equipamento: lista (almoxarifado, obras cadastradas, oficina)
// em vez de texto livre — o mesmo lugar sempre com o mesmo nome.
const SeletorLocalEquip = ({ id, obras, value, onChange }) => {
  const opcoes = ['Almoxarifado', ...obras.map((o) => o.nome).filter(Boolean), 'Oficina / Manutenção', 'Outro'];
  return (
    <Select value={value || 'none'} onValueChange={(v) => onChange(v === 'none' ? '' : v)}>
      <SelectTrigger id={id}><SelectValue placeholder="Selecione" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Não informado</SelectItem>
        {value && !opcoes.includes(value) && <SelectItem value={value}>{value}</SelectItem>}
        {opcoes.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
};

const EquipamentosPage = () => {
  const { currentUser, isAdmin } = useAuth();
  const companyId = currentUser?.company_id;
  const userRole = cargoDe(currentUser);

  // Permissões por role
  const perms = useMemo(() => {
    const admin = isAdmin || ehAdmin(currentUser) || userRole === 'Diretoria';
    const gerente = admin || userRole === 'Gerência' || userRole === 'Gerente' || userRole === 'Engenheiro';
    const almoxarife = gerente || userRole === 'Almoxarife' || userRole === 'Mestre de Obras';
    const tecnico = almoxarife;
    return {
      isAdmin: admin,
      canCreate: almoxarife,
      canEdit: almoxarife,
      canDelete: admin,
      canTransfer: almoxarife,
      canManutencao: gerente || userRole === 'Engenheiro' || userRole === 'Mestre de Obras',
      canBaixa: admin,
      isFuncionario: userRole === 'Funcionário',
    };
  }, [isAdmin, userRole]);

  const [equipamentos, setEquipamentos] = useState([]);
  const [allEquipamentos, setAllEquipamentos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [obras, setObras] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [manutencoes, setManutencoes] = useState([]);
  const [historicos, setHistoricos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSituacao, setFilterSituacao] = useState('all');
  const [filterCategoria, setFilterCategoria] = useState('all');
  const [filterObra, setFilterObra] = useState('all');
  const [filterResponsavel, setFilterResponsavel] = useState('all');
  const [filterFornecedor, setFilterFornecedor] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [fileInputs, setFileInputs] = useState({ fotos: [], documentos: [], manual: null, certificados: [] });

  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [viewTab, setViewTab] = useState('detalhes');

  const [transferTarget, setTransferTarget] = useState(null);
  const [transferData, setTransferData] = useState({ local_atual: '', responsavel_id: '', obra_atual_id: '', observacoes: '' });

  const [obraTarget, setObraTarget] = useState(null);
  const [obraData, setObraData] = useState({ obra_atual_id: '', local_atual: '', observacoes: '' });

  const [manutTarget, setManutTarget] = useState(null);
  const [manutDialogOpen, setManutDialogOpen] = useState(false);
  const [manutForm, setManutForm] = useState({
    tipo: 'Preventiva', custos: '', fornecedor_id: '', data_prevista: '',
    data_realizada: '', proxima_manutencao: '', descricao: '', responsavel_id: '',
    status: 'Agendada', observacoes: '',
  });

  // Empréstimo (Etapa 4.2): o servidor muda a situação do equipamento.
  const [emprestimos, setEmprestimos] = useState([]);
  const [empTarget, setEmpTarget] = useState(null);
  const [empData, setEmpData] = useState({ funcionario_id: '', obra_id: '', expected_return_date: '', notes: '' });
  const [devTarget, setDevTarget] = useState(null);
  // Passar para outra pessoa na obra: quem está com o equipamento (ou a
  // gestão) diz para quem, onde estão e tira a foto da troca.
  const [repTarget, setRepTarget] = useState(null);
  const [repData, setRepData] = useState({ funcionario_id: '', local: '', foto: null });
  const [devData, setDevData] = useState({ estado_devolucao: '', observacao_devolucao: '' });
  const [empSalvando, setEmpSalvando] = useState(false);

  const [baixaTarget, setBaixaTarget] = useState(null);
  const [baixaMotivo, setBaixaMotivo] = useState('');

  const [qrTarget, setQrTarget] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrPng, setQrPng] = useState('');

  const filtersRef = useRef(null);

  // ---------- Filtros ----------
  const buildFilter = useCallback(() => {
    if (!companyId) return '';
    const parts = [`company_id = "${companyId}"`];
    if (perms.isFuncionario) {
      parts.push(`(responsavel_id = "${currentUser.id}" || funcionario_id = "${currentUser.id}")`);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().replace(/"/g, '\\"');
      parts.push(`(nome ~ "${q}" || numero_patrimonial ~ "${q}" || codigo_interno ~ "${q}" || codigo_qr ~ "${q}" || codigo_barras ~ "${q}" || numero_serie ~ "${q}" || marca ~ "${q}" || modelo ~ "${q}" || categoria ~ "${q}")`);
    }
    if (filterSituacao !== 'all') parts.push(`situacao = "${filterSituacao}"`);
    if (filterCategoria !== 'all') parts.push(`categoria = "${filterCategoria}"`);
    if (filterObra !== 'all') parts.push(`obra_atual_id = "${filterObra}"`);
    if (filterResponsavel !== 'all') parts.push(`responsavel_id = "${filterResponsavel}"`);
    if (filterFornecedor !== 'all') parts.push(`fornecedor_id = "${filterFornecedor}"`);
    if (filterEstado !== 'all') parts.push(`estado_conservacao = "${filterEstado}"`);
    if (filterDateFrom) parts.push(`data_compra >= "${filterDateFrom}"`);
    if (filterDateTo) parts.push(`data_compra <= "${filterDateTo}"`);
    return parts.join(' && ');
  }, [companyId, perms.isFuncionario, currentUser, searchQuery, filterSituacao,
      filterCategoria, filterObra, filterResponsavel, filterFornecedor, filterEstado,
      filterDateFrom, filterDateTo]);

  // ---------- Fetch auxiliares ----------
  const fetchAux = useCallback(async () => {
    if (!companyId) return;
    try {
      const [forns, obr, usrs, funcs] = await Promise.all([
        pb.collection('fornecedores').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
        pb.collection('obras').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
        pb.collection('users').getFullList({ filter: `company_id = "${companyId}"`, sort: 'name', $autoCancel: false }),
        pb.collection('funcionarios').getFullList({ filter: `company_id = "${companyId}"`, sort: 'nome', $autoCancel: false }),
      ]);
      setFornecedores(forns);
      setObras(obr);
      setUsuarios(usrs);
      setFuncionarios(funcs);
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  }, [companyId]);

  const fetchEquipamentos = useCallback(async (p = 1) => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const result = await pb.collection('equipamentos').getList(p, PER_PAGE, {
        filter: buildFilter(),
        sort: '-created',
        expand: 'fornecedor_id,obra_atual_id,responsavel_id,funcionario_id,criado_por,atualizado_por',
        $autoCancel: false,
      });
      setEquipamentos(result.items);
      setTotalItems(result.totalItems);
      setTotalPages(result.totalPages);
      setPage(p);
    } catch (err) {
      console.error('Erro ao carregar equipamentos:', err);
      setError(true);
      toast.error('Erro ao carregar equipamentos');
    } finally {
      setLoading(false);
    }
  }, [companyId, buildFilter]);

  const fetchAllForDashboard = useCallback(async () => {
    if (!companyId) return;
    pb.collection('emprestimos').getFullList({
      filter: `company_id = "${companyId}" && status = "active"`, sort: 'expected_return_date',
      expand: 'equipment_id,funcionario_id,obra_id', $autoCancel: false,
    }).then(setEmprestimos).catch(() => setEmprestimos([]));
    try {
      const filter = perms.isFuncionario
        ? `company_id = "${companyId}" && (responsavel_id = "${currentUser.id}" || funcionario_id = "${currentUser.id}")`
        : `company_id = "${companyId}"`;
      const data = await pb.collection('equipamentos').getFullList({
        filter, sort: '-created', perPage: 500, $autoCancel: false,
        expand: 'obra_atual_id,responsavel_id,fornecedor_id',
      });
      setAllEquipamentos(data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    }
  }, [companyId, perms.isFuncionario, currentUser]);

  const fetchManutencoes = useCallback(async (equipId) => {
    if (!companyId || !equipId) return;
    try {
      const data = await pb.collection('equipamentos_manutencao').getFullList({
        filter: `company_id = "${companyId}" && equipamento_id = "${equipId}"`,
        sort: '-created', $autoCancel: false,
        expand: 'fornecedor_id,responsavel_id,criado_por',
      });
      setManutencoes(data);
    } catch (err) {
      console.error('Erro ao carregar manutenções:', err);
      setManutencoes([]);
    }
  }, [companyId]);

  const fetchHistoricos = useCallback(async (equipId) => {
    if (!companyId || !equipId) return;
    try {
      const data = await pb.collection('equipamentos_historico').getFullList({
        filter: `company_id = "${companyId}" && equipamento_id = "${equipId}"`,
        sort: '-data_criacao', $autoCancel: false,
        expand: 'usuario_id,criado_por,responsavel_anterior_id,novo_responsavel_id,obra_anterior_id,nova_obra_id',
      });
      setHistoricos(data);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setHistoricos([]);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchAux();
      fetchAllForDashboard();
      const t = setTimeout(() => fetchEquipamentos(1), 300);
      return () => clearTimeout(t);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, searchQuery, filterSituacao, filterCategoria, filterObra,
      filterResponsavel, filterFornecedor, filterEstado, filterDateFrom, filterDateTo]);

  // ---------- Realtime ----------
  useEffect(() => {
    if (!companyId) return;
    let unsubbed = false;
    const subscribe = async () => {
      try {
        await pb.collection('equipamentos').subscribe('*', (e) => {
          if (unsubbed) return;
          setAllEquipamentos((prev) => {
            if (e.action === 'delete') return prev.filter((m) => m.id !== e.record.id);
            if (e.action === 'create') return [e.record, ...prev].slice(0, 500);
            if (e.action === 'update') return prev.map((m) => m.id === e.record.id ? e.record : m);
            return prev;
          });
          if (e.record?.company_id !== companyId) return;
          setEquipamentos((prev) => {
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
      pb.collection('equipamentos').unsubscribe('*').catch(() => {});
    };
  }, [companyId]);

  // ---------- Helpers de nomes ----------
  const fornecedorNome = (id) => {
    const f = fornecedores.find((x) => x.id === id);
    return f?.nome || f?.razao_social || '-';
  };
  const obraNome = (id) => obras.find((x) => x.id === id)?.nome || '-';
  const funcionarioNome = (id) => funcionarios.find((x) => x.id === id)?.nome || '-';
  const usuarioNome = (id) => {
    const u = usuarios.find((x) => x.id === id);
    return u?.name || u?.email || u?.username || '-';
  };
  const expandNome = (rec, field, fallback) =>
    rec?.expand?.[field]?.name || rec?.expand?.[field]?.nome || rec?.expand?.[field]?.email || fallback;

  // ---------- Histórico ----------
  const registrarHistorico = async (equipId, alteracao, dados = {}) => {
    if (!companyId || !equipId) return;
    try {
      await pb.collection('equipamentos_historico').create({
        company_id: companyId,
        equipamento_id: equipId,
        data: todayISO(),
        hora: nowTime(),
        usuario_id: currentUser.id,
        alteracao_realizada: alteracao,
        local_anterior: dados.local_anterior || '',
        local_atual: dados.local_atual || '',
        responsavel_anterior_id: dados.responsavel_anterior_id || '',
        novo_responsavel_id: dados.novo_responsavel_id || '',
        obra_anterior_id: dados.obra_anterior_id || '',
        nova_obra_id: dados.nova_obra_id || '',
        status_anterior: dados.status_anterior || '',
        novo_status: dados.novo_status || '',
        detalhes: dados.detalhes || '',
        criado_por: currentUser.id,
      }, { $autoCancel: false, requestKey: `hist-${equipId}-${Date.now()}` });
    } catch (err) {
      console.error('Erro ao registrar histórico:', err);
    }
  };

  // ---------- Depreciação calculada ----------
  const depreciacaoCalc = useMemo(() => {
    const vc = Number(formData.valor_compra || 0);
    const va = Number(formData.valor_atual || 0);
    const dep = vc - va;
    return dep > 0 ? Number(dep.toFixed(2)) : 0;
  }, [formData.valor_compra, formData.valor_atual]);

  // ---------- Validação ----------
  const checkDuplicate = async (field, value, excludeId = null) => {
    if (!value || !companyId) return false;
    try {
      const filter = `company_id = "${companyId}" && ${field} = "${value.replace(/"/g, '\\"')}"`;
      const res = await pb.collection('equipamentos').getList(1, 1, { filter, $autoCancel: false });
      if (res.items.length === 0) return false;
      if (excludeId && res.items[0].id === excludeId) return false;
      return true;
    } catch (e) { return false; }
  };

  const validateForm = async () => {
    const errs = {};
    if (!formData.nome.trim()) errs.nome = 'Nome é obrigatório';
    if (!formData.numero_patrimonial.trim()) errs.numero_patrimonial = 'Número patrimonial é obrigatório';
    if (!formData.categoria.trim()) errs.categoria = 'Categoria é obrigatória';
    const vc = Number(formData.valor_compra);
    if (formData.valor_compra !== '' && (Number.isNaN(vc) || vc < 0)) errs.valor_compra = 'Valor de compra inválido';
    const va = Number(formData.valor_atual);
    if (formData.valor_atual !== '' && (Number.isNaN(va) || va < 0)) errs.valor_atual = 'Valor atual inválido';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return false;

    const dupPat = await checkDuplicate('numero_patrimonial', formData.numero_patrimonial.trim(), editing?.id);
    if (dupPat) { setFormErrors((p) => ({ ...p, numero_patrimonial: 'Número patrimonial já cadastrado nesta empresa' })); return false; }
    if (formData.codigo_interno.trim()) {
      const dup = await checkDuplicate('codigo_interno', formData.codigo_interno.trim(), editing?.id);
      if (dup) { setFormErrors((p) => ({ ...p, codigo_interno: 'Código interno já cadastrado' })); return false; }
    }
    if (formData.numero_serie.trim()) {
      const dup = await checkDuplicate('numero_serie', formData.numero_serie.trim(), editing?.id);
      if (dup) { setFormErrors((p) => ({ ...p, numero_serie: 'Número de série já cadastrado' })); return false; }
    }
    return true;
  };

  // ---------- Submit (FormData p/ suportar arquivos) ----------
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!companyId) { toast.error('Empresa não identificada'); return; }
    if (!perms.canCreate) { toast.error('Sem permissão para criar equipamentos'); return; }
    setSaving(true);
    try {
      const ok = await validateForm();
      if (!ok) { setSaving(false); return; }

      const fd = new FormData();
      const setField = (key, value) => {
        if (value === null || value === undefined || value === '') fd.append(key, '');
        else fd.append(key, String(value));
      };
      setField('numero_patrimonial', formData.numero_patrimonial.trim());
      setField('codigo_interno', formData.codigo_interno.trim());
      setField('codigo_qr', formData.codigo_qr.trim());
      setField('codigo_barras', formData.codigo_barras.trim());
      setField('nome', formData.nome.trim());
      setField('descricao', formData.descricao.trim());
      setField('categoria', formData.categoria.trim());
      setField('marca', formData.marca.trim());
      setField('modelo', formData.modelo.trim());
      setField('fabricante', formData.fabricante.trim());
      setField('numero_serie', formData.numero_serie.trim());
      setField('fornecedor_id', formData.fornecedor_id);
      setField('data_compra', formData.data_compra);
      setField('nota_fiscal', formData.nota_fiscal.trim());
      setField('garantia', formData.garantia.trim());
      setField('vida_util', formData.vida_util ? Number(formData.vida_util) : '');
      setField('valor_compra', formData.valor_compra ? Number(formData.valor_compra) : '');
      setField('valor_atual', formData.valor_atual ? Number(formData.valor_atual) : '');
      setField('depreciacao', depreciacaoCalc);
      setField('estado_conservacao', formData.estado_conservacao);
      setField('situacao', formData.situacao);
      setField('local_atual', formData.local_atual.trim());
      setField('obra_atual_id', formData.obra_atual_id);
      setField('responsavel_id', formData.responsavel_id);
      setField('funcionario_id', formData.funcionario_id);
      setField('centro_custo', formData.centro_custo.trim());
      setField('observacoes', formData.observacoes.trim());
      setField('company_id', companyId);
      setField('atualizado_por', currentUser.id);

      // Arquivos
      (fileInputs.fotos || []).forEach((f) => fd.append('fotos', f));
      (fileInputs.documentos || []).forEach((f) => fd.append('documentos', f));
      if (fileInputs.manual) fd.append('manual', fileInputs.manual);
      (fileInputs.certificados || []).forEach((f) => fd.append('certificados', f));

      if (editing) {
        const updated = await pb.collection('equipamentos').update(editing.id, fd, { $autoCancel: false });
        toast.success('Equipamento atualizado com sucesso');
        await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULE, `Equipamento atualizado: ${updated.nome} (${updated.numero_patrimonial})`);
        await registrarHistorico(updated.id, 'Equipamento atualizado', { detalhes: 'Edição de dados do equipamento' });
      } else {
        const created = await pb.collection('equipamentos').create(fd, { $autoCancel: false });
        toast.success('Equipamento cadastrado com sucesso');
        await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULE, `Equipamento criado: ${created.nome} (${created.numero_patrimonial})`);
        await registrarHistorico(created.id, 'Cadastro de equipamento', { novo_status: created.situacao, local_atual: created.local_atual, novo_responsavel_id: created.responsavel_id, nova_obra_id: created.obra_atual_id, criado_por: currentUser.id });
        setField('criado_por', currentUser.id);
      }

      setDialogOpen(false);
      resetForm();
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      console.error('Erro ao salvar equipamento:', err);
      const msg = mensagemErro(err, 'Erro ao salvar equipamento');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (eq) => {
    if (!perms.canEdit) { toast.error('Sem permissão para editar'); return; }
    if (eq.situacao === 'Baixado') { toast.error('Equipamentos baixados não podem ser editados'); return; }
    setEditing(eq);
    setFormData({
      numero_patrimonial: eq.numero_patrimonial || '',
      codigo_interno: eq.codigo_interno || '',
      codigo_qr: eq.codigo_qr || '',
      codigo_barras: eq.codigo_barras || '',
      nome: eq.nome || '',
      descricao: eq.descricao || '',
      categoria: eq.categoria || '',
      marca: eq.marca || '',
      modelo: eq.modelo || '',
      fabricante: eq.fabricante || '',
      numero_serie: eq.numero_serie || '',
      fornecedor_id: eq.fornecedor_id || '',
      data_compra: eq.data_compra ? String(eq.data_compra).split('T')[0] : '',
      nota_fiscal: eq.nota_fiscal || '',
      garantia: eq.garantia || '',
      vida_util: eq.vida_util != null ? String(eq.vida_util) : '',
      valor_compra: eq.valor_compra != null ? String(eq.valor_compra) : '',
      valor_atual: eq.valor_atual != null ? String(eq.valor_atual) : '',
      estado_conservacao: eq.estado_conservacao || 'Bom',
      situacao: eq.situacao || 'Disponível',
      local_atual: eq.local_atual || '',
      obra_atual_id: eq.obra_atual_id || '',
      responsavel_id: eq.responsavel_id || '',
      funcionario_id: eq.funcionario_id || '',
      centro_custo: eq.centro_custo || '',
      observacoes: eq.observacoes || '',
    });
    setFileInputs({ fotos: [], documentos: [], manual: null, certificados: [] });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDuplicate = (eq) => {
    if (!perms.canCreate) { toast.error('Sem permissão para criar'); return; }
    setEditing(null);
    setFormData({
      ...emptyForm,
      categoria: eq.categoria || '',
      marca: eq.marca || '',
      modelo: eq.modelo || '',
      fabricante: eq.fabricante || '',
      descricao: eq.descricao || '',
      estado_conservacao: eq.estado_conservacao || 'Bom',
      situacao: 'Disponível',
    });
    setFileInputs({ fotos: [], documentos: [], manual: null, certificados: [] });
    setFormErrors({});
    setDialogOpen(true);
    toast.info('Equipamento duplicado — ajuste os dados e salve');
  };

  const handleDelete = async (eq) => {
    if (!perms.canDelete) { toast.error('Apenas administradores podem excluir'); return; }
    try {
      await pb.collection('equipamentos').delete(eq.id, { $autoCancel: false });
      toast.success('Equipamento excluído com sucesso');
      await auditLog(AUDIT_ACTIONS.RECORD_DELETED, AUDIT_MODULE, `Equipamento excluído: ${eq.nome} (${eq.numero_patrimonial})`);
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      console.error('Erro ao excluir:', err);
      toast.error('Erro ao excluir equipamento');
    }
  };

  const handleView = (eq) => {
    setViewing(eq);
    setViewTab('detalhes');
    setViewOpen(true);
    fetchManutencoes(eq.id);
    fetchHistoricos(eq.id);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditing(null);
    setFormErrors({});
    setFileInputs({ fotos: [], documentos: [], manual: null, certificados: [] });
  };

  const clearFilters = () => {
    setSearchQuery(''); setFilterSituacao('all'); setFilterCategoria('all');
    setFilterObra('all'); setFilterResponsavel('all'); setFilterFornecedor('all');
    setFilterEstado('all'); setFilterDateFrom(''); setFilterDateTo('');
  };

  const activeFiltersCount = [
    filterSituacao, filterCategoria, filterObra, filterResponsavel, filterFornecedor,
    filterEstado, filterDateFrom, filterDateTo,
  ].filter((v) => v && v !== 'all').length;

  // ---------- Ações: Transferir ----------
  const openTransfer = (eq) => {
    if (!perms.canTransfer) { toast.error('Sem permissão para transferir'); return; }
    setTransferTarget(eq);
    setTransferData({
      local_atual: eq.local_atual || '',
      responsavel_id: eq.responsavel_id || '',
      obra_atual_id: eq.obra_atual_id || '',
      observacoes: '',
    });
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    try {
      const prev = transferTarget;
      const payload = {
        local_atual: transferData.local_atual.trim() || null,
        responsavel_id: transferData.responsavel_id || null,
        obra_atual_id: transferData.obra_atual_id || null,
        atualizado_por: currentUser.id,
      };
      const updated = await pb.collection('equipamentos').update(transferTarget.id, payload, { $autoCancel: false });
      toast.success('Equipamento transferido com sucesso');
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULE, `Transferência: ${updated.nome}`);
      await registrarHistorico(updated.id, 'Transferência de equipamento', {
        local_anterior: prev.local_atual, local_atual: updated.local_atual,
        responsavel_anterior_id: prev.responsavel_id, novo_responsavel_id: updated.responsavel_id,
        obra_anterior_id: prev.obra_atual_id, nova_obra_id: updated.obra_atual_id,
        detalhes: transferData.observacoes,
      });
      setTransferTarget(null);
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      console.error('Erro ao transferir:', err);
      toast.error('Erro ao transferir equipamento');
    }
  };

  // ---------- Enviar para obra ----------
  const openSendObra = (eq) => {
    if (!perms.canTransfer) { toast.error('Sem permissão'); return; }
    setObraTarget(eq);
    setObraData({ obra_atual_id: eq.obra_atual_id || '', local_atual: eq.local_atual || '', observacoes: '' });
  };

  const handleSendObra = async () => {
    if (!obraTarget || !obraData.obra_atual_id) { toast.error('Selecione a obra de destino'); return; }
    try {
      const prev = obraTarget;
      const payload = {
        obra_atual_id: obraData.obra_atual_id,
        local_atual: obraData.local_atual.trim() || null,
        situacao: 'Em Uso',
        atualizado_por: currentUser.id,
      };
      const updated = await pb.collection('equipamentos').update(obraTarget.id, payload, { $autoCancel: false });
      toast.success('Equipamento enviado para obra');
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULE, `Enviado para obra: ${updated.nome} → ${obraNome(obraData.obra_atual_id)}`);
      await registrarHistorico(updated.id, 'Envio para obra', {
        obra_anterior_id: prev.obra_atual_id, nova_obra_id: updated.obra_atual_id,
        local_anterior: prev.local_atual, local_atual: updated.local_atual,
        status_anterior: prev.situacao, novo_status: 'Em Uso',
        detalhes: obraData.observacoes,
      });
      setObraTarget(null);
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      console.error('Erro ao enviar para obra:', err);
      toast.error('Erro ao enviar para obra');
    }
  };

  const handleReceiveFromObra = async (eq) => {
    if (!perms.canTransfer) { toast.error('Sem permissão'); return; }
    try {
      const prev = eq;
      const updated = await pb.collection('equipamentos').update(eq.id, {
        obra_atual_id: null, situacao: 'Disponível', atualizado_por: currentUser.id,
      }, { $autoCancel: false });
      toast.success('Equipamento recebido da obra');
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULE, `Recebido da obra: ${updated.nome}`);
      await registrarHistorico(updated.id, 'Recebimento de obra', {
        obra_anterior_id: prev.obra_atual_id, nova_obra_id: '',
        status_anterior: prev.situacao, novo_status: 'Disponível',
        detalhes: 'Equipamento retornou ao estoque',
      });
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      console.error('Erro ao receber da obra:', err);
      toast.error('Erro ao receber da obra');
    }
  };

  // ---------- Empréstimo e devolução ----------
  const disponivel = (eq) => !eq.situacao || eq.situacao === 'Disponível';
  const emprestimoDe = (eq) => emprestimos.find((l) => l.equipment_id === eq.id);
  const atrasado = (l) => l.expected_return_date && new Date(l.expected_return_date) < new Date(new Date().toDateString());
  const dataBR = (d) => (d ? new Date(d.replace(' ', 'T')).toLocaleDateString('pt-BR') : '');

  const openEmprestar = (eq) => {
    setEmpTarget(eq);
    setEmpData({ funcionario_id: '', obra_id: eq.obra_atual_id || '', expected_return_date: '', notes: '', foto: null });
  };

  const handleEmprestar = async () => {
    if (!empData.funcionario_id) { toast.error('Escolha quem vai levar o equipamento'); return; }
    if (!empData.foto) { toast.error('Tire a foto de quem está levando o equipamento'); return; }
    setEmpSalvando(true);
    try {
      await pb.collection('emprestimos').create({
        equipment_id: empTarget.id, company_id: companyId, funcionario_id: empData.funcionario_id,
        obra_id: empData.obra_id || '', notes: empData.notes, foto_retirada: empData.foto,
        expected_return_date: empData.expected_return_date ? `${empData.expected_return_date} 12:00:00` : '',
      }, { $autoCancel: false });
      toast.success(`${empTarget.nome} emprestado para ${funcionarioNome(empData.funcionario_id)}`);
      setEmpTarget(null);
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível emprestar'));
    } finally {
      setEmpSalvando(false);
    }
  };

  const openDevolver = (eq) => {
    const l = emprestimoDe(eq);
    if (!l) { toast.error('Empréstimo não encontrado. Atualize a página.'); return; }
    setDevTarget({ eq, l });
    setDevData({ estado_devolucao: '', observacao_devolucao: '' });
  };

  const handleDevolver = async () => {
    if (!devData.estado_devolucao) { toast.error('Diga em que estado o equipamento voltou'); return; }
    setEmpSalvando(true);
    try {
      await pb.collection('emprestimos').update(devTarget.l.id, {
        status: 'returned', estado_devolucao: devData.estado_devolucao, observacao_devolucao: devData.observacao_devolucao,
      }, { $autoCancel: false });
      const msg = {
        'Bom': 'voltou para o almoxarifado',
        'Precisa de manutenção': 'foi para manutenção',
        'Danificado': 'ficou marcado como danificado',
        'Perdido': 'ficou marcado como extraviado',
      }[devData.estado_devolucao];
      toast.success(`Devolução registrada: ${devTarget.eq.nome} ${msg}`);
      setDevTarget(null);
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível registrar a devolução'));
    } finally {
      setEmpSalvando(false);
    }
  };

  const podePassar = (l) => perms.canTransfer || (!!currentUser?.funcionario_id && currentUser.funcionario_id === l.funcionario_id);
  const openRepasse = (l) => { setRepTarget(l); setRepData({ funcionario_id: '', local: '', foto: null }); };
  const handleRepasse = async () => {
    if (!repData.funcionario_id) { toast.error('Escolha para quem vai passar'); return; }
    if (!repData.local.trim()) { toast.error('Diga onde vocês estão'); return; }
    if (!repData.foto) { toast.error('Tire a foto da troca'); return; }
    setEmpSalvando(true);
    try {
      await pb.collection('emprestimos').create({
        repassado_de: repTarget.id, company_id: companyId, funcionario_id: repData.funcionario_id, local_entrega: repData.local.trim(), foto_retirada: repData.foto,
      }, { $autoCancel: false });
      toast.success(`${repTarget.expand?.equipment_id?.nome || 'Equipamento'} passado para ${funcionarioNome(repData.funcionario_id)}`);
      setRepTarget(null);
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      toast.error(mensagemErro(err, 'Não foi possível passar o equipamento'));
    } finally {
      setEmpSalvando(false);
    }
  };

  // ---------- Manutenção ----------
  const openManut = (eq) => {
    if (!perms.canManutencao) { toast.error('Sem permissão para gerenciar manutenção'); return; }
    setManutTarget(eq);
    setManutForm({
      tipo: 'Preventiva', custos: '', fornecedor_id: '', data_prevista: todayISO(),
      data_realizada: '', proxima_manutencao: '', descricao: '', responsavel_id: currentUser.id,
      status: 'Agendada', observacoes: '',
    });
    setManutDialogOpen(true);
  };

  const handleSaveManut = async () => {
    if (!manutTarget) return;
    if (!manutForm.tipo || !manutForm.data_prevista) { toast.error('Tipo e data prevista são obrigatórios'); return; }
    try {
      const payload = {
        company_id: companyId,
        equipamento_id: manutTarget.id,
        tipo: manutForm.tipo,
        custos: Number(manutForm.custos || 0),
        fornecedor_id: manutForm.fornecedor_id || null,
        data_prevista: manutForm.data_prevista,
        data_realizada: manutForm.data_realizada || null,
        proxima_manutencao: manutForm.proxima_manutencao || null,
        descricao: manutForm.descricao.trim() || null,
        responsavel_id: manutForm.responsavel_id || null,
        status: manutForm.status,
        observacoes: manutForm.observacoes.trim() || null,
        criado_por: currentUser.id,
        atualizado_por: currentUser.id,
      };
      await pb.collection('equipamentos_manutencao').create(payload, { $autoCancel: false });
      // Atualiza situação do equipamento para Em Manutenção
      const prev = manutTarget;
      const updated = await pb.collection('equipamentos').update(manutTarget.id, {
        situacao: manutForm.status === 'Concluída' ? 'Disponível' : 'Em Manutenção',
        atualizado_por: currentUser.id,
      }, { $autoCancel: false });
      toast.success('Manutenção registrada');
      await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULE, `Manutenção ${manutForm.tipo}: ${manutTarget.nome}`);
      await registrarHistorico(manutTarget.id, `Manutenção ${manutForm.tipo} (${manutForm.status})`, {
        status_anterior: prev.situacao, novo_status: updated.situacao,
        detalhes: manutForm.descricao,
      });
      setManutDialogOpen(false);
      setManutTarget(null);
      fetchManutencoes(manutTarget.id);
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      console.error('Erro ao salvar manutenção:', err);
      toast.error(err.message || 'Erro ao salvar manutenção');
    }
  };

  const handleManutStatusChange = async (m, newStatus) => {
    if (m.status === newStatus) return;
    try {
      const updated = await pb.collection('equipamentos_manutencao').update(m.id, {
        status: newStatus, atualizado_por: currentUser.id,
        data_realizada: newStatus === 'Concluída' ? todayISO() : m.data_realizada,
      }, { $autoCancel: false });
      if (newStatus === 'Concluída') {
        await pb.collection('equipamentos').update(m.equipamento_id, {
          situacao: 'Disponível', atualizado_por: currentUser.id,
        }, { $autoCancel: false });
        await registrarHistorico(m.equipamento_id, 'Retorno de manutenção', { novo_status: 'Disponível', detalhes: `Manutenção ${m.tipo} concluída` });
      }
      toast.success(`Status da manutenção: ${newStatus}`);
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULE, `Manutenção ${newStatus}: ${m.tipo}`);
      if (viewing) fetchManutencoes(viewing.id);
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      console.error('Erro ao alterar status manutenção:', err);
      toast.error('Erro ao alterar status');
    }
  };

  // ---------- Baixa ----------
  const openBaixa = (eq) => {
    if (!perms.canBaixa) { toast.error('Apenas administradores podem baixar equipamentos'); return; }
    setBaixaTarget(eq);
    setBaixaMotivo('');
  };

  const handleBaixa = async () => {
    if (!baixaTarget) return;
    if (!baixaMotivo.trim()) { toast.error('Informe o motivo da baixa'); return; }
    try {
      const prev = baixaTarget;
      const updated = await pb.collection('equipamentos').update(baixaTarget.id, {
        situacao: 'Baixado', motivo_baixa: baixaMotivo.trim(),
        obra_atual_id: null, atualizado_por: currentUser.id,
      }, { $autoCancel: false });
      toast.success('Equipamento baixado');
      await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULE, `Baixa de equipamento: ${updated.nome} - ${baixaMotivo.trim()}`);
      await registrarHistorico(updated.id, 'Baixa de equipamento', {
        status_anterior: prev.situacao, novo_status: 'Baixado', detalhes: baixaMotivo.trim(),
      });
      setBaixaTarget(null);
      setBaixaMotivo('');
      fetchEquipamentos(page);
      fetchAllForDashboard();
    } catch (err) {
      console.error('Erro ao baixar:', err);
      toast.error('Erro ao baixar equipamento');
    }
  };

  // ---------- QR / Barcode ----------
  const openQR = (eq) => {
    setQrTarget(eq);
    setQrOpen(true);
  };

  // ---------- Dashboard ----------
  const dashboard = useMemo(() => {
    const total = allEquipamentos.length;
    const emUso = allEquipamentos.filter((e) => e.situacao === 'Em Uso').length;
    const disponiveis = allEquipamentos.filter((e) => e.situacao === 'Disponível').length;
    const emManut = allEquipamentos.filter((e) => e.situacao === 'Em Manutenção').length;
    const problemas = allEquipamentos.filter((e) => e.situacao === 'Extraviado' || e.situacao === 'Danificado').length;
    const custoTotal = allEquipamentos.reduce((s, e) => s + Number(e.valor_compra || 0), 0);
    const valorDepreciado = allEquipamentos.reduce((s, e) => s + Number(e.depreciacao || 0), 0);

    const porSituacao = {};
    SITUACAO_VALUES.forEach((s) => { porSituacao[s] = 0; });
    allEquipamentos.forEach((e) => { if (porSituacao[e.situacao] != null) porSituacao[e.situacao]++; });
    const chartSituacao = Object.entries(porSituacao).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));

    const porCategoria = {};
    allEquipamentos.forEach((e) => {
      const c = e.categoria || 'Sem categoria';
      porCategoria[c] = (porCategoria[c] || 0) + 1;
    });
    const chartCategoria = Object.entries(porCategoria).map(([k, v]) => ({ name: k, value: v }));

    const porEstado = {};
    ESTADO_VALUES.forEach((s) => { porEstado[s] = 0; });
    allEquipamentos.forEach((e) => { if (porEstado[e.estado_conservacao] != null) porEstado[e.estado_conservacao]++; });
    const chartEstado = Object.entries(porEstado).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));

    const porObra = {};
    allEquipamentos.forEach((e) => {
      const key = e.obra_atual_id || 'Sem obra';
      porObra[key] = (porObra[key] || 0) + 1;
    });
    const chartObra = Object.entries(porObra).map(([k, v]) => ({ name: k === 'Sem obra' ? 'Sem obra' : obraNome(k), value: v }));

    return { total, emUso, disponiveis, emManut, problemas, custoTotal, valorDepreciado,
      chartSituacao, chartCategoria, chartEstado, chartObra };
  }, [allEquipamentos, obras]);

  // ---------- Exportações ----------
  const handleExportExcel = async () => {
    try {
      let lista = allEquipamentos;
      if (lista.length === 0) { toast.info('Nenhum equipamento para exportar'); return; }
      const rows = lista.map((e) => ({
        'Patrimônio': e.numero_patrimonial || '', 'Código Interno': e.codigo_interno || '',
        'Nome': e.nome || '', 'Categoria': e.categoria || '', 'Marca': e.marca || '',
        'Modelo': e.modelo || '', 'Nº Série': e.numero_serie || '',
        'Situação': e.situacao || '', 'Estado': e.estado_conservacao || '',
        'Local': e.local_atual || '', 'Obra': obraNome(e.obra_atual_id),
        'Responsável': usuarioNome(e.responsavel_id), 'Fornecedor': fornecedorNome(e.fornecedor_id),
        'Valor Compra': e.valor_compra || 0, 'Valor Atual': e.valor_atual || 0,
        'Depreciação': e.depreciacao || 0, 'Data Compra': formatDate(e.data_compra),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');
      XLSX.writeFile(wb, `equipamentos_${todayISO()}.xlsx`);
      toast.success('Excel exportado com sucesso');
      await auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULE, `Exportação Excel: ${lista.length} equipamentos`);
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao exportar Excel');
    }
  };

  const handleExportPDF = (eq) => {
    try {
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(18);
      doc.text('FICHA TÉCNICA DE EQUIPAMENTO', 105, y, { align: 'center' });
      y += 10;
      doc.setFontSize(13);
      doc.text(eq.nome || '-', 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.text(`Patrimônio: ${eq.numero_patrimonial || '-'}   Situação: ${eq.situacao || '-'}`, 14, y);
      y += 10;

      const sections = [
        ['Identificação', [
          ['Código Interno', eq.codigo_interno], ['Código QR', eq.codigo_qr], ['Código Barras', eq.codigo_barras],
          ['Categoria', eq.categoria], ['Marca', eq.marca], ['Modelo', eq.modelo], ['Fabricante', eq.fabricante], ['Nº Série', eq.numero_serie],
        ]],
        ['Aquisição', [
          ['Fornecedor', fornecedorNome(eq.fornecedor_id)], ['Data Compra', formatDate(eq.data_compra)],
          ['Nota Fiscal', eq.nota_fiscal], ['Garantia', eq.garantia], ['Vida Útil', eq.vida_util ? `${eq.vida_util} anos` : '-'],
          ['Valor Compra', formatCurrency(eq.valor_compra)], ['Valor Atual', formatCurrency(eq.valor_atual)], ['Depreciação', formatCurrency(eq.depreciacao)],
        ]],
        ['Estado e Localização', [
          ['Estado Conservação', eq.estado_conservacao], ['Situação', eq.situacao], ['Local Atual', eq.local_atual],
          ['Obra', obraNome(eq.obra_atual_id)], ['Responsável', usuarioNome(eq.responsavel_id)], ['Funcionário', funcionarioNome(eq.funcionario_id)],
          ['Centro de Custo', eq.centro_custo],
        ]],
      ];

      sections.forEach(([title, fields]) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(12); doc.setFont(undefined, 'bold');
        doc.text(title, 14, y); y += 6;
        doc.setFontSize(10); doc.setFont(undefined, 'normal');
        fields.forEach(([label, value]) => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(`${label}:`, 16, y);
          doc.text(String(value || '-'), 60, y);
          y += 5;
        });
        y += 4;
      });

      if (eq.observacoes) {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(12); doc.setFont(undefined, 'bold');
        doc.text('Observações', 14, y); y += 6;
        doc.setFontSize(10); doc.setFont(undefined, 'normal');
        const split = doc.splitTextToSize(eq.observacoes, 180);
        doc.text(split, 14, y); y += split.length * 5 + 4;
      }

      if (eq.motivo_baixa) {
        doc.setFontSize(10); doc.setTextColor(220, 38, 38);
        doc.text(`BAIXADO: ${eq.motivo_baixa}`, 14, y);
        doc.setTextColor(0, 0, 0);
      }

      doc.save(`ficha_equipamento_${eq.numero_patrimonial || eq.id}.pdf`);
      toast.success('PDF gerado com sucesso');
      auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULE, `Ficha PDF: ${eq.nome}`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handlePrint = () => {
    window.print();
    auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULE, 'Impressão de relatório de equipamentos');
  };

  // ---------- Render guards ----------
  if (loading && equipamentos.length === 0) {
    return (
      <>
        <Helmet><title>Equipamentos - DNM&LTDA</title><meta name="description" content="Gestão de equipamentos" /></Helmet>
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

  if (error && equipamentos.length === 0) {
    return (
      <>
        <Helmet><title>Equipamentos - DNM&LTDA</title><meta name="description" content="Gestão de equipamentos" /></Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar equipamentos</h2>
          <p className="text-muted-foreground mb-6">Houve um problema ao conectar com o banco de dados.</p>
          <Button onClick={() => fetchEquipamentos(1)}>Tentar novamente</Button>
        </div>
      </>
    );
  }

  if (!companyId) {
    return (
      <>
        <Helmet><title>Equipamentos - DNM&LTDA</title><meta name="description" content="Gestão de equipamentos" /></Helmet>
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
        <title>Equipamentos - DNM&LTDA</title>
        <meta name="description" content="Gestão completa de equipamentos: cadastro, transferências, manutenção, baixa, histórico e QR Code do sistema integrado de gestão para construção civil" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-1 text-marinho flex items-center gap-3"><IconeModulo3D icon={Wrench} />Equipamentos</h1>
            <p className="text-muted-foreground">Gestão completa de equipamentos — cadastro, transferências, manutenção e baixa</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePrint} title="Imprimir"><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
            <Button variant="outline" onClick={handleExportExcel} title="Exportar Excel"><FileSpreadsheet className="w-4 h-4 mr-2" />Excel</Button>
            {perms.canCreate && (
              <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />Novo Equipamento
              </Button>
            )}
          </div>
        </div>

        {/* Dashboard KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={Package} label="Total de Equipamentos" value={formatNumber(dashboard.total)} color="text-primary" />
          <KpiCard icon={Boxes} label="Em Uso" value={formatNumber(dashboard.emUso)} color="text-blue-600" />
          <KpiCard icon={CheckCircle2} label="Disponíveis" value={formatNumber(dashboard.disponiveis)} color="text-green-600" />
          <KpiCard icon={Wrench} label="Em Manutenção" value={formatNumber(dashboard.emManut)} color="text-amber-600" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KpiCard icon={AlertTriangle} label="Com Problemas" value={formatNumber(dashboard.problemas)} sub="extraviado/danificado" color="text-red-600" />
          <KpiCard icon={TrendingDown} label="Custo Total" value={formatCurrency(dashboard.custoTotal)} color="text-primary" />
          <KpiCard icon={TrendingDown} label="Valor Depreciado" value={formatCurrency(dashboard.valorDepreciado)} color="text-amber-600" />
          <KpiCard icon={Package} label="Valor Atual" value={formatCurrency(dashboard.custoTotal - dashboard.valorDepreciado)} color="text-green-600" />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Equipamentos por Situação</h3>
              {dashboard.chartSituacao.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={dashboard.chartSituacao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name} labelLine={false}>
                      {dashboard.chartSituacao.map((entry, i) => (
                        <Cell key={i} fill={SITUACAO_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Equipamentos por Categoria</h3>
              {dashboard.chartCategoria.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dashboard.chartCategoria} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#0A1F4D" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Por Estado de Conservação</h3>
              {dashboard.chartEstado.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dashboard.chartEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name }) => name} labelLine={false}>
                      {dashboard.chartEstado.map((entry, i) => (
                        <Cell key={i} fill={ESTADO_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Por Obra</h3>
              {dashboard.chartObra.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dashboard.chartObra} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#E5B339" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>}
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
                  placeholder="Buscar por nome, patrimônio, código, QR, série, marca, modelo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-none shadow-none focus-visible:ring-0 px-0 text-base"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={filterSituacao} onValueChange={setFilterSituacao}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Situação" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as situações</SelectItem>
                    {SITUACAO_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterEstado} onValueChange={setFilterEstado}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os estados</SelectItem>
                    {ESTADO_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                  <Label className="text-xs">Categoria</Label>
                  <Input value={filterCategoria === 'all' ? '' : filterCategoria} onChange={(e) => setFilterCategoria(e.target.value || 'all')} placeholder="Categoria" />
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
                  <Label className="text-xs">Compra - De</Label>
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Compra - Até</Label>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-9" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Emprestados agora */}
        {emprestimos.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="font-semibold">Emprestados agora ({emprestimos.length})</p>
              {emprestimos.map((l) => (
                <div key={l.id} data-testid="emprestimo-aberto" className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-2 text-sm">
                  <div className="flex items-center gap-3">
                  <FotoProtegida record={l} alt="Foto de quem levou" className="h-12 w-12" />
                  <div>
                    <strong>{l.expand?.equipment_id?.nome || 'Equipamento'}</strong>
                    {' com '}{l.expand?.funcionario_id?.nome || '-'}
                    {l.expand?.obra_id?.nome ? ` · ${l.expand.obra_id.nome}` : ''}
                    {l.local_entrega ? ` · ${l.local_entrega}` : ''}
                    <span className="text-muted-foreground"> · desde {dataBR(l.borrow_date)}</span>
                    {l.expected_return_date && (
                      atrasado(l)
                        ? <Badge variant="destructive" className="ml-2">Atrasado (era até {dataBR(l.expected_return_date)})</Badge>
                        : <span className="text-muted-foreground"> · devolver até {dataBR(l.expected_return_date)}</span>
                    )}
                  </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {podePassar(l) && (
                      <Button size="sm" variant="outline" onClick={() => openRepasse(l)}><Repeat className="w-4 h-4 mr-1" />Passar para outra pessoa</Button>
                    )}
                    {perms.canTransfer && l.expand?.equipment_id && (
                      <Button size="sm" variant="outline" onClick={() => openDevolver(l.expand.equipment_id)}><Undo2 className="w-4 h-4 mr-1" />Receber de volta</Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tabela */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patrimônio</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden lg:table-cell">Local/Obra</TableHead>
                  <TableHead className="hidden xl:table-cell">Responsável</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="hidden md:table-cell">Estado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      {searchQuery || activeFiltersCount > 0
                        ? 'Nenhum equipamento encontrado com os filtros aplicados'
                        : 'Nenhum equipamento cadastrado. Clique em "Novo Equipamento" para começar.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  equipamentos.map((eq) => (
                    <TableRow key={eq.id} className={eq.situacao === 'Baixado' ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">{eq.numero_patrimonial || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{eq.nome}</span>
                          <span className="text-xs text-muted-foreground md:hidden">{eq.categoria}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-xs px-2 py-1 bg-muted rounded-full">{eq.categoria || '-'}</span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        <div className="flex flex-col">
                          <span>{eq.local_atual || '-'}</span>
                          <span className="text-xs text-muted-foreground">{expandNome(eq, 'obra_atual_id', obraNome(eq.obra_atual_id))}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {expandNome(eq, 'responsavel_id', usuarioNome(eq.responsavel_id))}
                      </TableCell>
                      <TableCell>{situacaoBadge(eq.situacao)}</TableCell>
                      <TableCell className="hidden md:table-cell">{estadoBadge(eq.estado_conservacao)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" title="Visualizar" onClick={() => handleView(eq)}><Eye className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" title="QR Code / Códigos" onClick={() => openQR(eq)}><QrCode className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" title="Exportar Ficha PDF" onClick={() => handleExportPDF(eq)}><Download className="w-4 h-4" /></Button>
                          {perms.canTransfer && disponivel(eq) && (
                            <Button size="sm" variant="outline" onClick={() => openEmprestar(eq)}><HandHelping className="w-4 h-4 mr-1" />Emprestar</Button>
                          )}
                          {perms.canTransfer && eq.situacao === 'Emprestado' && emprestimoDe(eq) && (
                            <Button size="sm" variant="outline" onClick={() => openDevolver(eq)}><Undo2 className="w-4 h-4 mr-1" />Receber de volta</Button>
                          )}
                          {perms.canTransfer && eq.situacao !== 'Baixado' && eq.situacao !== 'Emprestado' && (
                            <Button size="sm" variant="ghost" title="Transferir" onClick={() => openTransfer(eq)}><ArrowRightLeft className="w-4 h-4" /></Button>
                          )}
                          {perms.canTransfer && eq.situacao !== 'Baixado' && eq.situacao !== 'Emprestado' && (
                            <Button size="sm" variant="ghost" title="Enviar para obra" onClick={() => openSendObra(eq)}><Truck className="w-4 h-4" /></Button>
                          )}
                          {perms.canManutencao && eq.situacao !== 'Baixado' && eq.situacao !== 'Emprestado' && (
                            <Button size="sm" variant="ghost" title="Manutenção" onClick={() => openManut(eq)}><Wrench className="w-4 h-4" /></Button>
                          )}
                          {perms.canCreate && (
                            <Button size="sm" variant="ghost" title="Duplicar" onClick={() => handleDuplicate(eq)}><Copy className="w-4 h-4" /></Button>
                          )}
                          {perms.canEdit && eq.situacao !== 'Baixado' && (
                            <Button size="sm" variant="ghost" title="Editar" onClick={() => handleEdit(eq)}><Pencil className="w-4 h-4" /></Button>
                          )}
                          {perms.canBaixa && eq.situacao !== 'Baixado' && (
                            <Button size="sm" variant="ghost" className="text-amber-600 hover:bg-amber-500/10" title="Baixar equipamento" onClick={() => openBaixa(eq)}><Archive className="w-4 h-4" /></Button>
                          )}
                          {perms.canDelete && (
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" title="Excluir" onClick={() => handleDelete(eq)}><Trash2 className="w-4 h-4" /></Button>
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
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages} • {totalItems} equipamento(s)</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => fetchEquipamentos(page - 1)}>
                <ChevronLeft className="w-4 h-4" />Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages || loading} onClick={() => fetchEquipamentos(page + 1)}>
                Próxima<ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Modal Criar/Editar ---------- */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[900px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar Equipamento ${editing.numero_patrimonial || ''}` : 'Novo Equipamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identificação */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="eq_nome">Nome *</Label>
                <Input id="eq_nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className={formErrors.nome ? 'border-destructive' : ''} />
                {formErrors.nome && <p className="text-xs text-destructive">{formErrors.nome}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_pat">Nº Patrimonial *</Label>
                <Input id="eq_pat" value={formData.numero_patrimonial} onChange={(e) => setFormData({ ...formData, numero_patrimonial: e.target.value })} className={formErrors.numero_patrimonial ? 'border-destructive' : ''} />
                {formErrors.numero_patrimonial && <p className="text-xs text-destructive">{formErrors.numero_patrimonial}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_codint">Código Interno</Label>
                <Input id="eq_codint" value={formData.codigo_interno} onChange={(e) => setFormData({ ...formData, codigo_interno: e.target.value })} className={formErrors.codigo_interno ? 'border-destructive' : ''} />
                {formErrors.codigo_interno && <p className="text-xs text-destructive">{formErrors.codigo_interno}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_codqr">Código QR</Label>
                <Input id="eq_codqr" value={formData.codigo_qr} onChange={(e) => setFormData({ ...formData, codigo_qr: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_codbar">Código de Barras</Label>
                <Input id="eq_codbar" value={formData.codigo_barras} onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_cat">Categoria *</Label>
                <Input id="eq_cat" list="eq_cat_list" value={formData.categoria} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })} className={formErrors.categoria ? 'border-destructive' : ''} />
                <datalist id="eq_cat_list">{CATEGORIA_SUGESTOES.map((c) => <option key={c} value={c} />)}</datalist>
                {formErrors.categoria && <p className="text-xs text-destructive">{formErrors.categoria}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_marca">Marca</Label>
                <Input id="eq_marca" value={formData.marca} onChange={(e) => setFormData({ ...formData, marca: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_modelo">Modelo</Label>
                <Input id="eq_modelo" value={formData.modelo} onChange={(e) => setFormData({ ...formData, modelo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_fab">Fabricante</Label>
                <Input id="eq_fab" value={formData.fabricante} onChange={(e) => setFormData({ ...formData, fabricante: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_serie">Nº de Série</Label>
                <Input id="eq_serie" value={formData.numero_serie} onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })} className={formErrors.numero_serie ? 'border-destructive' : ''} />
                {formErrors.numero_serie && <p className="text-xs text-destructive">{formErrors.numero_serie}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="eq_desc">Descrição</Label>
              <Textarea id="eq_desc" value={formData.descricao} onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} rows={2} />
            </div>

            {/* Aquisição */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="eq_forn">Fornecedor</Label>
                <Select value={formData.fornecedor_id || 'none'} onValueChange={(v) => setFormData({ ...formData, fornecedor_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="eq_forn"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_datacompra">Data Compra</Label>
                <Input id="eq_datacompra" type="date" value={formData.data_compra} onChange={(e) => setFormData({ ...formData, data_compra: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_nf">Nota Fiscal</Label>
                <Input id="eq_nf" value={formData.nota_fiscal} onChange={(e) => setFormData({ ...formData, nota_fiscal: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_gar">Garantia</Label>
                <Input id="eq_gar" value={formData.garantia} onChange={(e) => setFormData({ ...formData, garantia: e.target.value })} placeholder="Ex: 12 meses" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_vida">Vida Útil (anos)</Label>
                <Input id="eq_vida" type="number" min="0" value={formData.vida_util} onChange={(e) => setFormData({ ...formData, vida_util: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_vc">Valor Compra (R$)</Label>
                <Input id="eq_vc" type="number" step="0.01" min="0" value={formData.valor_compra} onChange={(e) => setFormData({ ...formData, valor_compra: e.target.value })} className={formErrors.valor_compra ? 'border-destructive' : ''} />
                {formErrors.valor_compra && <p className="text-xs text-destructive">{formErrors.valor_compra}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_va">Valor Atual (R$)</Label>
                <Input id="eq_va" type="number" step="0.01" min="0" value={formData.valor_atual} onChange={(e) => setFormData({ ...formData, valor_atual: e.target.value })} className={formErrors.valor_atual ? 'border-destructive' : ''} />
                {formErrors.valor_atual && <p className="text-xs text-destructive">{formErrors.valor_atual}</p>}
              </div>
              <div className="space-y-1">
                <Label>Depreciação</Label>
                <div className="h-9 flex items-center font-semibold text-amber-600 px-2 border rounded-md bg-muted/30">{formatCurrency(depreciacaoCalc)}</div>
              </div>
            </div>

            {/* Estado e localização */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="eq_estado">Estado Conservação</Label>
                <Select value={formData.estado_conservacao} onValueChange={(v) => setFormData({ ...formData, estado_conservacao: v })}>
                  <SelectTrigger id="eq_estado"><SelectValue /></SelectTrigger>
                  <SelectContent>{ESTADO_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_sit">Situação</Label>
                <Select value={formData.situacao} onValueChange={(v) => setFormData({ ...formData, situacao: v })}>
                  <SelectTrigger id="eq_sit"><SelectValue /></SelectTrigger>
                  <SelectContent>{SITUACAO_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="eq_local">Local Atual</Label>
                <SeletorLocalEquip id="eq_local" obras={obras} value={formData.local_atual} onChange={(v) => setFormData({ ...formData, local_atual: v })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="eq_obra">Obra Atual</Label>
                <Select value={formData.obra_atual_id || 'none'} onValueChange={(v) => setFormData({ ...formData, obra_atual_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="eq_obra"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_resp">Responsável</Label>
                <Select value={formData.responsavel_id || 'none'} onValueChange={(v) => setFormData({ ...formData, responsavel_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="eq_resp"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_func">Funcionário</Label>
                <Select value={formData.funcionario_id || 'none'} onValueChange={(v) => setFormData({ ...formData, funcionario_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="eq_func"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_cc">Centro de Custo</Label>
                <Input id="eq_cc" value={formData.centro_custo} onChange={(e) => setFormData({ ...formData, centro_custo: e.target.value })} />
              </div>
            </div>

            {/* Anexos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/20">
              <div className="space-y-1">
                <Label htmlFor="eq_fotos">Fotos</Label>
                <Input id="eq_fotos" type="file" multiple accept="image/*" onChange={(e) => setFileInputs((p) => ({ ...p, fotos: Array.from(e.target.files) }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_docs">Documentos</Label>
                <Input id="eq_docs" type="file" multiple onChange={(e) => setFileInputs((p) => ({ ...p, documentos: Array.from(e.target.files) }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_manual">Manual</Label>
                <Input id="eq_manual" type="file" onChange={(e) => setFileInputs((p) => ({ ...p, manual: e.target.files[0] || null }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq_certs">Certificados</Label>
                <Input id="eq_certs" type="file" multiple onChange={(e) => setFileInputs((p) => ({ ...p, certificados: Array.from(e.target.files) }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="eq_obs">Observações</Label>
              <Textarea id="eq_obs" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} rows={3} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Atualizar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Detalhes + Histórico + Manutenção ---------- */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[860px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.nome} {viewing?.numero_patrimonial ? `· ${viewing.numero_patrimonial}` : ''}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <Tabs value={viewTab} onValueChange={setViewTab}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="manutencao">Manutenção ({manutencoes.length})</TabsTrigger>
                <TabsTrigger value="historico">Histórico ({historicos.length})</TabsTrigger>
              </TabsList>

              {/* Detalhes */}
              <TabsContent value="detalhes" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Situação</p>{situacaoBadge(viewing.situacao)}</div>
                  <div><p className="text-xs text-muted-foreground">Estado Conservação</p>{estadoBadge(viewing.estado_conservacao)}</div>
                  <div><p className="text-xs text-muted-foreground">Categoria</p><p className="font-medium">{viewing.categoria || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Marca / Modelo</p><p className="font-medium">{viewing.marca || '-'} / {viewing.modelo || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Nº Série</p><p className="font-medium">{viewing.numero_serie || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Fabricante</p><p className="font-medium">{viewing.fabricante || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Código Interno</p><p className="font-medium">{viewing.codigo_interno || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Código QR</p><p className="font-medium">{viewing.codigo_qr || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Código Barras</p><p className="font-medium">{viewing.codigo_barras || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Fornecedor</p><p className="font-medium">{expandNome(viewing, 'fornecedor_id', fornecedorNome(viewing.fornecedor_id))}</p></div>
                  <div><p className="text-xs text-muted-foreground">Data Compra</p><p className="font-medium">{formatDate(viewing.data_compra)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Nota Fiscal</p><p className="font-medium">{viewing.nota_fiscal || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Garantia</p><p className="font-medium">{viewing.garantia || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Vida Útil</p><p className="font-medium">{viewing.vida_util ? `${viewing.vida_util} anos` : '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Valor Compra</p><p className="font-medium">{formatCurrency(viewing.valor_compra)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Valor Atual</p><p className="font-medium">{formatCurrency(viewing.valor_atual)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Depreciação</p><p className="font-medium text-amber-600">{formatCurrency(viewing.depreciacao)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Centro de Custo</p><p className="font-medium">{viewing.centro_custo || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Local Atual</p><p className="font-medium">{viewing.local_atual || '-'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Obra</p><p className="font-medium">{expandNome(viewing, 'obra_atual_id', obraNome(viewing.obra_atual_id))}</p></div>
                  <div><p className="text-xs text-muted-foreground">Responsável</p><p className="font-medium">{expandNome(viewing, 'responsavel_id', usuarioNome(viewing.responsavel_id))}</p></div>
                  <div><p className="text-xs text-muted-foreground">Funcionário</p><p className="font-medium">{expandNome(viewing, 'funcionario_id', funcionarioNome(viewing.funcionario_id))}</p></div>
                </div>

                {viewing.descricao && (
                  <div><p className="text-xs text-muted-foreground">Descrição</p><p className="text-sm">{viewing.descricao}</p></div>
                )}
                {viewing.observacoes && (
                  <div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm whitespace-pre-wrap">{viewing.observacoes}</p></div>
                )}
                {viewing.motivo_baixa && (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <p className="text-xs text-amber-700 font-medium">Motivo da baixa</p>
                    <p className="text-sm">{viewing.motivo_baixa}</p>
                  </div>
                )}

                {/* Anexos */}
                {(() => {
                  const fileFields = [
                    { key: 'fotos', label: 'Fotos' },
                    { key: 'documentos', label: 'Documentos' },
                    { key: 'manual', label: 'Manual' },
                    { key: 'certificados', label: 'Certificados' },
                  ];
                  const hasAny = fileFields.some((f) => viewing[f.key] && (Array.isArray(viewing[f.key]) ? viewing[f.key].length > 0 : true));
                  if (!hasAny) return null;
                  return (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-semibold mb-2">Anexos</p>
                      <div className="space-y-2">
                        {fileFields.map((f) => {
                          const val = viewing[f.key];
                          if (!val) return null;
                          const files = Array.isArray(val) ? val : [val];
                          if (files.length === 0) return null;
                          return (
                            <div key={f.key}>
                              <p className="text-xs text-muted-foreground">{f.label}</p>
                              <div className="flex flex-wrap gap-2">
                                {files.map((file, i) => {
                                  const url = pb.files.getURL(viewing, file);
                                  const name = typeof file === 'string' ? file : file?.name || `${f.key}-${i + 1}`;
                                  return (
                                    <a key={i} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted">
                                      <Download className="w-3 h-3" />{String(name).substring(0, 30)}
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => openQR(viewing)}><QrCode className="w-4 h-4 mr-1" />QR/Códigos</Button>
                  <Button variant="outline" size="sm" onClick={() => handleExportPDF(viewing)}><Download className="w-4 h-4 mr-1" />Ficha PDF</Button>
                  {perms.canTransfer && viewing.situacao !== 'Baixado' && (
                    <Button variant="outline" size="sm" onClick={() => { setViewOpen(false); openTransfer(viewing); }}><ArrowRightLeft className="w-4 h-4 mr-1" />Transferir</Button>
                  )}
                  {perms.canEdit && viewing.situacao !== 'Baixado' && (
                    <Button variant="outline" size="sm" onClick={() => { setViewOpen(false); handleEdit(viewing); }}><Pencil className="w-4 h-4 mr-1" />Editar</Button>
                  )}
                </div>
              </TabsContent>

              {/* Manutenção */}
              <TabsContent value="manutencao" className="space-y-3 mt-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold">Manutenções registradas</p>
                  {perms.canManutencao && viewing.situacao !== 'Baixado' && (
                    <Button size="sm" variant="outline" onClick={() => openManut(viewing)}><Plus className="w-4 h-4 mr-1" />Nova Manutenção</Button>
                  )}
                </div>
                {manutencoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma manutenção registrada.</p>
                ) : (
                  <div className="space-y-2">
                    {manutencoes.map((m) => (
                      <div key={m.id} className="p-3 rounded-lg border">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-amber-600" />
                            <span className="font-medium">{m.tipo}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(m.data_prevista)}</span>
                          </div>
                          <Select value={m.status || 'Agendada'} onValueChange={(v) => handleManutStatusChange(m, v)} disabled={!perms.canManutencao}>
                            <SelectTrigger className="h-7 w-[140px]">
                              <span className="text-xs">{m.status || 'Agendada'}</span>
                            </SelectTrigger>
                            <SelectContent>{MANUT_STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        {m.descricao && <p className="text-sm mt-1">{m.descricao}</p>}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground">
                          <span>Custo: {formatCurrency(m.custos)}</span>
                          <span>Realizada: {formatDate(m.data_realizada)}</span>
                          <span>Próxima: {formatDate(m.proxima_manutencao)}</span>
                          <span>Resp: {expandNome(m, 'responsavel_id', usuarioNome(m.responsavel_id))}</span>
                        </div>
                        {m.observacoes && <p className="text-xs text-muted-foreground italic mt-1">{m.observacoes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Histórico / Timeline */}
              <TabsContent value="historico" className="space-y-3 mt-4">
                <p className="text-sm font-semibold">Linha do tempo (imutável)</p>
                {historicos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum histórico registrado.</p>
                ) : (
                  <div className="relative pl-5 space-y-4">
                    <div className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
                    {historicos.map((h) => {
                      const color = h.novo_status ? (SITUACAO_COLORS[h.novo_status] || '#2563eb') : '#2563eb';
                      return (
                        <div key={h.id} className="relative">
                          <span className="absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full border-2 border-background" style={{ background: color }} />
                          <p className="text-sm font-medium">{h.alteracao_realizada}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(h.data)} {h.hora}</p>
                          <p className="text-xs text-muted-foreground">por {expandNome(h, 'usuario_id', usuarioNome(h.usuario_id))}</p>
                          {h.detalhes && <p className="text-xs text-muted-foreground italic">{h.detalhes}</p>}
                          {(h.status_anterior || h.novo_status) && (
                            <p className="text-xs text-muted-foreground">{h.status_anterior || '-'} → {h.novo_status || '-'}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Transferência ---------- */}
      <Dialog open={!!transferTarget} onOpenChange={(open) => { if (!open) setTransferTarget(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Transferir Equipamento</DialogTitle></DialogHeader>
          {transferTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Transferindo <strong>{transferTarget.nome}</strong> ({transferTarget.numero_patrimonial})</p>
              <div className="space-y-1">
                <Label htmlFor="tr_local">Novo Local</Label>
                <SeletorLocalEquip id="tr_local" obras={obras} value={transferData.local_atual} onChange={(v) => setTransferData({ ...transferData, local_atual: v })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr_resp">Novo Responsável</Label>
                <Select value={transferData.responsavel_id || 'none'} onValueChange={(v) => setTransferData({ ...transferData, responsavel_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="tr_resp"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr_obra">Nova Obra</Label>
                <Select value={transferData.obra_atual_id || 'none'} onValueChange={(v) => setTransferData({ ...transferData, obra_atual_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="tr_obra"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tr_obs">Observações</Label>
                <Textarea id="tr_obs" value={transferData.observacoes} onChange={(e) => setTransferData({ ...transferData, observacoes: e.target.value })} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTransferTarget(null)}>Cancelar</Button>
                <Button onClick={handleTransfer}>Confirmar Transferência</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Enviar para obra ---------- */}
      <Dialog open={!!obraTarget} onOpenChange={(open) => { if (!open) setObraTarget(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Enviar para Obra</DialogTitle></DialogHeader>
          {obraTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Enviando <strong>{obraTarget.nome}</strong> para uma obra</p>
              <div className="space-y-1">
                <Label htmlFor="ob_obra">Obra de Destino *</Label>
                <Select value={obraData.obra_atual_id || 'none'} onValueChange={(v) => setObraData({ ...obraData, obra_atual_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="ob_obra"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ob_local">Local na obra</Label>
                <SeletorLocalEquip id="ob_local" obras={obras} value={obraData.local_atual} onChange={(v) => setObraData({ ...obraData, local_atual: v })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ob_obs">Observações</Label>
                <Textarea id="ob_obs" value={obraData.observacoes} onChange={(e) => setObraData({ ...obraData, observacoes: e.target.value })} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setObraTarget(null)}>Cancelar</Button>
                <Button onClick={handleSendObra}>Enviar para Obra</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Emprestar ---------- */}
      <Dialog open={!!empTarget} onOpenChange={(open) => { if (!open) setEmpTarget(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Emprestar equipamento</DialogTitle></DialogHeader>
          {empTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Quem vai levar <strong>{empTarget.nome}</strong>?</p>
              <div className="space-y-1">
                <Label htmlFor="emp_func">Com quem fica *</Label>
                <Select value={empData.funcionario_id || 'none'} onValueChange={(v) => setEmpData({ ...empData, funcionario_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="emp_func"><SelectValue placeholder="Escolha a pessoa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Escolha a pessoa...</SelectItem>
                    {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_obra">Para qual obra (opcional)</Label>
                <Select value={empData.obra_id || 'none'} onValueChange={(v) => setEmpData({ ...empData, obra_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="emp_obra"><SelectValue placeholder="Sem obra" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem obra</SelectItem>
                    {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="emp_ate">Devolver até (opcional)</Label>
                <Input id="emp_ate" type="date" value={empData.expected_return_date} onChange={(e) => setEmpData({ ...empData, expected_return_date: e.target.value })} />
              </div>
              <FotoRetirada rotulo="Foto de quem está levando o equipamento" onFoto={(f) => setEmpData((x) => ({ ...x, foto: f }))} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEmpTarget(null)}>Cancelar</Button>
                <Button onClick={handleEmprestar} disabled={empSalvando || !empData.foto}>Confirmar empréstimo</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Passar para outra pessoa ---------- */}
      <Dialog open={!!repTarget} onOpenChange={(open) => { if (!open) setRepTarget(null); }}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Passar para outra pessoa</DialogTitle></DialogHeader>
          {repTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong>{repTarget.expand?.equipment_id?.nome}</strong> está com {repTarget.expand?.funcionario_id?.nome || '-'}. Para quem vai agora?
              </p>
              <div className="space-y-1">
                <Label htmlFor="rep_func">Para quem *</Label>
                <Select value={repData.funcionario_id || 'none'} onValueChange={(v) => setRepData({ ...repData, funcionario_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="rep_func"><SelectValue placeholder="Escolha a pessoa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Escolha a pessoa...</SelectItem>
                    {funcionarios.filter((f) => f.id !== repTarget.funcionario_id).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep_local">Onde vocês estão *</Label>
                <Input id="rep_local" placeholder="Ex.: 3º andar, torre B" value={repData.local} onChange={(e) => setRepData({ ...repData, local: e.target.value })} />
                <p className="text-xs text-muted-foreground">O local e a hora ficam registrados: se a obra tiver câmeras, dá para achar a troca na gravação.</p>
              </div>
              <FotoRetirada rotulo="Foto da troca (quem está recebendo)" onFoto={(f) => setRepData((x) => ({ ...x, foto: f }))} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRepTarget(null)}>Cancelar</Button>
                <Button onClick={handleRepasse} disabled={empSalvando || !repData.foto}>Confirmar troca</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Receber de volta ---------- */}
      <Dialog open={!!devTarget} onOpenChange={(open) => { if (!open) setDevTarget(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>Receber de volta</DialogTitle></DialogHeader>
          {devTarget && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong>{devTarget.eq.nome}</strong> estava com {devTarget.l.expand?.funcionario_id?.nome || funcionarioNome(devTarget.l.funcionario_id)}.
                Confira o equipamento: como ele voltou?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Bom', 'Voltou bom'],
                  ['Precisa de manutenção', 'Precisa de manutenção'],
                  ['Danificado', 'Voltou quebrado'],
                  ['Perdido', 'Não voltou (perdido)'],
                ].map(([valor, texto]) => (
                  <button key={valor} type="button" aria-pressed={devData.estado_devolucao === valor}
                    className={`flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm font-medium ${devData.estado_devolucao === valor
                      ? 'border-marinho bg-marinho text-white' : 'bg-background hover:bg-muted'}`}
                    onClick={() => setDevData({ ...devData, estado_devolucao: valor })}>
                    {devData.estado_devolucao === valor && <CheckCircle2 className="w-4 h-4" />}{texto}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor="dev_obs">O que aconteceu? (opcional)</Label>
                <Textarea id="dev_obs" rows={2} value={devData.observacao_devolucao} onChange={(e) => setDevData({ ...devData, observacao_devolucao: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDevTarget(null)}>Cancelar</Button>
                <Button onClick={handleDevolver} disabled={empSalvando || !devData.estado_devolucao}>Registrar devolução</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Manutenção ---------- */}
      <Dialog open={manutDialogOpen} onOpenChange={(open) => { setManutDialogOpen(open); if (!open) setManutTarget(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Manutenção {manutTarget ? `· ${manutTarget.nome}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mn_tipo">Tipo *</Label>
                <Select value={manutForm.tipo} onValueChange={(v) => setManutForm({ ...manutForm, tipo: v })}>
                  <SelectTrigger id="mn_tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>{MANUT_TIPO_VALUES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mn_status">Status</Label>
                <Select value={manutForm.status} onValueChange={(v) => setManutForm({ ...manutForm, status: v })}>
                  <SelectTrigger id="mn_status"><SelectValue /></SelectTrigger>
                  <SelectContent>{MANUT_STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mn_dataprev">Data Prevista *</Label>
                <Input id="mn_dataprev" type="date" value={manutForm.data_prevista} onChange={(e) => setManutForm({ ...manutForm, data_prevista: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mn_datareal">Data Realizada</Label>
                <Input id="mn_datareal" type="date" value={manutForm.data_realizada} onChange={(e) => setManutForm({ ...manutForm, data_realizada: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mn_prox">Próxima Manutenção</Label>
                <Input id="mn_prox" type="date" value={manutForm.proxima_manutencao} onChange={(e) => setManutForm({ ...manutForm, proxima_manutencao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mn_custo">Custos (R$)</Label>
                <Input id="mn_custo" type="number" step="0.01" min="0" value={manutForm.custos} onChange={(e) => setManutForm({ ...manutForm, custos: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mn_forn">Fornecedor</Label>
                <Select value={manutForm.fornecedor_id || 'none'} onValueChange={(v) => setManutForm({ ...manutForm, fornecedor_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="mn_forn"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mn_resp">Responsável</Label>
                <Select value={manutForm.responsavel_id || 'none'} onValueChange={(v) => setManutForm({ ...manutForm, responsavel_id: v === 'none' ? '' : v })}>
                  <SelectTrigger id="mn_resp"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="mn_desc">Descrição</Label>
              <Textarea id="mn_desc" value={manutForm.descricao} onChange={(e) => setManutForm({ ...manutForm, descricao: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mn_obs">Observações</Label>
              <Textarea id="mn_obs" value={manutForm.observacoes} onChange={(e) => setManutForm({ ...manutForm, observacoes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManutDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveManut}>Registrar Manutenção</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Baixa ---------- */}
      <AlertDialog open={!!baixaTarget} onOpenChange={(open) => { if (!open) { setBaixaTarget(null); setBaixaMotivo(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Baixar Equipamento</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da baixa definitiva de <strong>{baixaTarget?.nome}</strong> ({baixaTarget?.numero_patrimonial}). O equipamento será marcado como Baixado e o histórico será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea value={baixaMotivo} onChange={(e) => setBaixaMotivo(e.target.value)} placeholder="Motivo da baixa..." rows={3} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-amber-600 text-white hover:bg-amber-700" onClick={handleBaixa}>Confirmar Baixa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- QR Code / Códigos ---------- */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Códigos do Equipamento</DialogTitle></DialogHeader>
          {qrTarget && (
            <div className="space-y-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nome</p>
                <p className="font-bold">{qrTarget.nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 rounded border"><p className="text-xs text-muted-foreground">Patrimônio</p><p className="font-medium">{qrTarget.numero_patrimonial || '-'}</p></div>
                <div className="p-2 rounded border"><p className="text-xs text-muted-foreground">Código Interno</p><p className="font-medium">{qrTarget.codigo_interno || '-'}</p></div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground">QR Code (lido pela câmera, abre este equipamento no app)</p>
                <QrImagem texto={linkDoItem('equipamento', qrTarget.id)} tamanho={220} onPronto={setQrPng} className="border rounded" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={!qrPng} asChild>
                    <a href={qrPng} download={`qrcode_${qrTarget.numero_patrimonial || qrTarget.codigo_interno || qrTarget.id}.png`}>
                      <Download className="w-4 h-4 mr-1" />Baixar QR Code
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" disabled={!qrPng}
                    onClick={() => imprimirEtiqueta(qrPng, qrTarget.nome, [qrTarget.codigo_interno, qrTarget.numero_patrimonial].filter(Boolean).join(' · '))}>
                    <Printer className="w-4 h-4 mr-1" />Imprimir etiqueta
                  </Button>
                </div>
              </div>

              {qrTarget.codigo_barras && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground">Código de Barras</p>
                  <div className="font-mono text-2xl tracking-widest border px-4 py-2 rounded bg-muted/30">{qrTarget.codigo_barras}</div>
                  <CodigoBarras texto={qrTarget.codigo_barras} className="border rounded max-w-full" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EquipamentosPage;
