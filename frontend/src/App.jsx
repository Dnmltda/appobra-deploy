import React, { useState, useEffect } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Route, Routes, BrowserRouter as Router, Navigate, useSearchParams, useLocation, Link as RouterLink } from 'react-router-dom';
import { CompanyProvider } from '@/contexts/CompanyContext.jsx';
import { AuthProvider, useAuth } from '@/contexts/AuthContext.jsx';
import { LanguageProvider } from '@/contexts/LanguageContext.jsx';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { vigiarVersaoNova } from '@/lib/instalarApp.js';
import pb from '@/lib/pocketbaseClient.js';
import { validatePasswordStrength, passwordsMatch, passwordStrengthScore, STRENGTH_LABELS } from '@/utils/loginValidations.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Search, AlertCircle, CheckCircle2, KeyRound, Eye, EyeOff, Loader2, Check, UserCheck } from 'lucide-react';
import ScrollToTop from '@/components/ScrollToTop.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import Header from '@/components/Header.jsx';

import SplashScreen from '@/pages/SplashScreen.jsx';
import LoginPage from '@/pages/LoginPage.jsx';
import DashboardPage from '@/pages/DashboardPage.jsx';
import EmployeeManagement from '@/pages/EmployeeManagement.jsx';
import TrainingTracker from '@/pages/TrainingTracker.jsx';
import ProjectManagement from '@/pages/ProjectManagement.jsx';
import SuppliersManagement from '@/pages/SuppliersManagement.jsx';
import SettingsPage from '@/pages/SettingsPage.jsx';
import PaginaNotificacoes from '@/pages/PaginaNotificacoes.jsx';
import MinhasMovimentacoesPage from '@/pages/MinhasMovimentacoesPage.jsx';
import UserProfilePage from '@/pages/UserProfilePage.jsx';
import AdminSecurityPanel from '@/pages/AdminSecurityPanel.jsx';
import AuditPage from '@/pages/AuditPage.jsx';

import ReportsPage from '@/pages/ReportsPage.jsx';
import QRCodeModule from '@/pages/QRCodeModule.jsx';
import LossesGainsModule from '@/pages/LossesGainsModule.jsx';
import DocumentsCentralPage from '@/pages/DocumentsCentralPage.jsx';

import ClientesPage from '@/pages/ClientesPage.jsx';
import MateriaisPage from '@/pages/MateriaisPage.jsx';
import PropostasPage from '@/pages/PropostasPage.jsx';
import MovimentacoesPage from '@/pages/MovimentacoesPage.jsx';
import EstoqueAlmoxarifadoPage from '@/pages/EstoqueAlmoxarifadoPage.jsx';
import OcorrenciasPage from '@/pages/OcorrenciasPage.jsx';
import SaldoFuncionarioPage from '@/pages/SaldoFuncionarioPage.jsx';
import MateriaisObraPage from '@/pages/MateriaisObraPage.jsx';
import EstoqueObrasPage from '@/pages/EstoqueObrasPage.jsx';
import ObraPage from '@/pages/ObraPage.jsx';
import ObraAndamentoPage from '@/pages/ObraAndamentoPage.jsx';
import EquipamentosPage from '@/pages/EquipamentosPage.jsx';
import EmpresasPage from '@/pages/EmpresasPage.jsx';
import EmpresaDetalhesPage from '@/pages/EmpresaDetalhesPage.jsx';
import ComprasPage from '@/pages/ComprasPage.jsx';
import CompraDetalhesPage from '@/pages/CompraDetalhesPage.jsx';
import SolicitacoesPage from '@/pages/SolicitacoesPage.jsx';
import SolicitacaoDetalhesPage from '@/pages/SolicitacaoDetalhesPage.jsx';
import UsuariosPage from '@/pages/UsuariosPage.jsx';
import UsuarioDetalhesPage from '@/pages/UsuarioDetalhesPage.jsx';

import DashboardFinanceiro from '@/pages/financeiro/DashboardFinanceiro.jsx';
import ContasPagar from '@/pages/financeiro/ContasPagar.jsx';

import TreinamentosPage from '@/pages/rh/TreinamentosPage.jsx';
import EPIsPage from '@/pages/rh/EPIsPage.jsx';
import EquipesPage from '@/pages/rh/EquipesPage.jsx';
import DocumentosPage from '@/pages/rh/DocumentosPage.jsx';

import VeiculosPage from '@/pages/frota/VeiculosPage.jsx';
import FrotaDashboardPage from '@/pages/frota/FrotaDashboardPage.jsx';
import AbastecimentosPage from '@/pages/frota/AbastecimentosPage.jsx';
import ManutencoesFrotaPage from '@/pages/frota/ManutencoesFrotaPage.jsx';
import { mensagemErro } from '@/lib/erros.js';

// ContasReceberPage: definido aqui em App.jsx (não em arquivo separado) porque
// o editor manual do Horizons não permite criar arquivos novos, só editar existentes.
const CR_STATUS_OPTIONS = ['Aberta', 'Parcialmente recebida', 'Recebida', 'Vencida'];

const crStatusColor = (status) => {
  switch (status) {
    case 'Recebida': return 'bg-green-500/10 text-green-700 border-green-500/20';
    case 'Vencida': return 'bg-red-500/10 text-red-700 border-red-500/20';
    case 'Parcialmente recebida': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
    default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
  }
};

const crFormatCurrency = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const crEmptyForm = {
  cliente: '',
  descricao: '',
  valor: '',
  data_vencimento: '',
  status: 'Aberta',
  data_recebimento: '',
  observacao: ''
};

const ContasReceberPage = () => {
  const { currentUser } = useAuth();
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConta, setEditingConta] = useState(null);
  const [formData, setFormData] = useState(crEmptyForm);

  // Clientes cadastrados, para escolher em vez de digitar o nome.
  const [clientes, setClientes] = useState([]);

  useEffect(() => {
    if (currentUser?.company_id) {
      fetchContas();
      pb.collection('clientes').getFullList({ filter: `company_id = "${currentUser.company_id}"`, sort: 'nome', $autoCancel: false })
        .then(setClientes).catch(() => setClientes([]));
    }
  }, [currentUser]);

  const fetchContas = async () => {
    if (!currentUser?.company_id) {
      toast.error('Empresa não identificada');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await pb.collection('contas_receber').getFullList({
        filter: `company_id = "${currentUser.company_id}"`,
        sort: 'data_vencimento',
        $autoCancel: false
      });
      setContas(data);
    } catch (err) {
      console.error('Erro ao carregar contas a receber:', err);
      setError(true);
      toast.error('Erro ao carregar contas a receber');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser?.company_id) {
      toast.error('Empresa não identificada');
      return;
    }
    try {
      const payload = {
        cliente: formData.cliente,
        descricao: formData.descricao,
        valor: Number(formData.valor),
        data_vencimento: formData.data_vencimento,
        status: formData.status,
        data_recebimento: formData.data_recebimento || null,
        observacao: formData.observacao || null,
        company_id: currentUser.company_id
      };

      if (editingConta) {
        await pb.collection('contas_receber').update(editingConta.id, payload, { $autoCancel: false });
        toast.success('Conta a receber atualizada com sucesso');
      } else {
        await pb.collection('contas_receber').create(payload, { $autoCancel: false });
        toast.success('Conta a receber cadastrada com sucesso');
      }

      setDialogOpen(false);
      resetForm();
      fetchContas();
    } catch (err) {
      console.error('Erro ao salvar conta a receber:', err);
      toast.error(mensagemErro(err, 'Erro ao salvar conta a receber'));
    }
  };

  const handleEdit = (conta) => {
    setEditingConta(conta);
    setFormData({
      cliente: conta.cliente || '',
      descricao: conta.descricao || '',
      valor: conta.valor ?? '',
      data_vencimento: conta.data_vencimento ? conta.data_vencimento.split('T')[0] : '',
      status: conta.status || 'Aberta',
      data_recebimento: conta.data_recebimento ? conta.data_recebimento.split('T')[0] : '',
      observacao: conta.observacao || ''
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await pb.collection('contas_receber').delete(id, { $autoCancel: false });
      toast.success('Conta a receber excluída com sucesso');
      fetchContas();
    } catch (err) {
      console.error('Erro ao excluir conta a receber:', err);
      toast.error('Erro ao excluir conta a receber');
    }
  };

  const handleMarkReceived = async (conta) => {
    try {
      await pb.collection('contas_receber').update(conta.id, {
        status: 'Recebida',
        data_recebimento: new Date().toISOString().split('T')[0]
      }, { $autoCancel: false });
      toast.success('Conta marcada como recebida');
      fetchContas();
    } catch (err) {
      console.error('Erro ao marcar como recebida:', err);
      toast.error('Erro ao atualizar conta');
    }
  };

  const resetForm = () => {
    setFormData(crEmptyForm);
    setEditingConta(null);
  };

  const filteredContas = contas.filter((conta) => {
    const query = searchQuery.toLowerCase();
    return (
      (conta.cliente || '').toLowerCase().includes(query) ||
      (conta.descricao || '').toLowerCase().includes(query)
    );
  });

  const totalAberto = contas
    .filter((c) => c.status === 'Aberta' || c.status === 'Vencida' || c.status === 'Parcialmente recebida')
    .reduce((sum, c) => sum + Number(c.valor || 0), 0);

  if (loading && contas.length === 0) {
    return (
      <>
        <Helmet><title>Contas a Receber - DNM&LTDA</title></Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-12 w-full max-w-sm mb-6" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (error && contas.length === 0) {
    return (
      <>
        <Helmet><title>Contas a Receber - DNM&LTDA</title></Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar contas a receber</h2>
          <p className="text-muted-foreground mb-6">Houve um problema ao conectar com o banco de dados.</p>
          <Button onClick={fetchContas}>Tentar novamente</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Contas a Receber - DNM&LTDA</title>
        <meta name="description" content="Gestão de contas a receber de clientes" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Contas a Receber</h1>
            <p className="text-muted-foreground">Gerencie os valores a receber dos seus clientes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Conta a Receber
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingConta ? 'Editar Conta a Receber' : 'Nova Conta a Receber'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cr_cliente">Cliente *</Label>
                  {clientes.length > 0 ? (
                    <Select value={formData.cliente || ''} onValueChange={(v) => setFormData({ ...formData, cliente: v })}>
                      <SelectTrigger id="cr_cliente"><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
                      <SelectContent>
                        {formData.cliente && !clientes.some((c) => c.nome === formData.cliente) && (
                          <SelectItem value={formData.cliente}>{formData.cliente}</SelectItem>
                        )}
                        {clientes.map((c) => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <Input
                        id="cr_cliente"
                        value={formData.cliente}
                        onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                        required
                        className="text-foreground"
                      />
                      <p className="text-xs text-muted-foreground">Dica: cadastre seus clientes em Clientes para escolher da lista.</p>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr_descricao">Descrição *</Label>
                  <Input
                    id="cr_descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    required
                    className="text-foreground"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cr_valor">Valor (R$) *</Label>
                    <Input
                      id="cr_valor"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                      required
                      className="text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cr_data_vencimento">Vencimento *</Label>
                    <Input
                      id="cr_data_vencimento"
                      type="date"
                      value={formData.data_vencimento}
                      onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                      required
                      className="text-foreground"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cr_status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger id="cr_status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CR_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cr_data_recebimento">Data de Recebimento</Label>
                    <Input
                      id="cr_data_recebimento"
                      type="date"
                      value={formData.data_recebimento}
                      onChange={(e) => setFormData({ ...formData, data_recebimento: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cr_observacao">Observação</Label>
                  <Textarea
                    id="cr_observacao"
                    value={formData.observacao}
                    onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                    className="text-foreground"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">{editingConta ? 'Atualizar' : 'Cadastrar'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total em aberto</p>
              <p className="text-2xl font-bold text-primary">{crFormatCurrency(totalAberto)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total de contas</p>
              <p className="text-2xl font-bold">{contas.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4 flex items-center gap-4">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-none shadow-none focus-visible:ring-0 px-0 text-base"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {searchQuery ? 'Nenhuma conta encontrada' : 'Nenhuma conta a receber cadastrada'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContas.map((conta) => (
                    <TableRow key={conta.id}>
                      <TableCell className="font-medium">{conta.cliente}</TableCell>
                      <TableCell>{conta.descricao}</TableCell>
                      <TableCell>{crFormatCurrency(conta.valor)}</TableCell>
                      <TableCell>{conta.data_vencimento ? new Date(conta.data_vencimento).toLocaleDateString('pt-BR') : '-'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${crStatusColor(conta.status)}`}>
                          {conta.status || 'Aberta'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {conta.status !== 'Recebida' && (
                            <Button size="sm" variant="ghost" title="Marcar como recebida" onClick={() => handleMarkReceived(conta)}>
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(conta)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Conta a Receber</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja arquivar a conta de {conta.cliente}? O registro sai da lista, mas fica guardado no histórico (nada é apagado).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(conta.id)}
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
      </div>
    </>
  );
};

// Simple placeholder component for missing routes to prevent 404s
const PlaceholderPage = ({ title }) => {
  return (
    <div className="min-h-screen bg-muted/20 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold text-primary mb-4">{title}</h1>
          <p className="text-muted-foreground mb-6">Este módulo está em desenvolvimento e estará disponível em breve.</p>
          <a href="/dashboard" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    </div>
  );
};

// Página de redefinição de senha (link enviado por email via
// pb_hooks/send-password-reset.pb.js). Definida aqui em App.jsx (não em
// arquivo separado) porque o editor manual do Horizons não permite criar
// arquivos novos, só editar existentes.
const ResetPasswordPageInline = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { resetPassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rpErrors, setRpErrors] = useState({});
  const [rpLoading, setRpLoading] = useState(false);
  const [rpDone, setRpDone] = useState(false);

  const score = passwordStrengthScore(password);

  const handleRpSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    const pwdResult = validatePasswordStrength(password);
    if (!pwdResult.valid) newErrors.password = pwdResult.message;
    if (!passwordsMatch(password, confirmPassword)) newErrors.confirmPassword = 'As senhas não conferem.';
    if (Object.keys(newErrors).length > 0) {
      setRpErrors(newErrors);
      return;
    }
    setRpLoading(true);
    try {
      await resetPassword(token, password);
      toast.success('Senha redefinida com sucesso!');
      setRpDone(true);
    } catch (err) {
      toast.error('Link inválido ou expirado. Solicite uma nova recuperação de senha.');
    } finally {
      setRpLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <Helmet><title>Redefinir Senha - DNM&LTDA</title></Helmet>
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">Link inválido</h1>
              <p className="text-muted-foreground mb-6">
                Este link de redefinição de senha está incompleto. Solicite uma nova recuperação pela tela de login.
              </p>
              <RouterLink to="/login">
                <Button className="w-full">Voltar para o login</Button>
              </RouterLink>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (rpDone) {
    return (
      <>
        <Helmet><title>Senha Redefinida - DNM&LTDA</title></Helmet>
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">Senha redefinida!</h1>
              <p className="text-muted-foreground mb-6">
                Sua senha foi alterada com sucesso. Já pode fazer login com a nova senha.
              </p>
              <RouterLink to="/login">
                <Button className="w-full">Ir para o login</Button>
              </RouterLink>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Redefinir Senha - DNM&LTDA</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-6 h-6 text-ouro" />
              <h1 className="text-xl font-bold text-marinho">Redefinir senha</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Escolha uma nova senha para sua conta.</p>

            <form onSubmit={handleRpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rp-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="rp-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setRpErrors((p) => ({ ...p, password: undefined })); }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < score
                              ? score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-yellow-500' : score === 3 ? 'bg-blue-500' : 'bg-green-600'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Força: {STRENGTH_LABELS[score]}</p>
                  </div>
                )}
                {rpErrors.password && <p className="text-xs text-destructive">{rpErrors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rp-confirm">Confirmar nova senha</Label>
                <div className="relative">
                  <Input
                    id="rp-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setRpErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {rpErrors.confirmPassword && <p className="text-xs text-destructive">{rpErrors.confirmPassword}</p>}
                {confirmPassword && password === confirmPassword && (
                  <p className="text-[11px] text-green-700 flex items-center gap-1">
                    <Check className="w-3 h-3" /> As senhas conferem
                  </p>
                )}
              </div>

              <Button type="submit" disabled={rpLoading} className="w-full bg-ouro text-marinho hover:bg-ouro-escuro font-bold">
                {rpLoading ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</span>
                ) : (
                  'Redefinir senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

// Página de confirmação de convite do funcionário (link enviado por email
// via pb_hooks/send-welcome-email.pb.js quando EmployeeManagement.jsx cria
// o acesso de um funcionário). Definida aqui em App.jsx (não em arquivo
// separado), mesmo motivo do ResetPasswordPageInline acima: o editor manual
// do Horizons não permite criar arquivos novos, só editar existentes.
// Duas etapas: (1) confirmar os dados pré-cadastrados pelo admin, sem
// digitar nada; (2) criar e confirmar a senha. Usa os endpoints públicos
// get-invite-details / activate-invite (ver AuthContext.jsx e
// apps/pocketbase/pb_hooks/activate-invite.pb.js) — não precisa de sessão
// logada, pois o funcionário convidado ainda não tem senha utilizável.
const AtivarContaPageInline = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { getInviteDetails, activateInvite } = useAuth();

  const [step, setStep] = useState('loading'); // loading | invalid | confirm | password | done
  const [invite, setInvite] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acErrors, setAcErrors] = useState({});
  const [acLoading, setAcLoading] = useState(false);

  const score = passwordStrengthScore(password);

  useEffect(() => {
    if (!token) {
      setStep('invalid');
      return;
    }
    getInviteDetails(token)
      .then((data) => {
        setInvite(data);
        setUsername(data?.username || '');
        setStep('confirm');
      })
      .catch(() => setStep('invalid'));
  }, [token]);

  const handleConfirmData = () => setStep('password');

  const handleCreatePassword = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) {
      newErrors.username = 'Use de 3 a 40 letras sem acento, números, ponto, hífen ou sublinhado, sem espaços.';
    }
    const pwdResult = validatePasswordStrength(password);
    if (!pwdResult.valid) newErrors.password = pwdResult.message;
    if (!passwordsMatch(password, confirmPassword)) newErrors.confirmPassword = 'As senhas não conferem.';
    if (Object.keys(newErrors).length > 0) {
      setAcErrors(newErrors);
      return;
    }
    setAcLoading(true);
    try {
      await activateInvite(token, password, confirmPassword, username);
      toast.success('Conta ativada com sucesso!');
      setStep('done');
    } catch (err) {
      const msg = err?.response?.message || err?.data?.message || '';
      // Problema no nome de usuário (já em uso / inválido): corrige e tenta de novo.
      if (/nome de usuário/i.test(msg)) {
        setAcErrors({ username: msg });
        return;
      }
      toast.error(mensagemErro(err, 'Link inválido ou expirado. Peça ao administrador para gerar um novo convite.'));
      setStep('invalid');
    } finally {
      setAcLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <>
        <Helmet><title>Convite inválido - DNM&LTDA</title></Helmet>
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">Link inválido ou expirado</h1>
              <p className="text-muted-foreground mb-6">
                Este link de convite não é mais válido. Peça ao administrador do sistema para reenviar o convite.
              </p>
              <RouterLink to="/login">
                <Button className="w-full">Voltar para o login</Button>
              </RouterLink>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (step === 'done') {
    return (
      <>
        <Helmet><title>Conta ativada - DNM&LTDA</title></Helmet>
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h1 className="text-xl font-bold mb-2">Conta ativada!</h1>
              <p className="text-muted-foreground mb-6">
                Seus dados foram confirmados e sua senha foi criada. Já pode entrar no sistema.
              </p>
              <RouterLink to="/login">
                <Button className="w-full">Ir para o login</Button>
              </RouterLink>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (step === 'confirm') {
    return (
      <>
        <Helmet><title>Confirme seus dados - DNM&LTDA</title></Helmet>
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-8">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="w-6 h-6 text-ouro" />
                <h1 className="text-xl font-bold text-marinho">Confirme seus dados</h1>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Esses dados foram cadastrados pelo administrador. Confira se estão corretos antes de continuar.
              </p>
              <div className="space-y-3 text-sm mb-6">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium text-right">{invite?.funcionario?.nome || invite?.name || '-'}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-right">{invite?.email || '-'}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Cargo</span>
                  <span className="font-medium text-right">{invite?.cargo || '-'}</span>
                </div>
                {invite?.empresa && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Empresa</span>
                    <span className="font-medium text-right">{invite.empresa}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Se algum dado estiver errado, avise o administrador antes de continuar — depois de criar a senha,
                qualquer correção de cadastro só pode ser feita por ele.
              </p>
              <Button onClick={handleConfirmData} className="w-full bg-ouro text-marinho hover:bg-ouro-escuro font-bold">
                Dados corretos, continuar
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Criar senha - DNM&LTDA</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-6 h-6 text-ouro" />
              <h1 className="text-xl font-bold text-marinho">Crie seu usuário e senha</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Para entrar no sistema você vai poder usar o seu e-mail{invite?.id_unico ? `, o seu ID (${invite.id_unico})` : ''} ou o nome de usuário abaixo.
            </p>

            <form onSubmit={handleCreatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ac-username">Nome de usuário</Label>
                <Input
                  id="ac-username"
                  value={username}
                  autoComplete="username"
                  onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/\s/g, '')); setAcErrors((p) => ({ ...p, username: undefined })); }}
                />
                {acErrors.username
                  ? <p className="text-xs text-destructive">{acErrors.username}</p>
                  : <p className="text-xs text-muted-foreground">Sugerimos um nome, mas você pode trocar.</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ac-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="ac-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setAcErrors((p) => ({ ...p, password: undefined })); }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < score
                              ? score <= 1 ? 'bg-red-500' : score === 2 ? 'bg-yellow-500' : score === 3 ? 'bg-blue-500' : 'bg-green-600'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">Força: {STRENGTH_LABELS[score]}</p>
                  </div>
                )}
                {acErrors.password && <p className="text-xs text-destructive">{acErrors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ac-confirm">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="ac-confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setAcErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {acErrors.confirmPassword && <p className="text-xs text-destructive">{acErrors.confirmPassword}</p>}
                {confirmPassword && password === confirmPassword && (
                  <p className="text-[11px] text-green-700 flex items-center gap-1">
                    <Check className="w-3 h-3" /> As senhas conferem
                  </p>
                )}
              </div>

              <Button type="submit" disabled={acLoading} className="w-full bg-ouro text-marinho hover:bg-ouro-escuro font-bold">
                {acLoading ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Ativando…</span>
                ) : (
                  'Criar senha e ativar conta'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

// Cada tela entra com um esmaecer rápido (sem deslocar: o menu lateral é fixo).
const EntradaTela = ({ children }) => {
  const { pathname } = useLocation();
  return (
    <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      {children}
    </motion.div>
  );
};

// Endereço que não existe (Bloco 4, aprovado pelo Diego em 26/10/2026). Antes
// abria o painel sem avisar.
function PaginaNaoEncontrada() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Helmet><title>Página não encontrada - APP OBRA</title></Helmet>
      <div className="text-center max-w-md">
        <p className="text-6xl font-bold text-ouro mb-2" aria-hidden="true">404</p>
        <h1 className="text-2xl font-bold text-marinho mb-3">Página não encontrada</h1>
        <p className="text-muted-foreground mb-6">O endereço que você abriu não existe ou mudou de lugar.</p>
        <RouterLink to="/dashboard">
          <Button className="bg-royal text-white hover:bg-royal/90">Voltar ao início</Button>
        </RouterLink>
      </div>
    </div>
  );
}

// Aviso "Versão nova disponível" (lib/instalarApp.js): fica na tela até a
// pessoa tocar em Atualizar.
function AvisoVersaoNova() {
  useEffect(() => vigiarVersaoNova(() => {
    toast('Versão nova do APP OBRA disponível.', {
      id: 'versao-nova',
      duration: Infinity,
      action: { label: 'Atualizar', onClick: () => window.location.reload() },
    });
  }), []);
  return null;
}

function App() {
  return (
    <CompanyProvider>
      <LanguageProvider>
        <AuthProvider>
          <MotionConfig reducedMotion="user">
          <Router>
            <ScrollToTop />
            <EntradaTela>
            <Routes>
              <Route path="/" element={<SplashScreen />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<ResetPasswordPageInline />} />
              <Route path="/ativar-conta" element={<AtivarContaPageInline />} />
              
              {/* Core 15 Modules */}
              <Route path="/dashboard" element={<ProtectedRoute module="dashboard"><DashboardPage /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute module="obras"><ProjectManagement /></ProtectedRoute>} />
              <Route path="/materiais" element={<ProtectedRoute module="materiais"><MateriaisPage /></ProtectedRoute>} />
              <Route path="/movimentacoes" element={<ProtectedRoute module="movimentacoes"><MovimentacoesPage /></ProtectedRoute>} />
              <Route path="/estoque" element={<ProtectedRoute module="estoque"><EstoqueAlmoxarifadoPage /></ProtectedRoute>} />
              <Route path="/obras/:id" element={<ProtectedRoute module="obras"><ObraPage /></ProtectedRoute>} />
              {/* Andamento por andar/unidade: quem vê cada obra é o servidor que decide (estrutura-obra.pb.js). */}
              <Route path="/obras/:id/andamento" element={<ProtectedRoute><ObraAndamentoPage /></ProtectedRoute>} />
              <Route path="/minha-obra" element={<ProtectedRoute module="minha_obra"><ObraPage minha /></ProtectedRoute>} />
              <Route path="/estoque-obras" element={<ProtectedRoute module="estoque_obras"><EstoqueObrasPage /></ProtectedRoute>} />
              <Route path="/ocorrencias" element={<ProtectedRoute module="ocorrencias"><OcorrenciasPage /></ProtectedRoute>} />
              <Route path="/saldo-funcionario" element={<ProtectedRoute module="saldo_funcionario"><SaldoFuncionarioPage /></ProtectedRoute>} />
              <Route path="/materiais-por-obra" element={<ProtectedRoute module="materiais_obra"><MateriaisObraPage /></ProtectedRoute>} />
              <Route path="/equipamentos" element={<ProtectedRoute module="equipamentos"><EquipamentosPage /></ProtectedRoute>} />
              <Route path="/rh/epis" element={<ProtectedRoute module="epis"><EPIsPage /></ProtectedRoute>} />
              <Route path="/suppliers" element={<ProtectedRoute module="fornecedores"><SuppliersManagement /></ProtectedRoute>} />
              <Route path="/compras" element={<ProtectedRoute module="compras"><ComprasPage /></ProtectedRoute>} />
              <Route path="/compras/:id" element={<ProtectedRoute module="compras"><CompraDetalhesPage /></ProtectedRoute>} />
              <Route path="/compras/:id/editar" element={<ProtectedRoute module="compras"><ComprasPage /></ProtectedRoute>} />
              <Route path="/compras/solicitacoes" element={<Navigate to="/solicitacoes" replace />} />
              <Route path="/solicitacoes" element={<ProtectedRoute module="solicitacoes"><SolicitacoesPage /></ProtectedRoute>} />
              <Route path="/solicitacoes/:id" element={<ProtectedRoute module="solicitacoes"><SolicitacaoDetalhesPage /></ProtectedRoute>} />
              <Route path="/solicitacoes/:id/editar" element={<ProtectedRoute module="solicitacoes"><SolicitacoesPage /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute module="funcionarios"><EmployeeManagement /></ProtectedRoute>} />
              <Route path="/financeiro/dashboard" element={<ProtectedRoute module="financeiro"><DashboardFinanceiro /></ProtectedRoute>} />
              <Route path="/documentos" element={<ProtectedRoute module="documentos"><DocumentsCentralPage /></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute module="relatorios"><ReportsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute module="configuracoes"><SettingsPage /></ProtectedRoute>} />
              <Route path="/auditoria" element={<ProtectedRoute requiredRoles={['admin', 'Administrador', 'Diretoria']}><AuditPage /></ProtectedRoute>} />
              
              {/* Other Routes */}
              <Route path="/notificacoes" element={<ProtectedRoute><PaginaNotificacoes /></ProtectedRoute>} />
              <Route path="/minhas-movimentacoes" element={<ProtectedRoute><MinhasMovimentacoesPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><UserProfilePage /></ProtectedRoute>} />
              <Route path="/admin/security" element={<ProtectedRoute requiredRoles={['admin', 'Administrador']}><AdminSecurityPanel /></ProtectedRoute>} />
              <Route path="/qrcode" element={<ProtectedRoute module="qrcode"><QRCodeModule /></ProtectedRoute>} />
              <Route path="/perdas-ganhos" element={<ProtectedRoute module="perdas_ganhos"><LossesGainsModule /></ProtectedRoute>} />
              <Route path="/financeiro/contas-pagar" element={<ProtectedRoute module="financeiro"><ContasPagar /></ProtectedRoute>} />
              <Route path="/financeiro/contas-receber" element={<ProtectedRoute module="financeiro"><ContasReceberPage /></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute module="comercial"><ClientesPage /></ProtectedRoute>} />
              <Route path="/propostas" element={<ProtectedRoute module="comercial"><PropostasPage /></ProtectedRoute>} />

              {/* Cadastro de Empresas */}
              <Route path="/empresas" element={<ProtectedRoute module="empresas"><EmpresasPage /></ProtectedRoute>} />
              <Route path="/empresas/:id" element={<ProtectedRoute module="empresas"><EmpresaDetalhesPage /></ProtectedRoute>} />
              <Route path="/empresas/:id/editar" element={<ProtectedRoute module="empresas"><EmpresasPage /></ProtectedRoute>} />

              {/* Cadastro de Usuários */}
              <Route path="/usuarios" element={<ProtectedRoute requiredRoles={['admin', 'Administrador']}><UsuariosPage /></ProtectedRoute>} />
              <Route path="/usuarios/:id" element={<ProtectedRoute requiredRoles={['admin', 'Administrador']}><UsuarioDetalhesPage /></ProtectedRoute>} />
              <Route path="/usuarios/:id/editar" element={<ProtectedRoute requiredRoles={['admin', 'Administrador']}><UsuariosPage /></ProtectedRoute>} />
              
              {/* RH Sub-routes */}
              <Route path="/trainings" element={<ProtectedRoute module="rh"><TreinamentosPage /></ProtectedRoute>} />
              <Route path="/rh/equipes" element={<ProtectedRoute module="rh"><EquipesPage /></ProtectedRoute>} />
              {/* Escalas, Licenciamento e Quilometragem: telas "em desenvolvimento" escondidas
                  até ficarem prontas (Bloco 4; ver docs/ideias-futuras.md). */}
              <Route path="/rh/documentos" element={<ProtectedRoute module="rh"><DocumentosPage /></ProtectedRoute>} />
              
              {/* Frota Sub-routes */}
              <Route path="/frota/dashboard" element={<ProtectedRoute module="frota"><FrotaDashboardPage /></ProtectedRoute>} />
              <Route path="/frota/veiculos" element={<ProtectedRoute module="frota"><VeiculosPage /></ProtectedRoute>} />
              <Route path="/frota/abastecimentos" element={<ProtectedRoute module="frota"><AbastecimentosPage /></ProtectedRoute>} />
              <Route path="/frota/manutencoes" element={<ProtectedRoute module="frota"><ManutencoesFrotaPage /></ProtectedRoute>} />
              
              {/* Catch-all */}
              <Route path="*" element={<PaginaNaoEncontrada />} />
            </Routes>
            </EntradaTela>
            <Toaster position="top-right" richColors />
            <AvisoVersaoNova />
          </Router>
          </MotionConfig>
        </AuthProvider>
      </LanguageProvider>
    </CompanyProvider>
  );
}

export default App;
