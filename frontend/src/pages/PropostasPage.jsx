import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  FileText,
  Eye,
  Send,
  ChevronLeft,
  ChevronRight,
  Mail,
  Download,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { mensagemErro } from '@/lib/erros.js';

const AUDIT_MODULE = 'Propostas';
const PER_PAGE = 10;

const STATUS_VALUES = ['Rascunho', 'Enviada', 'Aceita', 'Rejeitada', 'Expirada'];
const STATUS_LABELS = {
  Rascunho: 'Rascunho',
  Enviada: 'Enviada',
  Aceita: 'Aceita',
  Rejeitada: 'Rejeitada',
  Expirada: 'Expirada',
};

const statusColor = (status) => {
  switch (status) {
    case 'Aceita':
      return 'bg-green-500/10 text-green-700 border-green-500/20';
    case 'Rejeitada':
      return 'bg-red-500/10 text-red-700 border-red-500/20';
    case 'Enviada':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
    case 'Expirada':
      return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
    default:
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  }
};

// Status que bloqueiam edição dos dados da proposta.
const LOCKED_STATUS = ['Aceita', 'Rejeitada'];

const formatCurrency = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (d) => {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const todayISO = () => new Date().toISOString().split('T')[0];

const emptyItem = () => ({
  material_id: '',
  quantidade: '',
  preco_unitario: '',
  subtotal: 0,
});

const emptyForm = {
  cliente_id: '',
  data_proposta: todayISO(),
  data_validade: '',
  status: 'Rascunho',
  descricao: '',
  desconto: '0',
  desconto_percentual: '0',
  condicoes_pagamento: '',
  observacoes: '',
  itens: [emptyItem()],
};

const PropostasPage = () => {
  const { currentUser } = useAuth();
  const companyId = currentUser?.company_id;

  const [propostas, setPropostas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [materiais, setMateriais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState(null);

  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState(null);
  const [emailData, setEmailData] = useState({ destinatario: '', assunto: '', mensagem: '' });

  const buildFilter = useCallback(() => {
    if (!companyId) return '';
    const parts = [`company_id = "${companyId}"`];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().replace(/"/g, '\\"');
      parts.push(`(numero_proposta ~ "${q}" || descricao ~ "${q}")`);
    }
    if (filterStatus !== 'all') parts.push(`status = "${filterStatus}"`);
    if (filterDateFrom) parts.push(`data_proposta >= "${filterDateFrom}"`);
    if (filterDateTo) parts.push(`data_proposta <= "${filterDateTo}"`);
    return parts.join(' && ');
  }, [companyId, searchQuery, filterStatus, filterDateFrom, filterDateTo]);

  const fetchClientes = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await pb.collection('clientes').getFullList({
        filter: `company_id = "${companyId}"`,
        sort: 'nome',
        $autoCancel: false,
      });
      setClientes(data);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  }, [companyId]);

  const fetchMateriais = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await pb.collection('materiais').getFullList({
        filter: `company_id = "${companyId}"`,
        sort: 'name',
        $autoCancel: false,
      });
      setMateriais(data);
    } catch (err) {
      console.error('Erro ao carregar materiais:', err);
    }
  }, [companyId]);

  const fetchPropostas = useCallback(
    async (p = 1) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(false);
      try {
        const result = await pb.collection('propostas').getList(p, PER_PAGE, {
          filter: buildFilter(),
          sort: '-created',
          expand: 'cliente_id,criado_por,atualizado_por',
          $autoCancel: false,
        });
        setPropostas(result.items);
        setTotalItems(result.totalItems);
        setTotalPages(result.totalPages);
        setPage(p);
      } catch (err) {
        console.error('Erro ao carregar propostas:', err);
        setError(true);
        toast.error('Erro ao carregar propostas');
      } finally {
        setLoading(false);
      }
    },
    [companyId, buildFilter],
  );

  useEffect(() => {
    if (companyId) {
      fetchClientes();
      fetchMateriais();
      const t = setTimeout(() => fetchPropostas(1), 350);
      return () => clearTimeout(t);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, searchQuery, filterStatus, filterDateFrom, filterDateTo]);

  // ---------- Cálculos automáticos ----------
  const valorTotal = useMemo(() => {
    return formData.itens.reduce((sum, it) => {
      const q = Number(it.quantidade || 0);
      const pu = Number(it.preco_unitario || 0);
      return sum + q * pu;
    }, 0);
  }, [formData.itens]);

  const valorFinal = useMemo(() => {
    const descPct = Number(formData.desconto_percentual || 0);
    const descVal = Number(formData.desconto || 0);
    const fromPct = valorTotal * (descPct / 100);
    const final = valorTotal - fromPct - descVal;
    return final > 0 ? final : 0;
  }, [valorTotal, formData.desconto, formData.desconto_percentual]);

  // ---------- Geração automática do número da proposta ----------
  const generateNumeroProposta = useCallback(async () => {
    if (!companyId) return `PROP-${new Date().getFullYear()}-0001`;
    try {
      const year = new Date().getFullYear();
      const result = await pb.collection('propostas').getList(1, 1, {
        filter: `company_id = "${companyId}" && numero_proposta ~ "PROP-${year}-"`,
        sort: '-numero_proposta',
        $autoCancel: false,
      });
      let next = 1;
      if (result.items.length > 0) {
        const last = result.items[0].numero_proposta || '';
        const match = last.match(/PROP-\d{4}-(\d+)$/);
        if (match) next = parseInt(match[1], 10) + 1;
      }
      return `PROP-${year}-${String(next).padStart(4, '0')}`;
    } catch (e) {
      return `PROP-${new Date().getFullYear()}-0001`;
    }
  }, [companyId]);

  // ---------- Itens ----------
  const addItem = () => {
    setFormData((p) => ({ ...p, itens: [...p.itens, emptyItem()] }));
  };

  const removeItem = (idx) => {
    setFormData((p) => ({
      ...p,
      itens: p.itens.filter((_, i) => i !== idx),
    }));
  };

  const updateItem = (idx, field, value) => {
    setFormData((p) => ({
      ...p,
      itens: p.itens.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, [field]: value };
        // Ao selecionar um material, preenche preço unitário automaticamente
        if (field === 'material_id') {
          const mat = materiais.find((m) => m.id === value);
          if (mat) {
            next.preco_unitario = String(mat.unit_cost ?? '');
          }
        }
        const q = Number(next.quantidade || 0);
        const pu = Number(next.preco_unitario || 0);
        next.subtotal = q * pu;
        return next;
      }),
    }));
  };

  // ---------- Validação ----------
  const validateForm = () => {
    const errs = {};
    if (!formData.cliente_id) errs.cliente_id = 'Cliente é obrigatório';
    if (!formData.data_proposta) errs.data_proposta = 'Data da proposta é obrigatória';
    if (!formData.data_validade) errs.data_validade = 'Data de validade é obrigatória';
    if (formData.data_proposta && formData.data_validade) {
      if (new Date(formData.data_validade) <= new Date(formData.data_proposta)) {
        errs.data_validade = 'A validade deve ser posterior à data da proposta';
      }
    }

    const desc = Number(formData.desconto || 0);
    const descPct = Number(formData.desconto_percentual || 0);
    if (Number.isNaN(desc) || desc < 0) errs.desconto = 'Desconto inválido';
    if (Number.isNaN(descPct) || descPct < 0 || descPct > 100)
      errs.desconto_percentual = 'Desconto percentual inválido (0-100)';

    // Itens: pelo menos 1 item válido
    const validItens = formData.itens.filter(
      (it) => it.material_id && Number(it.quantidade) > 0,
    );
    if (validItens.length === 0) {
      errs.itens = 'Adicione ao menos um item com material e quantidade';
    }
    formData.itens.forEach((it, i) => {
      if (it.material_id) {
        if (!it.quantidade || Number(it.quantidade) <= 0) {
          errs[`item_${i}_quantidade`] = 'Quantidade inválida';
        }
        if (!it.preco_unitario || Number(it.preco_unitario) < 0) {
          errs[`item_${i}_preco`] = 'Preço inválido';
        }
      }
    });

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ---------- Submit ----------
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!companyId) {
      toast.error('Empresa não identificada');
      return;
    }
    setSaving(true);
    try {
      if (!validateForm()) {
        setSaving(false);
        return;
      }

      const itensClean = formData.itens
        .filter((it) => it.material_id && Number(it.quantidade) > 0)
        .map((it) => ({
          material_id: it.material_id,
          quantidade: Number(it.quantidade),
          preco_unitario: Number(it.preco_unitario),
          subtotal: Number(it.quantidade) * Number(it.preco_unitario),
        }));

      const payload = {
        cliente_id: formData.cliente_id,
        data_proposta: formData.data_proposta,
        data_validade: formData.data_validade,
        status: formData.status,
        descricao: formData.descricao.trim() || null,
        valor_total: Number(valorTotal.toFixed(2)),
        desconto: Number(formData.desconto || 0),
        desconto_percentual: Number(formData.desconto_percentual || 0),
        valor_final: Number(valorFinal.toFixed(2)),
        condicoes_pagamento: formData.condicoes_pagamento.trim() || null,
        observacoes: formData.observacoes.trim() || null,
        itens: itensClean,
        company_id: companyId,
        atualizado_por: currentUser.id,
      };

      if (editing) {
        const updated = await pb.collection('propostas').update(editing.id, payload, {
          $autoCancel: false,
        });
        toast.success('Proposta atualizada com sucesso');
        await auditLog(
          AUDIT_ACTIONS.RECORD_UPDATED,
          AUDIT_MODULE,
          `Proposta atualizada: ${updated.numero_proposta}`,
        );
      } else {
        const numero = await generateNumeroProposta();
        const created = await pb.collection('propostas').create(
          {
            ...payload,
            numero_proposta: numero,
            criado_por: currentUser.id,
          },
          { $autoCancel: false },
        );
        toast.success(`Proposta ${numero} cadastrada com sucesso`);
        await auditLog(
          AUDIT_ACTIONS.RECORD_CREATED,
          AUDIT_MODULE,
          `Proposta criada: ${created.numero_proposta}`,
        );
      }

      setDialogOpen(false);
      resetForm();
      fetchPropostas(page);
    } catch (err) {
      console.error('Erro ao salvar proposta:', err);
      const msg = mensagemErro(err, 'Erro ao salvar proposta');
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (proposta) => {
    if (LOCKED_STATUS.includes(proposta.status)) {
      toast.error(`Propostas com status "${proposta.status}" não podem ser editadas`);
      return;
    }
    setEditing(proposta);
    const itens =
      Array.isArray(proposta.itens) && proposta.itens.length > 0
        ? proposta.itens.map((it) => ({
            material_id: it.material_id || '',
            quantidade: String(it.quantidade ?? ''),
            preco_unitario: String(it.preco_unitario ?? ''),
            subtotal: Number(it.quantidade || 0) * Number(it.preco_unitario || 0),
          }))
        : [emptyItem()];
    setFormData({
      cliente_id: proposta.cliente_id || '',
      data_proposta: proposta.data_proposta ? proposta.data_proposta.split('T')[0] : todayISO(),
      data_validade: proposta.data_validade ? proposta.data_validade.split('T')[0] : '',
      status: proposta.status || 'Rascunho',
      descricao: proposta.descricao || '',
      desconto: String(proposta.desconto ?? 0),
      desconto_percentual: String(proposta.desconto_percentual ?? 0),
      condicoes_pagamento: proposta.condicoes_pagamento || '',
      observacoes: proposta.observacoes || '',
      itens,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDelete = async (proposta) => {
    try {
      await pb.collection('propostas').delete(proposta.id, { $autoCancel: false });
      toast.success('Proposta excluída com sucesso');
      await auditLog(
        AUDIT_ACTIONS.RECORD_DELETED,
        AUDIT_MODULE,
        `Proposta excluída: ${proposta.numero_proposta}`,
      );
      fetchPropostas(page);
    } catch (err) {
      console.error('Erro ao excluir proposta:', err);
      toast.error('Erro ao excluir proposta');
    }
  };

  const handleStatusChange = async (proposta, newStatus) => {
    if (proposta.status === newStatus) return;
    try {
      await pb.collection('propostas').update(
        proposta.id,
        { status: newStatus, atualizado_por: currentUser.id },
        { $autoCancel: false },
      );
      toast.success(`Status alterado para "${newStatus}"`);
      await auditLog(
        AUDIT_ACTIONS.RECORD_UPDATED,
        AUDIT_MODULE,
        `Status da proposta ${proposta.numero_proposta} alterado para ${newStatus}`,
      );
      fetchPropostas(page);
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      toast.error('Erro ao alterar status');
    }
  };

  const handleView = (proposta) => {
    setViewing(proposta);
    setViewOpen(true);
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditing(null);
    setFormErrors({});
  };

  // ---------- Exportar PDF ----------
  const handleExportPDF = (proposta) => {
    try {
      const doc = new jsPDF();
      const cliente = proposta.expand?.cliente_id;
      const criador = proposta.expand?.criado_por;
      let y = 20;

      doc.setFontSize(18);
      doc.text('PROPOSTA COMERCIAL', 105, y, { align: 'center' });
      y += 8;
      doc.setFontSize(12);
      doc.text(`Número: ${proposta.numero_proposta}`, 14, y);
      y += 7;
      doc.text(`Status: ${proposta.status || '-'}`, 14, y);
      y += 7;
      doc.text(`Data da proposta: ${formatDate(proposta.data_proposta)}`, 14, y);
      y += 7;
      doc.text(`Validade: ${formatDate(proposta.data_validade)}`, 14, y);
      y += 12;

      doc.setFontSize(13);
      doc.text('Cliente', 14, y);
      y += 7;
      doc.setFontSize(11);
      doc.text(`Nome: ${cliente?.nome || '-'}`, 14, y);
      y += 6;
      if (cliente?.email) {
        doc.text(`Email: ${cliente.email}`, 14, y);
        y += 6;
      }
      if (cliente?.telefone) {
        doc.text(`Telefone: ${cliente.telefone}`, 14, y);
        y += 6;
      }
      y += 6;

      doc.setFontSize(13);
      doc.text('Itens', 14, y);
      y += 7;
      doc.setFontSize(10);
      // Cabeçalho da tabela
      doc.text('Material', 14, y);
      doc.text('Qtd', 120, y);
      doc.text('Preço Unit.', 140, y);
      doc.text('Subtotal', 175, y);
      y += 5;
      doc.line(14, y, 196, y);
      y += 6;

      const itens = Array.isArray(proposta.itens) ? proposta.itens : [];
      itens.forEach((it) => {
        const mat = materiais.find((m) => m.id === it.material_id);
        const nome = (mat?.name || it.material_id || '').substring(0, 50);
        doc.text(nome, 14, y);
        doc.text(String(it.quantidade), 120, y);
        doc.text(formatCurrency(it.preco_unitario), 140, y);
        doc.text(formatCurrency(it.subtotal), 175, y);
        y += 6;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });

      y += 6;
      doc.line(14, y, 196, y);
      y += 7;
      doc.setFontSize(11);
      doc.text(`Valor Total: ${formatCurrency(proposta.valor_total)}`, 130, y);
      y += 7;
      if (Number(proposta.desconto || 0) > 0) {
        doc.text(`Desconto: ${formatCurrency(proposta.desconto)}`, 130, y);
        y += 7;
      }
      if (Number(proposta.desconto_percentual || 0) > 0) {
        doc.text(`Desconto (%): ${proposta.desconto_percentual}%`, 130, y);
        y += 7;
      }
      doc.setFontSize(13);
      doc.text(`Valor Final: ${formatCurrency(proposta.valor_final)}`, 130, y);
      y += 10;

      doc.setFontSize(11);
      if (proposta.condicoes_pagamento) {
        doc.text(`Condições de pagamento: ${proposta.condicoes_pagamento}`, 14, y);
        y += 7;
      }
      if (proposta.observacoes) {
        doc.text('Observações:', 14, y);
        y += 6;
        const splitObs = doc.splitTextToSize(proposta.observacoes, 180);
        doc.text(splitObs, 14, y);
        y += splitObs.length * 6;
      }
      y += 8;
      doc.setFontSize(9);
      doc.text(`Criado por: ${criador?.name || criador?.email || '-'}`, 14, y);

      doc.save(`proposta_${proposta.numero_proposta}.pdf`);
      toast.success('PDF gerado com sucesso');
      auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULE, `Proposta exportada: ${proposta.numero_proposta}`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF');
    }
  };

  // ---------- Email (estrutura preparatória) ----------
  const openEmailDialog = (proposta) => {
    const cliente = proposta.expand?.cliente_id;
    setEmailTarget(proposta);
    setEmailData({
      destinatario: cliente?.email || '',
      assunto: `Proposta ${proposta.numero_proposta} - DNM&LTDA`,
      mensagem: `Prezado(a) ${cliente?.nome || ''},\n\nSegue em anexo a proposta ${proposta.numero_proposta} no valor de ${formatCurrency(proposta.valor_final)}.\n\nAguardamos seu retorno.\n\nAtenciosamente,\nDNM&LTDA Obras`,
    });
    setEmailOpen(true);
  };

  const handleSendEmail = async (e) => {
    e?.preventDefault();
    if (!emailTarget) return;
    if (!emailData.destinatario.trim()) {
      toast.error('Informe o destinatário');
      return;
    }
    // Estrutura preparada: abre o cliente de email do usuário com os dados preenchidos.
    const body = encodeURIComponent(emailData.mensagem);
    const subject = encodeURIComponent(emailData.assunto);
    window.location.href = `mailto:${emailData.destinatario}?subject=${subject}&body=${body}`;
    toast.success('Abrindo cliente de email...');
    await auditLog(
      'Proposta enviada por email',
      AUDIT_MODULE,
      `Proposta ${emailTarget.numero_proposta} enviada para ${emailData.destinatario}`,
    );
    setEmailOpen(false);
  };

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const aceitas = propostas.filter((p) => p.status === 'Aceita').length;
    const enviadas = propostas.filter((p) => p.status === 'Enviada').length;
    const valorTotalAceitas = propostas
      .filter((p) => p.status === 'Aceita')
      .reduce((s, p) => s + Number(p.valor_final || 0), 0);
    return { aceitas, enviadas, valorTotalAceitas };
  }, [propostas]);

  const clienteNome = (id) => {
    const c = clientes.find((x) => x.id === id);
    return c?.nome || '-';
  };

  // ---------- Render guards ----------
  if (loading && propostas.length === 0) {
    return (
      <>
        <Helmet>
          <title>Propostas - DNM&LTDA</title>
          <meta name="description" content="Gestão de propostas comerciais" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-12 w-full max-w-sm mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (error && propostas.length === 0) {
    return (
      <>
        <Helmet>
          <title>Propostas - DNM&LTDA</title>
          <meta name="description" content="Gestão de propostas comerciais" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar propostas</h2>
          <p className="text-muted-foreground mb-6">Houve um problema ao conectar com o banco de dados.</p>
          <Button onClick={() => fetchPropostas(1)}>Tentar novamente</Button>
        </div>
      </>
    );
  }

  if (!companyId) {
    return (
      <>
        <Helmet>
          <title>Propostas - DNM&LTDA</title>
          <meta name="description" content="Gestão de propostas comerciais" />
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

  return (
    <>
      <Helmet>
        <title>Propostas - DNM&LTDA</title>
        <meta name="description" content="Gestão de propostas comerciais do sistema integrado de gestão para construção civil" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Propostas</h1>
            <p className="text-muted-foreground">Gerencie as propostas comerciais da sua empresa</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Proposta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar Proposta' : 'Nova Proposta'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Dados gerais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="prop_cliente">Cliente *</Label>
                    <Select
                      value={formData.cliente_id || 'none'}
                      onValueChange={(v) => setFormData({ ...formData, cliente_id: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger id="prop_cliente" className={formErrors.cliente_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione...</SelectItem>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.cliente_id && <p className="text-xs text-destructive">{formErrors.cliente_id}</p>}
                    {clientes.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhum cliente cadastrado para esta empresa.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prop_data">Data da Proposta *</Label>
                    <Input
                      id="prop_data"
                      type="date"
                      value={formData.data_proposta}
                      onChange={(e) => setFormData({ ...formData, data_proposta: e.target.value })}
                      className={formErrors.data_proposta ? 'border-destructive' : ''}
                    />
                    {formErrors.data_proposta && <p className="text-xs text-destructive">{formErrors.data_proposta}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prop_validade">Data de Validade *</Label>
                    <Input
                      id="prop_validade"
                      type="date"
                      value={formData.data_validade}
                      onChange={(e) => setFormData({ ...formData, data_validade: e.target.value })}
                      className={formErrors.data_validade ? 'border-destructive' : ''}
                    />
                    {formErrors.data_validade && <p className="text-xs text-destructive">{formErrors.data_validade}</p>}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="prop_descricao">Descrição</Label>
                    <Input
                      id="prop_descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Descrição resumida da proposta"
                    />
                  </div>
                </div>

                {/* Itens */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Itens da Proposta *</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addItem}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar Item
                    </Button>
                  </div>
                  {formErrors.itens && <p className="text-xs text-destructive">{formErrors.itens}</p>}

                  <div className="space-y-2">
                    {formData.itens.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg border bg-muted/30">
                        <div className="col-span-12 sm:col-span-5 space-y-1">
                          <Label className="text-xs">Material</Label>
                          <Select
                            value={it.material_id || 'none'}
                            onValueChange={(v) => updateItem(idx, 'material_id', v === 'none' ? '' : v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Selecione...</SelectItem>
                              {materiais.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name} ({m.code || '-'})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-4 sm:col-span-2 space-y-1">
                          <Label className="text-xs">Qtd</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.quantidade}
                            onChange={(e) => updateItem(idx, 'quantidade', e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2 space-y-1">
                          <Label className="text-xs">Preço Unit.</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.preco_unitario}
                            onChange={(e) => updateItem(idx, 'preco_unitario', e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2 space-y-1">
                          <Label className="text-xs">Subtotal</Label>
                          <div className="h-9 flex items-center text-sm font-medium px-2">
                            {formatCurrency(Number(it.quantidade || 0) * Number(it.preco_unitario || 0))}
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10 h-9 w-9 p-0"
                            onClick={() => removeItem(idx)}
                            disabled={formData.itens.length === 1}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {materiais.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhum material cadastrado para esta empresa.</p>
                  )}
                </div>

                {/* Valores */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg border bg-muted/20">
                  <div className="space-y-2">
                    <Label htmlFor="prop_desconto">Desconto (R$)</Label>
                    <Input
                      id="prop_desconto"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.desconto}
                      onChange={(e) => setFormData({ ...formData, desconto: e.target.value })}
                      className={formErrors.desconto ? 'border-destructive' : ''}
                    />
                    {formErrors.desconto && <p className="text-xs text-destructive">{formErrors.desconto}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prop_desconto_pct">Desconto (%)</Label>
                    <Input
                      id="prop_desconto_pct"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.desconto_percentual}
                      onChange={(e) => setFormData({ ...formData, desconto_percentual: e.target.value })}
                      className={formErrors.desconto_percentual ? 'border-destructive' : ''}
                    />
                    {formErrors.desconto_percentual && <p className="text-xs text-destructive">{formErrors.desconto_percentual}</p>}
                  </div>
                  <div className="sm:col-span-2 flex flex-col sm:flex-row justify-between gap-2 pt-2 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Total (itens)</p>
                      <p className="text-xl font-bold text-primary">{formatCurrency(valorTotal)}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-sm text-muted-foreground">Valor Final</p>
                      <p className="text-xl font-bold text-green-600">{formatCurrency(valorFinal)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prop_condicoes">Condições de Pagamento</Label>
                    <Input
                      id="prop_condicoes"
                      value={formData.condicoes_pagamento}
                      onChange={(e) => setFormData({ ...formData, condicoes_pagamento: e.target.value })}
                      placeholder="Ex: 50% entrada, 50% na entrega"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prop_status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger id="prop_status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_VALUES.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prop_observacoes">Observações</Label>
                  <Textarea
                    id="prop_observacoes"
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de propostas</p>
                <p className="text-2xl font-bold text-primary">{totalItems}</p>
              </div>
              <FileText className="w-8 h-8 text-primary/30" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Propostas aceitas (página)</p>
                <p className="text-2xl font-bold text-green-600">{stats.aceitas}</p>
              </div>
              <FileText className="w-8 h-8 text-green-600/30" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor aceitas (página)</p>
                <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.valorTotalAceitas)}</p>
              </div>
              <FileText className="w-8 h-8 text-amber-600/30" />
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <Input
                placeholder="Buscar por número ou descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 px-0 text-base"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-[150px]"
                placeholder="De"
              />
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-[150px]"
                placeholder="Até"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="hidden lg:table-cell">Validade</TableHead>
                  <TableHead>Valor Final</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propostas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      {searchQuery || filterStatus !== 'all' || filterDateFrom || filterDateTo
                        ? 'Nenhuma proposta encontrada com os filtros aplicados'
                        : 'Nenhuma proposta cadastrada. Clique em "Nova Proposta" para começar.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  propostas.map((p) => {
                    const locked = LOCKED_STATUS.includes(p.status);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.numero_proposta}</TableCell>
                        <TableCell>{p.expand?.cliente_id?.nome || clienteNome(p.cliente_id)}</TableCell>
                        <TableCell className="hidden md:table-cell">{formatDate(p.data_proposta)}</TableCell>
                        <TableCell className="hidden lg:table-cell">{formatDate(p.data_validade)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(p.valor_final)}</TableCell>
                        <TableCell>
                          <Select
                            value={p.status || 'Rascunho'}
                            onValueChange={(v) => handleStatusChange(p, v)}
                          >
                            <SelectTrigger className="h-8 w-[130px]">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(p.status)}`}>
                                {STATUS_LABELS[p.status] || p.status || '-'}
                              </span>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_VALUES.map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" title="Visualizar" onClick={() => handleView(p)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Exportar PDF" onClick={() => handleExportPDF(p)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" title="Enviar por email" onClick={() => openEmailDialog(p)}>
                              <Mail className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title={locked ? 'Proposta bloqueada para edição' : 'Editar'}
                              onClick={() => handleEdit(p)}
                              disabled={locked}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Excluir">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir Proposta</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja arquivar a proposta <strong>{p.numero_proposta}</strong>? O registro sai da lista, mas fica guardado no histórico (nada é apagado).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDelete(p)}
                                  >
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages} • {totalItems} proposta(s)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => fetchPropostas(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => fetchPropostas(page + 1)}
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Visualizar detalhes */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposta {viewing?.numero_proposta}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{viewing.expand?.cliente_id?.nome || clienteNome(viewing.cliente_id)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor(viewing.status)}`}>
                    {STATUS_LABELS[viewing.status] || viewing.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data da proposta</p>
                  <p className="font-medium">{formatDate(viewing.data_proposta)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Validade</p>
                  <p className="font-medium">{formatDate(viewing.data_validade)}</p>
                </div>
              </div>

              {viewing.descricao && (
                <div>
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="text-sm">{viewing.descricao}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-semibold mb-2">Itens</p>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Preço Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(Array.isArray(viewing.itens) ? viewing.itens : []).map((it, i) => {
                        const mat = materiais.find((m) => m.id === it.material_id);
                        return (
                          <TableRow key={i}>
                            <TableCell>{mat?.name || it.material_id || '-'}</TableCell>
                            <TableCell>{it.quantidade}</TableCell>
                            <TableCell>{formatCurrency(it.preco_unitario)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(it.subtotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border bg-muted/20">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="font-bold">{formatCurrency(viewing.valor_total)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Valor Final</p>
                  <p className="font-bold text-green-600">{formatCurrency(viewing.valor_final)}</p>
                </div>
              </div>

              {viewing.condicoes_pagamento && (
                <div>
                  <p className="text-xs text-muted-foreground">Condições de pagamento</p>
                  <p className="text-sm">{viewing.condicoes_pagamento}</p>
                </div>
              )}
              {viewing.observacoes && (
                <div>
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm whitespace-pre-wrap">{viewing.observacoes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t text-xs text-muted-foreground">
                <div>
                  <p>Criado por: {viewing.expand?.criado_por?.name || viewing.expand?.criado_por?.email || '-'}</p>
                </div>
                <div className="text-right">
                  <p>Atualizado por: {viewing.expand?.atualizado_por?.name || viewing.expand?.atualizado_por?.email || '-'}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handleExportPDF(viewing)}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar PDF
                </Button>
                <Button variant="outline" onClick={() => openEmailDialog(viewing)}>
                  <Mail className="w-4 h-4 mr-2" />
                  Enviar por email
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enviar Proposta por Email</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email_dest">Destinatário *</Label>
              <Input
                id="email_dest"
                type="email"
                value={emailData.destinatario}
                onChange={(e) => setEmailData({ ...emailData, destinatario: e.target.value })}
                placeholder="email@cliente.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_assunto">Assunto</Label>
              <Input
                id="email_assunto"
                value={emailData.assunto}
                onChange={(e) => setEmailData({ ...emailData, assunto: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_msg">Mensagem</Label>
              <Textarea
                id="email_msg"
                value={emailData.mensagem}
                onChange={(e) => setEmailData({ ...emailData, mensagem: e.target.value })}
                rows={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Será aberto o cliente de email do seu dispositivo com os dados preenchidos. Anexe o PDF exportado manualmente.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>Cancelar</Button>
              <Button type="submit">
                <Send className="w-4 h-4 mr-2" />
                Enviar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PropostasPage;
