import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { auditLog, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/auditLogger.js';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
  HardHat,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Eye,
  History,
  FileText,
  FileSpreadsheet,
  Printer,
  TrendingUp,
  Boxes,
  Clock,
  X,
  Save,
  Signature,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ehAdmin, cargoDe } from '@/lib/permissoes.js';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const CATEGORIAS = [
  'Capacete', 'Botina', 'Óculos', 'Luva', 'Máscara', 'Respirador',
  'Protetor Auricular', 'Cinto de Segurança', 'Talabarte', 'Uniforme',
  'Colete', 'Avental', 'Perneira', 'Mangote', 'Protetor Facial', 'Outros',
];

const SITUACOES_ENTREGA = ['Entregue', 'Pendente', 'Devolvido', 'Extraviado', 'Danificado'];
const ESTADOS_EPI = ['Bom', 'Desgastado', 'Danificado', 'Sujo', 'Outro'];
const TIPOS_REPOSICAO = [
  'Troca por desgaste', 'Troca por perda', 'Troca por vencimento',
  'Troca por dano', 'Troca preventiva',
];
const TIPOS_OPERACAO = ['Entrega', 'Devolução', 'Reposição', 'Alteração', 'Exclusão'];
const STATUS_EPI = ['Ativo', 'Inativo'];

const CHART_COLORS = ['#1a3a52', '#d4af37', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#a855f7', '#f43f5e', '#eab308', '#64748b'];

const fmtCurrency = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('pt-BR') : '-');
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString('pt-BR') : '-');
const todayISO = () => new Date().toISOString().split('T')[0];
const nowTime = () => new Date().toTimeString().split(' ')[0];

// Geração de números sequenciais
const genNumero = async (collection, prefix, companyId) => {
  try {
    const list = await pb.collection(collection).getList(1, 1, {
      filter: `company_id = "${companyId}"`,
      sort: '-created',
      $autoCancel: false,
    });
    const count = (list.totalItems || 0) + 1;
    return `${prefix}-${String(count).padStart(6, '0')}`;
  } catch (_) {
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }
};

// ---------------------------------------------------------------------------
// Componente de Assinatura Digital
// ---------------------------------------------------------------------------
const SignaturePad = ({ value, onChange }) => {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasSig, setHasSig] = useState(!!value);

  const getCtx = () => canvasRef.current?.getContext('2d');

  const startDraw = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    ctx.beginPath();
    ctx.moveTo(point.clientX - rect.left, point.clientY - rect.top);
  };
  const draw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    ctx.lineTo(point.clientX - rect.left, point.clientY - rect.top);
    ctx.stroke();
    setHasSig(true);
  };
  const endDraw = () => {
    drawing.current = false;
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const ctx = getCtx();
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setHasSig(false);
    onChange('');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a3a52';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
  }, []);

  return (
    <div className="space-y-2">
      <Label>Assinatura Digital do Funcionário</Label>
      <canvas
        ref={canvasRef}
        width={460}
        height={160}
        className="w-full h-40 border-2 border-dashed border-border rounded-lg bg-white touch-none cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Signature className="w-3 h-3" /> {hasSig ? 'Assinatura capturada' : 'Assine acima'}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <X className="w-3 h-3 mr-1" /> Limpar
        </Button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
const EPIsPage = () => {
  const { currentUser, isAdmin } = useAuth();
  const companyId = currentUser?.company_id;

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');

  // Dados
  const [epis, setEpis] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [devolucoes, setDevolucoes] = useState([]);
  const [reposicoes, setReposicoes] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [obras, setObras] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);

  // Filtros / busca
  const [search, setSearch] = useState('');
  const [fCategoria, setFCategoria] = useState('all');
  const [fFornecedor, setFFornecedor] = useState('all');
  const [fSituacao, setFSituacao] = useState('all');
  const [fStatus, setFStatus] = useState('all');

  // Modais
  const [epiModalOpen, setEpiModalOpen] = useState(false);
  const [editingEpi, setEditingEpi] = useState(null);
  const [detalhesEpi, setDetalhesEpi] = useState(null);
  const [entregaModalOpen, setEntregaModalOpen] = useState(false);
  const [devolucaoModalOpen, setDevolucaoModalOpen] = useState(false);
  const [reposicaoModalOpen, setReposicaoModalOpen] = useState(false);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoEpi, setHistoricoEpi] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Permissões
  const role = cargoDe(currentUser);
  const canManage = isAdmin || ehAdmin(currentUser) ||
    ['Técnico de Segurança', 'Almoxarife', 'Gerência', 'Gerente', 'RH', 'Mestre de Obras'].includes(role);
  const canDelete = isAdmin || ehAdmin(currentUser);
  const isFuncionarioOnly = role === 'Funcionário';

  // -------------------------------------------------------------------------
  // Carregamento inicial
  // -------------------------------------------------------------------------
  const loadAll = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const f = `company_id = "${companyId}"`;
      const [ep, ent, dev, rep, hist, funcs, obs, forn] = await Promise.allSettled([
        pb.collection('epis').getFullList({ filter: f, sort: '-created', $autoCancel: false }),
        pb.collection('epis_entregas').getFullList({ filter: f, sort: '-created', expand: 'funcionario_id,epi_id,obra_id,responsavel_id', $autoCancel: false }),
        pb.collection('epis_devolucoes').getFullList({ filter: f, sort: '-created', expand: 'entrega_id,funcionario_id,responsavel_id', $autoCancel: false }),
        pb.collection('epis_reposicoes').getFullList({ filter: f, sort: '-created', expand: 'funcionario_id,epi_id,responsavel_id', $autoCancel: false }),
        pb.collection('epis_historico').getFullList({ filter: f, sort: '-created', expand: 'funcionario_id,epi_id,usuario_id', $autoCancel: false }),
        pb.collection('funcionarios').getFullList({ filter: f, $autoCancel: false }),
        pb.collection('obras').getFullList({ filter: f, $autoCancel: false }),
        pb.collection('fornecedores').getFullList({ filter: f, $autoCancel: false }),
      ]);
      const v = (r, fb) => (r.status === 'fulfilled' ? r.value : fb);
      setEpis(v(ep, []));
      setEntregas(v(ent, []));
      setDevolucoes(v(dev, []));
      setReposicoes(v(rep, []));
      setHistorico(v(hist, []));
      setFuncionarios(v(funcs, []));
      setObras(v(obs, []));
      setFornecedores(v(forn, []));
    } catch (err) {
      console.error('Erro ao carregar EPIs:', err);
      toast.error('Erro ao carregar dados de EPIs');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // -------------------------------------------------------------------------
  // Realtime subscriptions (live data)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!companyId) return;
    const cols = ['epis', 'epis_entregas', 'epis_devolucoes', 'epis_reposicoes', 'epis_historico'];
    const subs = cols.map((c) =>
      pb.collection(c).subscribe('*', (e) => {
        if (e.action === 'delete') {
          if (c === 'epis') setEpis((p) => p.filter((x) => x.id !== e.record.id));
          if (c === 'epis_entregas') setEntregas((p) => p.filter((x) => x.id !== e.record.id));
          if (c === 'epis_devolucoes') setDevolucoes((p) => p.filter((x) => x.id !== e.record.id));
          if (c === 'epis_reposicoes') setReposicoes((p) => p.filter((x) => x.id !== e.record.id));
          if (c === 'epis_historico') setHistorico((p) => p.filter((x) => x.id !== e.record.id));
          return;
        }
        const rec = e.record;
        if (rec.company_id !== companyId) return;
        if (c === 'epis') setEpis((p) => {
          const i = p.findIndex((x) => x.id === rec.id);
          if (i === -1) return [rec, ...p];
          const cp = [...p]; cp[i] = rec; return cp;
        });
        if (c === 'epis_entregas') setEntregas((p) => {
          const i = p.findIndex((x) => x.id === rec.id);
          if (i === -1) return [rec, ...p];
          const cp = [...p]; cp[i] = rec; return cp;
        });
        if (c === 'epis_devolucoes') setDevolucoes((p) => {
          const i = p.findIndex((x) => x.id === rec.id);
          if (i === -1) return [rec, ...p];
          const cp = [...p]; cp[i] = rec; return cp;
        });
        if (c === 'epis_reposicoes') setReposicoes((p) => {
          const i = p.findIndex((x) => x.id === rec.id);
          if (i === -1) return [rec, ...p];
          const cp = [...p]; cp[i] = rec; return cp;
        });
        if (c === 'epis_historico') setHistorico((p) => {
          const i = p.findIndex((x) => x.id === rec.id);
          if (i === -1) return [rec, ...p];
          const cp = [...p]; cp[i] = rec; return cp;
        });
      }).catch(() => {})
    );
    return () => {
      cols.forEach((c) => { try { pb.collection(c).unsubscribe('*'); } catch (_) {} });
    };
  }, [companyId]);

  // -------------------------------------------------------------------------
  // Helpers de histórico imutável
  // -------------------------------------------------------------------------
  const registrarHistorico = async (dados) => {
    try {
      await pb.collection('epis_historico').create({
        ...dados,
        company_id: companyId,
        usuario_id: currentUser?.id,
        criado_por: currentUser?.id,
      }, { $autoCancel: false });
    } catch (err) {
      console.error('Erro ao registrar histórico:', err);
    }
  };

  // -------------------------------------------------------------------------
  // Alertas automáticos
  // -------------------------------------------------------------------------
  const alertas = useMemo(() => {
    const hoje = new Date();
    const trinta = new Date(hoje); trinta.setDate(trinta.getDate() + 30);
    const caVencendo = epis.filter((e) => e.validade_ca && new Date(e.validade_ca) >= hoje && new Date(e.validade_ca) <= trinta);
    const caVencido = epis.filter((e) => e.validade_ca && new Date(e.validade_ca) < hoje);
    const estoqueBaixo = epis.filter((e) => Number(e.estoque_minimo || 0) > 0 && Number(e.quantidade_estoque || 0) <= Number(e.estoque_minimo || 0));
    const entregasPendentes = entregas.filter((e) => e.situacao === 'Pendente');
    const trocaObrigatoria = entregas.filter((e) => e.prazo_troca && new Date(e.prazo_troca) < hoje && e.situacao === 'Entregue');
    const funcsComEpi = new Set(entregas.filter((e) => e.situacao === 'Entregue' || e.situacao === 'Pendente').map((e) => e.funcionario_id));
    const funcsSemEpi = funcionarios.filter((f) => f.status === 'Ativo' && !funcsComEpi.has(f.id));
    return { caVencendo, caVencido, estoqueBaixo, entregasPendentes, trocaObrigatoria, funcsSemEpi };
  }, [epis, entregas, funcionarios]);

  // -------------------------------------------------------------------------
  // KPIs e gráficos
  // -------------------------------------------------------------------------
  const kpis = useMemo(() => {
    const totalEpis = epis.length;
    const entregues = entregas.filter((e) => e.situacao === 'Entregue').length;
    const disponivelEstoque = epis.reduce((s, e) => s + Number(e.quantidade_estoque || 0), 0);
    const atraso = alertas.trocaObrigatoria.length + alertas.entregasPendentes.length;
    const valorEstoque = epis.reduce((s, e) => s + Number(e.quantidade_estoque || 0) * Number(e.valor_unitario || 0), 0);
    return { totalEpis, entregues, disponivelEstoque, atraso, valorEstoque };
  }, [epis, entregas, alertas]);

  const chartCategoria = useMemo(() => {
    const m = {};
    epis.forEach((e) => { const c = e.categoria || 'Outros'; m[c] = (m[c] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [epis]);

  const chartSituacao = useMemo(() => {
    const m = {};
    entregas.forEach((e) => { const s = e.situacao || 'Entregue'; m[s] = (m[s] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [entregas]);

  const chartPorFuncionario = useMemo(() => {
    const m = {};
    entregas.forEach((e) => {
      const f = funcionarios.find((x) => x.id === e.funcionario_id);
      const nome = f?.nome_completo || f?.nome || 'Desconhecido';
      m[nome] = (m[nome] || 0) + Number(e.quantidade || 1);
    });
    return Object.entries(m).slice(0, 8).map(([name, value]) => ({ name: name.split(' ')[0], value }));
  }, [entregas, funcionarios]);

  const chartPorObra = useMemo(() => {
    const m = {};
    entregas.forEach((e) => {
      if (!e.obra_id) return;
      const o = obras.find((x) => x.id === e.obra_id);
      const nome = o?.nome || o?.nome_obra || 'Sem obra';
      m[nome] = (m[nome] || 0) + 1;
    });
    return Object.entries(m).map(([name, value]) => ({ name: name.slice(0, 15), value }));
  }, [entregas, obras]);

  // -------------------------------------------------------------------------
  // Filtros da tabela
  // -------------------------------------------------------------------------
  const filteredEpis = useMemo(() => {
    return epis.filter((e) => {
      if (fCategoria !== 'all' && e.categoria !== fCategoria) return false;
      if (fFornecedor !== 'all' && e.fornecedor_id !== fFornecedor) return false;
      if (fStatus !== 'all' && (e.status || 'Ativo') !== fStatus) return false;
      if (fSituacao !== 'all') {
        const temEntrega = entregas.some((x) => x.epi_id === e.id && x.situacao === fSituacao);
        if (!temEntrega) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const forn = fornecedores.find((f) => f.id === e.fornecedor_id);
        const blob = `${e.codigo || ''} ${e.nome || ''} ${e.numero_ca || ''} ${e.categoria || ''} ${e.marca || ''} ${forn?.nome || ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [epis, entregas, fornecedores, search, fCategoria, fFornecedor, fSituacao, fStatus]);

  // -------------------------------------------------------------------------
  // CRUD EPI
  // -------------------------------------------------------------------------
  const emptyForm = {
    codigo: '', nome: '', descricao: '', categoria: 'Capacete', marca: '', modelo: '',
    fabricante: '', fornecedor_id: '', numero_ca: '', validade_ca: '', norma_regulamentadora: '',
    tamanho: '', cor: '', material: '', quantidade_estoque: 0, estoque_minimo: 0, unidade: 'un',
    valor_unitario: 0, valor_medio: 0, local_armazenamento: '', observacoes: '', status: 'Ativo',
  };
  const [form, setForm] = useState(emptyForm);

  const openNewEpi = () => { setEditingEpi(null); setForm(emptyForm); setEpiModalOpen(true); };
  const openEditEpi = (epi) => {
    setEditingEpi(epi);
    setForm({
      codigo: epi.codigo || '', nome: epi.nome || '', descricao: epi.descricao || '',
      categoria: epi.categoria || 'Capacete', marca: epi.marca || '', modelo: epi.modelo || '',
      fabricante: epi.fabricante || '', fornecedor_id: epi.fornecedor_id || '',
      numero_ca: epi.numero_ca || '', validade_ca: epi.validade_ca ? epi.validade_ca.split('T')[0] : '',
      norma_regulamentadora: epi.norma_regulamentadora || '', tamanho: epi.tamanho || '',
      cor: epi.cor || '', material: epi.material || '',
      quantidade_estoque: epi.quantidade_estoque ?? 0, estoque_minimo: epi.estoque_minimo ?? 0,
      unidade: epi.unidade || 'un', valor_unitario: epi.valor_unitario ?? 0,
      valor_medio: epi.valor_medio ?? 0, local_armazenamento: epi.local_armazenamento || '',
      observacoes: epi.observacoes || '', status: epi.status || 'Ativo',
    });
    setEpiModalOpen(true);
  };

  const saveEpi = async (e) => {
    e.preventDefault();
    if (!companyId) { toast.error('Empresa não identificada'); return; }
    try {
      const payload = {
        ...form,
        // Campos obrigatórios da collection original `epis`
        tipo: form.categoria || form.nome,
        id_unico: editingEpi ? undefined : `EPI-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        quantidade_estoque: Number(form.quantidade_estoque || 0),
        estoque_minimo: Number(form.estoque_minimo || 0),
        valor_unitario: Number(form.valor_unitario || 0),
        valor_medio: Number(form.valor_medio || 0),
        validade_ca: form.validade_ca || null,
        fornecedor_id: form.fornecedor_id || null,
        company_id: companyId,
        criado_por: editingEpi ? undefined : currentUser?.id,
        atualizado_por: currentUser?.id,
        data_atualizacao: new Date().toISOString(),
      };
      if (!editingEpi) payload.data_criacao = new Date().toISOString();

      let saved;
      if (editingEpi) {
        saved = await pb.collection('epis').update(editingEpi.id, payload, { $autoCancel: false });
        await auditLog(AUDIT_ACTIONS.RECORD_UPDATED, AUDIT_MODULES.HR, `EPI atualizado: ${saved.nome || saved.codigo} (${saved.id})`);
        await registrarHistorico({
          funcionario_id: currentUser?.id, epi_id: editingEpi.id,
          tipo_operacao: 'Alteração', data_operacao: todayISO(), hora_operacao: nowTime(),
          descricao: `EPI alterado: ${saved.nome || saved.codigo}`,
          detalhes: JSON.stringify(payload),
        });
        toast.success('EPI atualizado com sucesso');
      } else {
        saved = await pb.collection('epis').create(payload, { $autoCancel: false });
        await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULES.HR, `EPI cadastrado: ${saved.nome || saved.codigo} (${saved.id})`);
        await registrarHistorico({
          funcionario_id: currentUser?.id, epi_id: saved.id,
          tipo_operacao: 'Alteração', data_operacao: todayISO(), hora_operacao: nowTime(),
          descricao: `EPI cadastrado: ${saved.nome || saved.codigo}`,
          detalhes: JSON.stringify(payload),
        });
        toast.success('EPI cadastrado com sucesso');
      }
      setEpiModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erro ao salvar EPI');
    }
  };

  const deleteEpi = async () => {
    if (!deleteTarget) return;
    try {
      await pb.collection('epis').delete(deleteTarget.id, { $autoCancel: false });
      await auditLog(AUDIT_ACTIONS.RECORD_DELETED, AUDIT_MODULES.HR, `EPI excluído: ${deleteTarget.nome || deleteTarget.codigo} (${deleteTarget.id})`);
      await registrarHistorico({
        funcionario_id: currentUser?.id, epi_id: deleteTarget.id,
        tipo_operacao: 'Exclusão', data_operacao: todayISO(), hora_operacao: nowTime(),
        descricao: `EPI excluído: ${deleteTarget.nome || deleteTarget.codigo}`,
        detalhes: JSON.stringify({ codigo: deleteTarget.codigo, nome: deleteTarget.nome }),
      });
      toast.success('EPI excluído');
      setDeleteTarget(null);
    } catch (err) {
      toast.error('Erro ao excluir EPI');
    }
  };

  // -------------------------------------------------------------------------
  // Entrega
  // -------------------------------------------------------------------------
  const emptyEntrega = {
    funcionario_id: '', obra_id: '', setor: '', cargo: '', centro_custo: '',
    data_entrega: todayISO(), hora_entrega: nowTime(), responsavel_id: currentUser?.id || '',
    epi_id: '', quantidade: 1, tamanho: '', ca_utilizado: '', lote: '', validade: '',
    prazo_troca: '', data_prevista_devolucao: '', situacao: 'Entregue',
    assinatura_digital: '', observacoes: '',
  };
  const [entregaForm, setEntregaForm] = useState(emptyEntrega);

  const openEntrega = (epiPre) => {
    setEntregaForm({ ...emptyEntrega, epi_id: epiPre?.id || '', ca_utilizado: epiPre?.numero_ca || '', tamanho: epiPre?.tamanho || '' });
    setEntregaModalOpen(true);
  };

  const saveEntrega = async (e) => {
    e.preventDefault();
    if (!entregaForm.funcionario_id || !entregaForm.epi_id) { toast.error('Selecione funcionário e EPI'); return; }
    try {
      const epi = epis.find((x) => x.id === entregaForm.epi_id);
      const qtd = Number(entregaForm.quantidade || 0);
      if (epi && qtd > Number(epi.quantidade_estoque || 0)) {
        toast.error(`Estoque insuficiente. Disponível: ${epi.quantidade_estoque}`);
        return;
      }
      const numero = await genNumero('epis_entregas', 'EPI-ENT', companyId);
      const payload = {
        ...entregaForm,
        numero_entrega: numero,
        quantidade: qtd,
        responsavel_id: entregaForm.responsavel_id || currentUser?.id,
        validade: entregaForm.validade || null,
        prazo_troca: entregaForm.prazo_troca || null,
        data_prevista_devolucao: entregaForm.data_prevista_devolucao || null,
        company_id: companyId,
        criado_por: currentUser?.id,
        atualizado_por: currentUser?.id,
      };
      const saved = await pb.collection('epis_entregas').create(payload, { $autoCancel: false });
      // Baixa no estoque
      if (epi) {
        await pb.collection('epis').update(epi.id, {
          quantidade_estoque: Number(epi.quantidade_estoque || 0) - qtd,
          atualizado_por: currentUser?.id,
          data_atualizacao: new Date().toISOString(),
        }, { $autoCancel: false });
      }
      await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULES.HR, `Entrega de EPI: ${numero} para funcionário`);
      await registrarHistorico({
        funcionario_id: entregaForm.funcionario_id, epi_id: entregaForm.epi_id,
        tipo_operacao: 'Entrega', data_operacao: entregaForm.data_entrega, hora_operacao: entregaForm.hora_entrega,
        descricao: `Entrega ${numero} - ${epi?.nome || ''} (${qtd} un)`,
        detalhes: entregaForm.observacoes || '',
      });
      toast.success('Entrega registrada com sucesso');
      setEntregaModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erro ao registrar entrega');
    }
  };

  // -------------------------------------------------------------------------
  // Devolução
  // -------------------------------------------------------------------------
  const emptyDevolucao = {
    entrega_id: '', funcionario_id: '', data_devolucao: todayISO(), hora_devolucao: nowTime(),
    responsavel_id: currentUser?.id || '', motivo: '', estado_epi: 'Bom',
    aprovado_reutilizacao: false, descartado: false, necessita_manutencao: false,
    necessita_higienizacao: false, observacoes: '',
  };
  const [devolucaoForm, setDevolucaoForm] = useState(emptyDevolucao);
  const [devolucaoEntrega, setDevolucaoEntrega] = useState(null);

  const openDevolucao = (entrega) => {
    setDevolucaoEntrega(entrega);
    setDevolucaoForm({
      ...emptyDevolucao,
      entrega_id: entrega?.id || '',
      funcionario_id: entrega?.funcionario_id || '',
      responsavel_id: currentUser?.id || '',
    });
    setDevolucaoModalOpen(true);
  };

  const saveDevolucao = async (e) => {
    e.preventDefault();
    if (!devolucaoForm.entrega_id || !devolucaoForm.motivo) { toast.error('Informe a entrega e o motivo'); return; }
    try {
      const numero = await genNumero('epis_devolucoes', 'EPI-DEV', companyId);
      const payload = {
        ...devolucaoForm,
        numero_devolucao: numero,
        responsavel_id: devolucaoForm.responsavel_id || currentUser?.id,
        company_id: companyId,
        criado_por: currentUser?.id,
        atualizado_por: currentUser?.id,
      };
      const saved = await pb.collection('epis_devolucoes').create(payload, { $autoCancel: false });
      // Atualiza situação da entrega
      await pb.collection('epis_entregas').update(devolucaoForm.entrega_id, {
        situacao: 'Devolvido', atualizado_por: currentUser?.id,
      }, { $autoCancel: false });
      // Se aprovado reutilização, devolve ao estoque
      if (devolucaoForm.aprovado_reutilizacao && devolucaoEntrega?.epi_id) {
        const epi = epis.find((x) => x.id === devolucaoEntrega.epi_id);
        if (epi) {
          await pb.collection('epis').update(epi.id, {
            quantidade_estoque: Number(epi.quantidade_estoque || 0) + Number(devolucaoEntrega.quantidade || 1),
            atualizado_por: currentUser?.id, data_atualizacao: new Date().toISOString(),
          }, { $autoCancel: false });
        }
      }
      await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULES.HR, `Devolução de EPI: ${numero}`);
      await registrarHistorico({
        funcionario_id: devolucaoForm.funcionario_id, epi_id: devolucaoEntrega?.epi_id || null,
        tipo_operacao: 'Devolução', data_operacao: devolucaoForm.data_devolucao, hora_operacao: devolucaoForm.hora_devolucao,
        descricao: `Devolução ${numero} - estado: ${devolucaoForm.estado_epi}`,
        detalhes: devolucaoForm.motivo,
      });
      toast.success('Devolução registrada');
      setDevolucaoModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erro ao registrar devolução');
    }
  };

  // -------------------------------------------------------------------------
  // Reposição
  // -------------------------------------------------------------------------
  const emptyReposicao = {
    funcionario_id: '', epi_id: '', tipo_reposicao: 'Troca por desgaste',
    data_reposicao: todayISO(), responsavel_id: currentUser?.id || '',
    quantidade: 1, tamanho: '', motivo: '', observacoes: '',
  };
  const [reposicaoForm, setReposicaoForm] = useState(emptyReposicao);

  const openReposicao = (epiPre) => {
    setReposicaoForm({ ...emptyReposicao, epi_id: epiPre?.id || '', tamanho: epiPre?.tamanho || '', responsavel_id: currentUser?.id || '' });
    setReposicaoModalOpen(true);
  };

  const saveReposicao = async (e) => {
    e.preventDefault();
    if (!reposicaoForm.funcionario_id || !reposicaoForm.epi_id) { toast.error('Selecione funcionário e EPI'); return; }
    try {
      const epi = epis.find((x) => x.id === reposicaoForm.epi_id);
      const qtd = Number(reposicaoForm.quantidade || 0);
      if (epi && qtd > Number(epi.quantidade_estoque || 0)) {
        toast.error(`Estoque insuficiente. Disponível: ${epi.quantidade_estoque}`);
        return;
      }
      const numero = await genNumero('epis_reposicoes', 'EPI-REP', companyId);
      const payload = {
        ...reposicaoForm,
        numero_reposicao: numero,
        quantidade: qtd,
        responsavel_id: reposicaoForm.responsavel_id || currentUser?.id,
        company_id: companyId,
        criado_por: currentUser?.id,
        atualizado_por: currentUser?.id,
      };
      const saved = await pb.collection('epis_reposicoes').create(payload, { $autoCancel: false });
      if (epi) {
        await pb.collection('epis').update(epi.id, {
          quantidade_estoque: Number(epi.quantidade_estoque || 0) - qtd,
          atualizado_por: currentUser?.id, data_atualizacao: new Date().toISOString(),
        }, { $autoCancel: false });
      }
      await auditLog(AUDIT_ACTIONS.RECORD_CREATED, AUDIT_MODULES.HR, `Reposição de EPI: ${numero} - ${reposicaoForm.tipo_reposicao}`);
      await registrarHistorico({
        funcionario_id: reposicaoForm.funcionario_id, epi_id: reposicaoForm.epi_id,
        tipo_operacao: 'Reposição', data_operacao: reposicaoForm.data_reposicao, hora_operacao: nowTime(),
        descricao: `Reposição ${numero} - ${reposicaoForm.tipo_reposicao} (${qtd} un)`,
        detalhes: reposicaoForm.motivo || '',
      });
      toast.success('Reposição registrada');
      setReposicaoModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Erro ao registrar reposição');
    }
  };

  // -------------------------------------------------------------------------
  // Histórico
  // -------------------------------------------------------------------------
  const openHistorico = (epi) => {
    setHistoricoEpi(epi);
    setHistoricoModalOpen(true);
  };
  const historicoFiltrado = useMemo(() => {
    if (!historicoEpi) return historico;
    return historico.filter((h) => h.epi_id === historicoEpi.id);
  }, [historico, historicoEpi]);

  // -------------------------------------------------------------------------
  // Exportações
  // -------------------------------------------------------------------------
  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = filteredEpis.map((e) => ({
        Código: e.codigo, Nome: e.nome, Categoria: e.categoria, Marca: e.marca,
        Modelo: e.modelo, 'Nº CA': e.numero_ca, 'Validade CA': fmtDate(e.validade_ca),
        Estoque: e.quantidade_estoque, 'Estoque Mín.': e.estoque_minimo,
        'Valor Unit.': e.valor_unitario, Status: e.status || 'Ativo',
        Local: e.local_armazenamento, Observações: e.observacoes,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'EPIs');
      XLSX.writeFile(wb, `epis_${todayISO()}.xlsx`);
      await auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULES.HR, `Exportação Excel de EPIs (${rows.length} registros)`);
      toast.success('Excel exportado');
    } catch (err) { toast.error('Erro ao exportar Excel'); }
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF('landscape');
      doc.setFontSize(16);
      doc.text('Relatório de EPIs', 14, 15);
      doc.setFontSize(9);
      doc.text(`Data: ${fmtDateTime(new Date())} | Total: ${filteredEpis.length}`, 14, 22);
      let y = 30;
      doc.text('Cód.   Nome                Categoria        CA         Estoque  Validade CA', 14, y);
      y += 6;
      filteredEpis.forEach((e) => {
        if (y > 200) { doc.addPage(); y = 15; }
        const line = `${(e.codigo || '').padEnd(6)} ${(e.nome || '').slice(0, 18).padEnd(18)} ${(e.categoria || '').slice(0, 15).padEnd(15)} ${(e.numero_ca || '').padEnd(10)} ${String(e.quantidade_estoque || 0).padEnd(8)} ${fmtDate(e.validade_ca)}`;
        doc.text(line, 14, y);
        y += 5;
      });
      doc.save(`epis_${todayISO()}.pdf`);
      await auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULES.HR, `Exportação PDF de EPIs (${filteredEpis.length} registros)`);
      toast.success('PDF exportado');
    } catch (err) { toast.error('Erro ao exportar PDF'); }
  };

  const printReport = () => {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Bloqueador de pop-up ativo'); return; }
    win.document.write(`<html><head><title>Relatório de EPIs</title></head><body style="font-family:sans-serif;font-size:12px">
      <h2>Relatório de EPIs - ${fmtDateTime(new Date())}</h2>
      <table border="1" cellspacing="0" cellpadding="4" width="100%"><thead><tr>
      <th>Código</th><th>Nome</th><th>Categoria</th><th>CA</th><th>Estoque</th><th>Validade CA</th><th>Status</th>
      </tr></thead><tbody>
      ${filteredEpis.map((e) => `<tr><td>${e.codigo || ''}</td><td>${e.nome || ''}</td><td>${e.categoria || ''}</td><td>${e.numero_ca || ''}</td><td>${e.quantidade_estoque || 0}</td><td>${fmtDate(e.validade_ca)}</td><td>${e.status || 'Ativo'}</td></tr>`).join('')}
      </tbody></table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULES.HR, 'Impressão de relatório de EPIs');
  };

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const statusBadge = (s) => {
    const map = {
      'Ativo': 'bg-green-500/10 text-green-700 border-green-500/20',
      'Inativo': 'bg-gray-500/10 text-gray-700 border-gray-500/20',
      'Entregue': 'bg-blue-500/10 text-blue-700 border-blue-500/20',
      'Pendente': 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
      'Devolvido': 'bg-green-500/10 text-green-700 border-green-500/20',
      'Extraviado': 'bg-red-500/10 text-red-700 border-red-500/20',
      'Danificado': 'bg-orange-500/10 text-orange-700 border-orange-500/20',
    };
    return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${map[s] || map['Ativo']}`}>{s || 'Ativo'}</span>;
  };

  const fotoUrl = (rec, field) => {
    if (!rec || !rec[field]) return null;
    try { return pb.files.getURL(rec, rec[field]); } catch (_) { return null; }
  };

  if (!companyId) {
    return (
      <>
        <Helmet><title>Gestão de EPIs - DNM&LTDA</title></Helmet>
        <Header />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
          Acesso negado. Usuário sem empresa vinculada.
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Gestão de EPIs - DNM&LTDA</title>
        <meta name="description" content="Sistema completo de gestão de EPIs: cadastro, entrega, devolução, reposição, validade, CA, assinatura digital e auditoria." />
      </Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container">
          {/* Cabeçalho */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-1">Gestão de EPIs</h1>
              <p className="text-muted-foreground">Controle completo de Equipamentos de Proteção Individual</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadAll} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
              {canManage && (
                <>
                  <Button variant="outline" onClick={() => openEntrega(null)}>
                    <ArrowDownToLine className="w-4 h-4 mr-2" /> Entrega
                  </Button>
                  <Button variant="outline" onClick={() => openReposicao(null)}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Reposição
                  </Button>
                  <Button onClick={openNewEpi}>
                    <Plus className="w-4 h-4 mr-2" /> Novo EPI
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
              <TabsTrigger value="dashboard"><TrendingUp className="w-4 h-4 mr-1 inline" /> Dashboard</TabsTrigger>
              <TabsTrigger value="epis"><HardHat className="w-4 h-4 mr-1 inline" /> EPIs</TabsTrigger>
              <TabsTrigger value="entregas"><ArrowDownToLine className="w-4 h-4 mr-1 inline" /> Entregas</TabsTrigger>
              <TabsTrigger value="alertas"><AlertTriangle className="w-4 h-4 mr-1 inline" /> Alertas</TabsTrigger>
            </TabsList>

            {/* ---------------- Dashboard ---------------- */}
            <TabsContent value="dashboard" className="space-y-6">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <Card className="shadow-sm"><CardContent className="p-4">
                      <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Total EPIs</p><h3 className="text-2xl font-bold text-primary">{kpis.totalEpis}</h3></div><HardHat className="w-8 h-8 text-primary/30" /></div>
                    </CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-4">
                      <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Entregues</p><h3 className="text-2xl font-bold text-blue-600">{kpis.entregues}</h3></div><ArrowDownToLine className="w-8 h-8 text-blue-600/30" /></div>
                    </CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-4">
                      <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Em Estoque</p><h3 className="text-2xl font-bold text-green-600">{kpis.disponivelEstoque}</h3></div><Boxes className="w-8 h-8 text-green-600/30" /></div>
                    </CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-4">
                      <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Atrasos</p><h3 className="text-2xl font-bold text-red-600">{kpis.atraso}</h3></div><Clock className="w-8 h-8 text-red-600/30" /></div>
                    </CardContent></Card>
                    <Card className="shadow-sm"><CardContent className="p-4">
                      <div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground uppercase">Valor Estoque</p><h3 className="text-lg font-bold text-accent">{fmtCurrency(kpis.valorEstoque)}</h3></div><TrendingUp className="w-8 h-8 text-accent/30" /></div>
                    </CardContent></Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="shadow-sm"><CardHeader><CardTitle className="text-primary text-base">EPIs por Categoria</CardTitle></CardHeader>
                      <CardContent className="h-72">
                        {chartCategoria.length === 0 ? <EmptyChart /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={chartCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                              {chartCategoria.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie><Tooltip /><Legend /></PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm"><CardHeader><CardTitle className="text-primary text-base">Entregas por Situação</CardTitle></CardHeader>
                      <CardContent className="h-72">
                        {chartSituacao.length === 0 ? <EmptyChart /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={chartSituacao} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                              {chartSituacao.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie><Tooltip /><Legend /></PieChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm"><CardHeader><CardTitle className="text-primary text-base">Entregas por Funcionário</CardTitle></CardHeader>
                      <CardContent className="h-72">
                        {chartPorFuncionario.length === 0 ? <EmptyChart /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartPorFuncionario}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#1a3a52" radius={[6,6,0,0]} /></BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm"><CardHeader><CardTitle className="text-primary text-base">Entregas por Obra</CardTitle></CardHeader>
                      <CardContent className="h-72">
                        {chartPorObra.length === 0 ? <EmptyChart /> : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartPorObra}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#d4af37" radius={[6,6,0,0]} /></BarChart>
                          </ResponsiveContainer>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Últimas entregas e devoluções */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="shadow-sm"><CardHeader><CardTitle className="text-primary text-base">Últimas Entregas</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="h-64">
                          {entregas.slice(0, 8).length === 0 ? <EmptyRow text="Nenhuma entrega" /> : (
                            <div className="divide-y">
                              {entregas.slice(0, 8).map((e) => (
                                <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                  <div><p className="font-medium">{e.expand?.funcionario_id?.nome_completo || 'Funcionário'}</p><p className="text-xs text-muted-foreground">{e.expand?.epi_id?.nome || ''} • {e.numero_entrega}</p></div>
                                  <div className="text-right"><p className="text-xs">{fmtDate(e.data_entrega)}</p>{statusBadge(e.situacao)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                    <Card className="shadow-sm"><CardHeader><CardTitle className="text-primary text-base">Últimas Devoluções</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="h-64">
                          {devolucoes.slice(0, 8).length === 0 ? <EmptyRow text="Nenhuma devolução" /> : (
                            <div className="divide-y">
                              {devolucoes.slice(0, 8).map((d) => (
                                <div key={d.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                                  <div><p className="font-medium">{d.expand?.funcionario_id?.nome_completo || 'Funcionário'}</p><p className="text-xs text-muted-foreground">{d.numero_devolucao} • {d.estado_epi}</p></div>
                                  <p className="text-xs">{fmtDate(d.data_devolucao)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ---------------- EPIs ---------------- */}
            <TabsContent value="epis" className="space-y-4">
              {/* Filtros */}
              <Card className="shadow-sm"><CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                  <div className="lg:col-span-2 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Buscar nome, código, CA, categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                  </div>
                  <Select value={fCategoria} onValueChange={setFCategoria}>
                    <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todas categorias</SelectItem>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={fFornecedor} onValueChange={setFFornecedor}>
                    <SelectTrigger><SelectValue placeholder="Fornecedor" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos fornecedores</SelectItem>{fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome || f.nome_fantasia || f.id}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={fSituacao} onValueChange={setFSituacao}>
                    <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todas situações</SelectItem>{SITUACOES_ENTREGA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={fStatus} onValueChange={setFStatus}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Todos status</SelectItem>{STATUS_EPI.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={exportPDF}><FileText className="w-4 h-4 mr-1" /> PDF</Button>
                  <Button variant="outline" size="sm" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
                  <Button variant="outline" size="sm" onClick={printReport}><Printer className="w-4 h-4 mr-1" /> Imprimir</Button>
                </div>
              </CardContent></Card>

              {/* Tabela */}
              <Card className="shadow-sm"><CardContent className="p-0">
                {loading ? (
                  <div className="p-4 space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Categoria</TableHead>
                          <TableHead>CA</TableHead><TableHead>Validade CA</TableHead><TableHead>Estoque</TableHead>
                          <TableHead>Valor Unit.</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEpis.length === 0 ? (
                          <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum EPI encontrado</TableCell></TableRow>
                        ) : filteredEpis.map((e) => {
                          const caVencido = e.validade_ca && new Date(e.validade_ca) < new Date();
                          const caVencendo = e.validade_ca && !caVencido && new Date(e.validade_ca) <= new Date(Date.now() + 30*86400000);
                          const baixo = Number(e.estoque_minimo || 0) > 0 && Number(e.quantidade_estoque || 0) <= Number(e.estoque_minimo || 0);
                          return (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium">{e.codigo}</TableCell>
                              <TableCell>{e.nome}</TableCell>
                              <TableCell><Badge variant="outline">{e.categoria}</Badge></TableCell>
                              <TableCell>{e.numero_ca || '-'}</TableCell>
                              <TableCell>
                                <span className={caVencido ? 'text-red-600 font-semibold' : caVencendo ? 'text-yellow-600 font-semibold' : ''}>{fmtDate(e.validade_ca)}</span>
                              </TableCell>
                              <TableCell>
                                <span className={baixo ? 'text-red-600 font-semibold' : ''}>{e.quantidade_estoque || 0}</span>
                                {baixo && <AlertTriangle className="w-3 h-3 inline ml-1 text-red-600" />}
                              </TableCell>
                              <TableCell>{fmtCurrency(e.valor_unitario)}</TableCell>
                              <TableCell>{statusBadge(e.status || 'Ativo')}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="ghost" title="Detalhes" onClick={() => setDetalhesEpi(e)}><Eye className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" title="Histórico" onClick={() => openHistorico(e)}><History className="w-4 h-4" /></Button>
                                  {canManage && <Button size="sm" variant="ghost" title="Entregar" onClick={() => openEntrega(e)}><ArrowDownToLine className="w-4 h-4" /></Button>}
                                  {canManage && <Button size="sm" variant="ghost" title="Reposição" onClick={() => openReposicao(e)}><RefreshCw className="w-4 h-4" /></Button>}
                                  {canManage && <Button size="sm" variant="ghost" title="Editar" onClick={() => openEditEpi(e)}><Pencil className="w-4 h-4" /></Button>}
                                  {canDelete && <Button size="sm" variant="ghost" className="text-destructive" title="Excluir" onClick={() => setDeleteTarget(e)}><Trash2 className="w-4 h-4" /></Button>}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent></Card>
            </TabsContent>

            {/* ---------------- Entregas ---------------- */}
            <TabsContent value="entregas" className="space-y-4">
              <Card className="shadow-sm"><CardContent className="p-0">
                {loading ? <div className="p-4 space-y-2">{[1,2,3,4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50"><TableRow>
                        <TableHead>Nº</TableHead><TableHead>Funcionário</TableHead><TableHead>EPI</TableHead>
                        <TableHead>Qtd</TableHead><TableHead>Data</TableHead><TableHead>Prazo Troca</TableHead>
                        <TableHead>Situação</TableHead><TableHead className="text-right">Ações</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {entregas.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma entrega registrada</TableCell></TableRow> :
                          entregas.map((e) => (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium">{e.numero_entrega}</TableCell>
                              <TableCell>{e.expand?.funcionario_id?.nome_completo || '—'}</TableCell>
                              <TableCell>{e.expand?.epi_id?.nome || '—'}</TableCell>
                              <TableCell>{e.quantidade}</TableCell>
                              <TableCell>{fmtDate(e.data_entrega)}</TableCell>
                              <TableCell>{fmtDate(e.prazo_troca)}</TableCell>
                              <TableCell>{statusBadge(e.situacao)}</TableCell>
                              <TableCell className="text-right">
                                {canManage && e.situacao !== 'Devolvido' && (
                                  <Button size="sm" variant="ghost" title="Registrar devolução" onClick={() => openDevolucao(e)}><ArrowUpFromLine className="w-4 h-4" /></Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent></Card>
            </TabsContent>

            {/* ---------------- Alertas ---------------- */}
            <TabsContent value="alertas" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AlertCard title="CA Vencendo (30 dias)" icon={<Clock className="w-5 h-5 text-yellow-600" />} items={alertas.caVencendo.map((e) => `${e.nome} (${e.codigo}) - vence ${fmtDate(e.validade_ca)}`)} color="yellow" />
                <AlertCard title="CA Vencido" icon={<AlertTriangle className="w-5 h-5 text-red-600" />} items={alertas.caVencido.map((e) => `${e.nome} (${e.codigo}) - venceu ${fmtDate(e.validade_ca)}`)} color="red" />
                <AlertCard title="Estoque Baixo" icon={<Boxes className="w-5 h-5 text-orange-600" />} items={alertas.estoqueBaixo.map((e) => `${e.nome} (${e.codigo}) - ${e.quantidade_estoque}/${e.estoque_minimo}`)} color="orange" />
                <AlertCard title="Entregas Pendentes" icon={<ArrowDownToLine className="w-5 h-5 text-yellow-600" />} items={alertas.entregasPendentes.map((e) => `${e.numero_entrega} - ${e.expand?.funcionario_id?.nome_completo || ''}`)} color="yellow" />
                <AlertCard title="Troca Obrigatória (prazo vencido)" icon={<RefreshCw className="w-5 h-5 text-red-600" />} items={alertas.trocaObrigatoria.map((e) => `${e.numero_entrega} - prazo ${fmtDate(e.prazo_troca)}`)} color="red" />
                <AlertCard title="Funcionários sem EPI" icon={<HardHat className="w-5 h-5 text-orange-600" />} items={alertas.funcsSemEpi.map((f) => f.nome_completo || f.nome || f.id)} color="orange" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* ---------------- Modal CRUD EPI ---------------- */}
      <Dialog open={epiModalOpen} onOpenChange={setEpiModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingEpi ? 'Editar EPI' : 'Novo EPI'}</DialogTitle></DialogHeader>
          <form onSubmit={saveEpi} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Código *</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Categoria *</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Fornecedor</Label>
                <Select value={form.fornecedor_id || 'none'} onValueChange={(v) => setForm({ ...form, fornecedor_id: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome || f.nome_fantasia || f.id}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Fabricante</Label><Input value={form.fabricante} onChange={(e) => setForm({ ...form, fabricante: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Nº CA</Label><Input value={form.numero_ca} onChange={(e) => setForm({ ...form, numero_ca: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Validade CA</Label><Input type="date" value={form.validade_ca} onChange={(e) => setForm({ ...form, validade_ca: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Norma Regulamentadora</Label><Input value={form.norma_regulamentadora} onChange={(e) => setForm({ ...form, norma_regulamentadora: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Tamanho</Label><Input value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Cor</Label><Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Material</Label><Input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5"><Label>Qtd. Estoque *</Label><Input type="number" min="0" value={form.quantidade_estoque} onChange={(e) => setForm({ ...form, quantidade_estoque: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Estoque Mín.</Label><Input type="number" min="0" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Unidade</Label><Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_EPI.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Valor Unitário</Label><Input type="number" min="0" step="0.01" value={form.valor_unitario} onChange={(e) => setForm({ ...form, valor_unitario: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Valor Médio</Label><Input type="number" min="0" step="0.01" value={form.valor_medio} onChange={(e) => setForm({ ...form, valor_medio: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Local Armazenamento</Label><Input value={form.local_armazenamento} onChange={(e) => setForm({ ...form, local_armazenamento: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} /></div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEpiModalOpen(false)}>Cancelar</Button>
              <Button type="submit"><Save className="w-4 h-4 mr-2" /> {editingEpi ? 'Atualizar' : 'Cadastrar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------- Modal Entrega ---------------- */}
      <Dialog open={entregaModalOpen} onOpenChange={setEntregaModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Entrega de EPI</DialogTitle></DialogHeader>
          <form onSubmit={saveEntrega} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Funcionário *</Label>
                <Select value={entregaForm.funcionario_id || 'none'} onValueChange={(v) => {
                  const f = funcionarios.find((x) => x.id === v);
                  setEntregaForm({ ...entregaForm, funcionario_id: v === 'none' ? '' : v, cargo: f?.cargo || f?.funcao || '', setor: f?.setor || '' });
                }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">Selecione</SelectItem>{funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome_completo || f.nome || f.id}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>EPI *</Label>
                <Select value={entregaForm.epi_id || 'none'} onValueChange={(v) => {
                  const epi = epis.find((x) => x.id === v);
                  setEntregaForm({ ...entregaForm, epi_id: v === 'none' ? '' : v, ca_utilizado: epi?.numero_ca || '', tamanho: epi?.tamanho || '' });
                }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">Selecione</SelectItem>{epis.map((e) => <SelectItem key={e.id} value={e.id}>{e.codigo} - {e.nome} (Estoque: {e.quantidade_estoque})</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Obra</Label>
                <Select value={entregaForm.obra_id || 'none'} onValueChange={(v) => setEntregaForm({ ...entregaForm, obra_id: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma</SelectItem>{obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome || o.nome_obra || o.id}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Setor</Label><Input value={entregaForm.setor} onChange={(e) => setEntregaForm({ ...entregaForm, setor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Cargo</Label><Input value={entregaForm.cargo} onChange={(e) => setEntregaForm({ ...entregaForm, cargo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5"><Label>Data Entrega *</Label><Input type="date" value={entregaForm.data_entrega} onChange={(e) => setEntregaForm({ ...entregaForm, data_entrega: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Hora *</Label><Input type="time" value={entregaForm.hora_entrega} onChange={(e) => setEntregaForm({ ...entregaForm, hora_entrega: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Quantidade *</Label><Input type="number" min="1" value={entregaForm.quantidade} onChange={(e) => setEntregaForm({ ...entregaForm, quantidade: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Situação</Label>
                <Select value={entregaForm.situacao} onValueChange={(v) => setEntregaForm({ ...entregaForm, situacao: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SITUACOES_ENTREGA.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5"><Label>Tamanho</Label><Input value={entregaForm.tamanho} onChange={(e) => setEntregaForm({ ...entregaForm, tamanho: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>CA Utilizado</Label><Input value={entregaForm.ca_utilizado} onChange={(e) => setEntregaForm({ ...entregaForm, ca_utilizado: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Lote</Label><Input value={entregaForm.lote} onChange={(e) => setEntregaForm({ ...entregaForm, lote: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Validade</Label><Input type="date" value={entregaForm.validade} onChange={(e) => setEntregaForm({ ...entregaForm, validade: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Prazo de Troca</Label><Input type="date" value={entregaForm.prazo_troca} onChange={(e) => setEntregaForm({ ...entregaForm, prazo_troca: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Devolução Prevista</Label><Input type="date" value={entregaForm.data_prevista_devolucao} onChange={(e) => setEntregaForm({ ...entregaForm, data_prevista_devolucao: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={entregaForm.observacoes} onChange={(e) => setEntregaForm({ ...entregaForm, observacoes: e.target.value })} rows={2} /></div>
            <SignaturePad value={entregaForm.assinatura_digital} onChange={(v) => setEntregaForm({ ...entregaForm, assinatura_digital: v })} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEntregaModalOpen(false)}>Cancelar</Button>
              <Button type="submit"><ArrowDownToLine className="w-4 h-4 mr-2" /> Registrar Entrega</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------- Modal Devolução ---------------- */}
      <Dialog open={devolucaoModalOpen} onOpenChange={setDevolucaoModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Devolução de EPI</DialogTitle></DialogHeader>
          <form onSubmit={saveDevolucao} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Data Devolução *</Label><Input type="date" value={devolucaoForm.data_devolucao} onChange={(e) => setDevolucaoForm({ ...devolucaoForm, data_devolucao: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Hora *</Label><Input type="time" value={devolucaoForm.hora_devolucao} onChange={(e) => setDevolucaoForm({ ...devolucaoForm, hora_devolucao: e.target.value })} required /></div>
            </div>
            <div className="space-y-1.5"><Label>Estado do EPI *</Label>
              <Select value={devolucaoForm.estado_epi} onValueChange={(v) => setDevolucaoForm({ ...devolucaoForm, estado_epi: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ESTADOS_EPI.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Motivo *</Label><Textarea value={devolucaoForm.motivo} onChange={(e) => setDevolucaoForm({ ...devolucaoForm, motivo: e.target.value })} required rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={devolucaoForm.aprovado_reutilizacao} onCheckedChange={(v) => setDevolucaoForm({ ...devolucaoForm, aprovado_reutilizacao: !!v })} /> Aprovado p/ reutilização</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={devolucaoForm.descartado} onCheckedChange={(v) => setDevolucaoForm({ ...devolucaoForm, descartado: !!v })} /> Descartado</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={devolucaoForm.necessita_manutencao} onCheckedChange={(v) => setDevolucaoForm({ ...devolucaoForm, necessita_manutencao: !!v })} /> Necessita manutenção</label>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={devolucaoForm.necessita_higienizacao} onCheckedChange={(v) => setDevolucaoForm({ ...devolucaoForm, necessita_higienizacao: !!v })} /> Necessita higienização</label>
            </div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={devolucaoForm.observacoes} onChange={(e) => setDevolucaoForm({ ...devolucaoForm, observacoes: e.target.value })} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDevolucaoModalOpen(false)}>Cancelar</Button>
              <Button type="submit"><ArrowUpFromLine className="w-4 h-4 mr-2" /> Registrar Devolução</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------- Modal Reposição ---------------- */}
      <Dialog open={reposicaoModalOpen} onOpenChange={setReposicaoModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Reposição de EPI</DialogTitle></DialogHeader>
          <form onSubmit={saveReposicao} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Funcionário *</Label>
                <Select value={reposicaoForm.funcionario_id || 'none'} onValueChange={(v) => setReposicaoForm({ ...reposicaoForm, funcionario_id: v === 'none' ? '' : v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">Selecione</SelectItem>{funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome_completo || f.nome || f.id}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>EPI *</Label>
                <Select value={reposicaoForm.epi_id || 'none'} onValueChange={(v) => { const epi = epis.find((x) => x.id === v); setReposicaoForm({ ...reposicaoForm, epi_id: v === 'none' ? '' : v, tamanho: epi?.tamanho || '' }); }}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">Selecione</SelectItem>{epis.map((e) => <SelectItem key={e.id} value={e.id}>{e.codigo} - {e.nome} (Estoque: {e.quantidade_estoque})</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Tipo de Reposição *</Label>
                <Select value={reposicaoForm.tipo_reposicao} onValueChange={(v) => setReposicaoForm({ ...reposicaoForm, tipo_reposicao: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS_REPOSICAO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Data *</Label><Input type="date" value={reposicaoForm.data_reposicao} onChange={(e) => setReposicaoForm({ ...reposicaoForm, data_reposicao: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>Quantidade *</Label><Input type="number" min="1" value={reposicaoForm.quantidade} onChange={(e) => setReposicaoForm({ ...reposicaoForm, quantidade: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Tamanho</Label><Input value={reposicaoForm.tamanho} onChange={(e) => setReposicaoForm({ ...reposicaoForm, tamanho: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Motivo</Label><Input value={reposicaoForm.motivo} onChange={(e) => setReposicaoForm({ ...reposicaoForm, motivo: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Observações</Label><Textarea value={reposicaoForm.observacoes} onChange={(e) => setReposicaoForm({ ...reposicaoForm, observacoes: e.target.value })} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReposicaoModalOpen(false)}>Cancelar</Button>
              <Button type="submit"><RefreshCw className="w-4 h-4 mr-2" /> Registrar Reposição</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------- Modal Detalhes ---------------- */}
      <Dialog open={!!detalhesEpi} onOpenChange={(o) => !o && setDetalhesEpi(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalhes do EPI</DialogTitle></DialogHeader>
          {detalhesEpi && (
            <div className="space-y-3 text-sm">
              {fotoUrl(detalhesEpi, 'foto') && <img src={fotoUrl(detalhesEpi, 'foto')} alt={detalhesEpi.nome} className="w-full h-40 object-cover rounded-lg" />}
              <div className="grid grid-cols-2 gap-2">
                <Detail label="Código" value={detalhesEpi.codigo} />
                <Detail label="Nome" value={detalhesEpi.nome} />
                <Detail label="Categoria" value={detalhesEpi.categoria} />
                <Detail label="Marca" value={detalhesEpi.marca} />
                <Detail label="Modelo" value={detalhesEpi.modelo} />
                <Detail label="Fabricante" value={detalhesEpi.fabricante} />
                <Detail label="Nº CA" value={detalhesEpi.numero_ca} />
                <Detail label="Validade CA" value={fmtDate(detalhesEpi.validade_ca)} />
                <Detail label="Norma" value={detalhesEpi.norma_regulamentadora} />
                <Detail label="Tamanho" value={detalhesEpi.tamanho} />
                <Detail label="Cor" value={detalhesEpi.cor} />
                <Detail label="Material" value={detalhesEpi.material} />
                <Detail label="Estoque" value={detalhesEpi.quantidade_estoque} />
                <Detail label="Estoque Mín." value={detalhesEpi.estoque_minimo} />
                <Detail label="Unidade" value={detalhesEpi.unidade} />
                <Detail label="Valor Unit." value={fmtCurrency(detalhesEpi.valor_unitario)} />
                <Detail label="Valor Médio" value={fmtCurrency(detalhesEpi.valor_medio)} />
                <Detail label="Local" value={detalhesEpi.local_armazenamento} />
                <Detail label="Status" value={detalhesEpi.status || 'Ativo'} />
              </div>
              {detalhesEpi.descricao && <div><p className="font-semibold text-primary">Descrição</p><p className="text-muted-foreground">{detalhesEpi.descricao}</p></div>}
              {detalhesEpi.observacoes && <div><p className="font-semibold text-primary">Observações</p><p className="text-muted-foreground">{detalhesEpi.observacoes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------------- Modal Histórico ---------------- */}
      <Dialog open={historicoModalOpen} onOpenChange={setHistoricoModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico {historicoEpi ? `- ${historicoEpi.nome}` : ''}</DialogTitle></DialogHeader>
          <ScrollArea className="h-96">
            {historicoFiltrado.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhum histórico registrado</p> : (
              <div className="space-y-2">
                {historicoFiltrado.map((h) => (
                  <div key={h.id} className="border rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{h.tipo_operacao}</Badge>
                      <span className="text-xs text-muted-foreground">{fmtDate(h.data_operacao)} {h.hora_operacao}</span>
                    </div>
                    <p className="mt-1.5 font-medium">{h.descricao}</p>
                    {h.detalhes && <p className="text-xs text-muted-foreground mt-1">{h.detalhes}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Por: {h.expand?.usuario_id?.name || h.expand?.usuario_id?.email || 'Sistema'}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ---------------- Confirmação Exclusão ---------------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir EPI</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir o EPI "{deleteTarget?.nome}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteEpi}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ---------------------------------------------------------------------------
// Subcomponentes auxiliares
// ---------------------------------------------------------------------------
const EmptyChart = () => (
  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
);
const EmptyRow = ({ text }) => (
  <div className="text-center text-muted-foreground text-sm py-8">{text}</div>
);
const Detail = ({ label, value }) => (
  <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value || '-'}</p></div>
);
const AlertCard = ({ title, icon, items, color }) => {
  const colorMap = {
    yellow: 'border-yellow-500/30 bg-yellow-500/5',
    red: 'border-red-500/30 bg-red-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5',
  };
  return (
    <Card className={`shadow-sm ${colorMap[color] || ''}`}>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">{icon} {title} ({items.length})</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? <p className="text-sm text-muted-foreground py-2">Nenhum alerta</p> : (
          <ScrollArea className="h-40">
            <ul className="space-y-1.5 text-sm">
              {items.map((it, i) => <li key={i} className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0" />{it}</li>)}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default EPIsPage;
