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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  Eye,
  Download,
  ChevronLeft,
  ChevronRight,
  Users,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { mensagemErro } from '@/lib/erros.js';

const AUDIT_MODULE = 'Clientes';

const PER_PAGE = 10;

const TIPO_OPTIONS = ['Pessoa Física', 'Pessoa Jurídica'];
const STATUS_OPTIONS = ['Ativo', 'Inativo'];

const emptyForm = {
  nome: '',
  email: '',
  telefone: '',
  cpf_cnpj: '',
  endereco: '',
  cidade: '',
  estado: '',
  cep: '',
  tipo: 'Pessoa Física',
  status: 'Ativo',
};

const formatCurrency = (v) => Number(v || 0).toLocaleString('pt-BR');

// ---------- CPF / CNPJ validation ----------
const cleanDoc = (doc) => String(doc || '').replace(/[^\d]/g, '');

const validateCPF = (cpf) => {
  cpf = cleanDoc(cpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
};

const validateCNPJ = (cnpj) => {
  cnpj = cleanDoc(cnpj);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base, weights) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.substring(0, 12), w1);
  const d2 = calc(cnpj.substring(0, 12) + d1, w2);
  return d1 === parseInt(cnpj[12], 10) && d2 === parseInt(cnpj[13], 10);
};

const validateDoc = (doc, tipo) => {
  if (!doc) return true; // opcional
  if (tipo === 'Pessoa Jurídica') return validateCNPJ(doc);
  return validateCPF(doc);
};

const formatDoc = (doc, tipo) => {
  const d = cleanDoc(doc);
  if (tipo === 'Pessoa Jurídica' && d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (tipo === 'Pessoa Física' && d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return doc || '-';
};

const statusColor = (status) => {
  switch (status) {
    case 'Ativo':
      return 'bg-green-500/10 text-green-700 border-green-500/20';
    case 'Inativo':
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  }
};

const ClientesPage = () => {
  const { currentUser } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  const companyId = currentUser?.company_id;

  const buildFilter = useCallback(() => {
    if (!companyId) return '';
    const parts = [`company_id = "${companyId}"`];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().replace(/\\/g, '').replace(/"/g, '\\"');
      parts.push(`(nome ~ "${q}" || email ~ "${q}" || cpf_cnpj ~ "${q}")`);
    }
    if (filterTipo !== 'all') parts.push(`tipo = "${filterTipo}"`);
    if (filterStatus !== 'all') parts.push(`status = "${filterStatus}"`);
    return parts.join(' && ');
  }, [companyId, searchQuery, filterTipo, filterStatus]);

  const fetchClientes = useCallback(
    async (p = 1) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(false);
      try {
        const result = await pb.collection('clientes').getList(p, PER_PAGE, {
          filter: buildFilter(),
          sort: '-created',
          expand: 'criado_por,atualizado_por',
          $autoCancel: false,
        });
        setClientes(result.items);
        setTotalItems(result.totalItems);
        setTotalPages(result.totalPages);
        setPage(p);
      } catch (err) {
        console.error('Erro ao carregar clientes:', err);
        setError(true);
        toast.error('Erro ao carregar clientes');
      } finally {
        setLoading(false);
      }
    },
    [companyId, buildFilter],
  );

  useEffect(() => {
    if (companyId) {
      const t = setTimeout(() => fetchClientes(1), 350);
      return () => clearTimeout(t);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, searchQuery, filterTipo, filterStatus]);

  // ---------- Duplicate check ----------
  const checkDuplicate = async (field, value, excludeId = null) => {
    if (!value || !companyId) return false;
    try {
      const filter = `company_id = "${companyId}" && ${field} = "${value.replace(/\\/g, '').replace(/"/g, '\\"')}"`;
      const res = await pb.collection('clientes').getList(1, 1, {
        filter,
        $autoCancel: false,
      });
      if (res.items.length === 0) return false;
      if (excludeId && res.items[0].id === excludeId) return false;
      return true;
    } catch (e) {
      return false;
    }
  };

  const validateForm = async () => {
    const errs = {};
    if (!formData.nome.trim()) errs.nome = 'Nome é obrigatório';
    if (!formData.email.trim()) errs.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
      errs.email = 'E-mail inválido';

    if (formData.cpf_cnpj.trim()) {
      if (!validateDoc(formData.cpf_cnpj, formData.tipo)) {
        errs.cpf_cnpj =
          formData.tipo === 'Pessoa Jurídica'
            ? 'CNPJ inválido'
            : 'CPF inválido';
      }
    }

    if (formData.estado && formData.estado.length > 2) {
      errs.estado = 'Use a sigla do estado (2 letras)';
    }

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return false;

    // Duplicate checks (only if basic validation passed)
    const dupEmail = await checkDuplicate('email', formData.email.trim(), editing?.id);
    if (dupEmail) {
      setFormErrors((p) => ({ ...p, email: 'Já existe um cliente com este e-mail nesta empresa' }));
      return false;
    }
    if (formData.cpf_cnpj.trim()) {
      const dupDoc = await checkDuplicate('cpf_cnpj', cleanDoc(formData.cpf_cnpj), editing?.id);
      if (dupDoc) {
        setFormErrors((p) => ({ ...p, cpf_cnpj: 'Já existe um cliente com este CPF/CNPJ nesta empresa' }));
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!companyId) {
      toast.error('Empresa não identificada');
      return;
    }
    setSaving(true);
    try {
      const ok = await validateForm();
      if (!ok) {
        setSaving(false);
        return;
      }

      const payload = {
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        telefone: formData.telefone.trim() || null,
        cpf_cnpj: formData.cpf_cnpj.trim() ? cleanDoc(formData.cpf_cnpj) : null,
        endereco: formData.endereco.trim() || null,
        cidade: formData.cidade.trim() || null,
        estado: formData.estado.trim().toUpperCase() || null,
        cep: formData.cep.trim() || null,
        tipo: formData.tipo,
        status: formData.status,
        company_id: companyId,
      };

      if (editing) {
        const updated = await pb.collection('clientes').update(
          editing.id,
          { ...payload, atualizado_por: currentUser.id },
          { $autoCancel: false },
        );
        toast.success('Cliente atualizado com sucesso');
        await auditLog(
          AUDIT_ACTIONS.RECORD_UPDATED,
          AUDIT_MODULE,
          `Cliente atualizado: ${updated.nome} (${updated.email})`,
        );
      } else {
        const created = await pb.collection('clientes').create(
          { ...payload, criado_por: currentUser.id, atualizado_por: currentUser.id },
          { $autoCancel: false },
        );
        toast.success('Cliente cadastrado com sucesso');
        await auditLog(
          AUDIT_ACTIONS.RECORD_CREATED,
          AUDIT_MODULE,
          `Cliente criado: ${created.nome} (${created.email})`,
        );
      }

      setDialogOpen(false);
      resetForm();
      fetchClientes(page);
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
      toast.error(mensagemErro(err, 'Erro ao salvar cliente'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cliente) => {
    setEditing(cliente);
    setFormData({
      nome: cliente.nome || '',
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      cpf_cnpj: cliente.cpf_cnpj || '',
      endereco: cliente.endereco || '',
      cidade: cliente.cidade || '',
      estado: cliente.estado || '',
      cep: cliente.cep || '',
      tipo: cliente.tipo || 'Pessoa Física',
      status: cliente.status || 'Ativo',
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleDelete = async (id, nome) => {
    try {
      await pb.collection('clientes').delete(id, { $autoCancel: false });
      toast.success('Cliente excluído com sucesso');
      await auditLog(
        AUDIT_ACTIONS.RECORD_DELETED,
        AUDIT_MODULE,
        `Cliente excluído: ${nome}`,
      );
      fetchClientes(page);
    } catch (err) {
      console.error('Erro ao excluir cliente:', err);
      toast.error('Erro ao excluir cliente');
    }
  };

  const handleView = (cliente) => {
    setViewing(cliente);
    setViewOpen(true);
  };

  const handleExport = async () => {
    if (!companyId) return;
    try {
      const all = await pb.collection('clientes').getFullList({
        filter: buildFilter(),
        sort: '-created',
        expand: 'criado_por,atualizado_por',
        $autoCancel: false,
      });
      const headers = [
        'Nome',
        'Tipo',
        'CPF/CNPJ',
        'E-mail',
        'Telefone',
        'Status',
        'Endereço',
        'Cidade',
        'Estado',
        'CEP',
        'Criado por',
        'Atualizado por',
        'Criado em',
      ];
      const rows = all.map((c) => [
        c.nome || '',
        c.tipo || '',
        formatDoc(c.cpf_cnpj, c.tipo),
        c.email || '',
        c.telefone || '',
        c.status || '',
        c.endereco || '',
        c.cidade || '',
        c.estado || '',
        c.cep || '',
        c.expand?.criado_por?.name || c.expand?.criado_por?.email || '',
        c.expand?.atualizado_por?.name || c.expand?.atualizado_por?.email || '',
        c.created ? new Date(c.created).toLocaleString('pt-BR') : '',
      ]);
      const csv = [headers, ...rows]
        .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`${all.length} cliente(s) exportado(s)`);
      await auditLog(AUDIT_ACTIONS.EXPORT_DATA, AUDIT_MODULE, `Exportação de lista de clientes (${all.length} registros)`);
    } catch (err) {
      console.error('Erro ao exportar:', err);
      toast.error('Erro ao exportar clientes');
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditing(null);
    setFormErrors({});
  };

  const stats = useMemo(() => {
    const ativos = clientes.filter((c) => c.status === 'Ativo').length;
    const pf = clientes.filter((c) => c.tipo === 'Pessoa Física').length;
    const pj = clientes.filter((c) => c.tipo === 'Pessoa Jurídica').length;
    return { ativos, pf, pj };
  }, [clientes]);

  if (loading && clientes.length === 0) {
    return (
      <>
        <Helmet>
          <title>Clientes - DNM&LTDA</title>
          <meta name="description" content="Gestão de clientes do sistema" />
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

  if (error && clientes.length === 0) {
    return (
      <>
        <Helmet>
          <title>Clientes - DNM&LTDA</title>
          <meta name="description" content="Gestão de clientes do sistema" />
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar clientes</h2>
          <p className="text-muted-foreground mb-6">Houve um problema ao conectar com o banco de dados.</p>
          <Button onClick={() => fetchClientes(1)}>Tentar novamente</Button>
        </div>
      </>
    );
  }

  if (!companyId) {
    return (
      <>
        <Helmet>
          <title>Clientes - DNM&LTDA</title>
          <meta name="description" content="Gestão de clientes do sistema" />
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
        <title>Clientes - DNM&LTDA</title>
        <meta name="description" content="Gestão de clientes do sistema integrado de gestão para construção civil" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Clientes</h1>
            <p className="text-muted-foreground">Gerencie os clientes da sua empresa</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="cli_nome">Nome / Razão Social *</Label>
                      <Input
                        id="cli_nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        className={formErrors.nome ? 'border-destructive' : ''}
                      />
                      {formErrors.nome && <p className="text-xs text-destructive">{formErrors.nome}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cli_tipo">Tipo</Label>
                      <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                        <SelectTrigger id="cli_tipo">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_OPTIONS.map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cli_status">Status</Label>
                      <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                        <SelectTrigger id="cli_status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cli_cpf_cnpj">{formData.tipo === 'Pessoa Jurídica' ? 'CNPJ' : 'CPF'}</Label>
                      <Input
                        id="cli_cpf_cnpj"
                        value={formData.cpf_cnpj}
                        onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                        placeholder={formData.tipo === 'Pessoa Jurídica' ? '00.000.000/0000-00' : '000.000.000-00'}
                        className={formErrors.cpf_cnpj ? 'border-destructive' : ''}
                      />
                      {formErrors.cpf_cnpj && <p className="text-xs text-destructive">{formErrors.cpf_cnpj}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cli_telefone">Telefone</Label>
                      <Input
                        id="cli_telefone"
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="cli_email">E-mail *</Label>
                      <Input
                        id="cli_email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={formErrors.email ? 'border-destructive' : ''}
                      />
                      {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="cli_endereco">Endereço</Label>
                      <Textarea
                        id="cli_endereco"
                        value={formData.endereco}
                        onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cli_cidade">Cidade</Label>
                      <Input
                        id="cli_cidade"
                        value={formData.cidade}
                        onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cli_estado">Estado</Label>
                        <Input
                          id="cli_estado"
                          value={formData.estado}
                          maxLength={2}
                          onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                          className={formErrors.estado ? 'border-destructive' : ''}
                        />
                        {formErrors.estado && <p className="text-xs text-destructive">{formErrors.estado}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cli_cep">CEP</Label>
                        <Input
                          id="cli_cep"
                          value={formData.cep}
                          onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                        />
                      </div>
                    </div>
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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de clientes</p>
                <p className="text-2xl font-bold text-primary">{totalItems}</p>
              </div>
              <Users className="w-8 h-8 text-primary/30" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes ativos</p>
                <p className="text-2xl font-bold text-green-600">{stats.ativos}</p>
              </div>
              <Users className="w-8 h-8 text-green-600/30" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">PF / PJ (página)</p>
                <p className="text-2xl font-bold text-primary">{stats.pf} / {stats.pj}</p>
              </div>
              <Users className="w-8 h-8 text-primary/30" />
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <Input
                placeholder="Buscar por nome, e-mail ou CPF/CNPJ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-none shadow-none focus-visible:ring-0 px-0 text-base"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {TIPO_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead className="hidden md:table-cell">Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {searchQuery || filterTipo !== 'all' || filterStatus !== 'all'
                        ? 'Nenhum cliente encontrado com os filtros aplicados'
                        : 'Nenhum cliente cadastrado. Clique em "Novo Cliente" para começar.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{c.nome}</span>
                          <span className="text-xs text-muted-foreground md:hidden">{c.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 bg-muted rounded-full">{c.tipo || '-'}</span>
                      </TableCell>
                      <TableCell>{formatDoc(c.cpf_cnpj, c.tipo)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-col text-sm">
                          <span className="text-muted-foreground">{c.email}</span>
                          <span className="text-xs text-muted-foreground">{c.telefone || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor(c.status)}`}>
                          {c.status || 'Ativo'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" title="Visualizar" onClick={() => handleView(c)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Editar" onClick={() => handleEdit(c)}>
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
                                <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja arquivar o cliente <strong>{c.nome}</strong>? O registro sai da lista, mas fica guardado no histórico (nada é apagado).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(c.id, c.nome)}
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages} • {totalItems} cliente(s)
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => fetchClientes(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => fetchClientes(page + 1)}
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View details dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">{viewing.nome}</h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs px-2 py-1 bg-muted rounded-full">{viewing.tipo}</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${statusColor(viewing.status)}`}>
                      {viewing.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p>{viewing.email || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p>{viewing.telefone || '-'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                    <p>{formatDoc(viewing.cpf_cnpj, viewing.tipo)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Endereço</p>
                    <p>
                      {[viewing.endereco, viewing.cidade, viewing.estado, viewing.cep]
                        .filter(Boolean)
                        .join(', ') || '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-3 space-y-1 text-xs text-muted-foreground">
                <p>
                  <strong>Criado por:</strong>{' '}
                  {viewing.expand?.criado_por?.name || viewing.expand?.criado_por?.email || '—'}
                  {viewing.created && ` em ${new Date(viewing.created).toLocaleString('pt-BR')}`}
                </p>
                <p>
                  <strong>Atualizado por:</strong>{' '}
                  {viewing.expand?.atualizado_por?.name || viewing.expand?.atualizado_por?.email || '—'}
                  {viewing.updated && ` em ${new Date(viewing.updated).toLocaleString('pt-BR')}`}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientesPage;
