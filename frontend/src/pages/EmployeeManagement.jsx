import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, GraduationCap, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { auditLog, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/auditLogger.js';

// A collection "users" (login) só aceita estes valores no campo cargo (SelectField
// definido em pb_migrations/..._add_cargo_to_users.js e expandido em
// pb_migrations/1792300000_add_novos_cargos_e_faxina.js). Cada cargo tem seu
// próprio conjunto de permissões (ver ROLE_MODULE_PERMISSIONS em
// components/ProtectedRoute.jsx e components/Sidebar.jsx). Um cargo de obra
// que não esteja nesta lista cai no valor genérico "Funcionário" ao criar o
// login, senão o PocketBase rejeita com "validation_invalid_value".
const CARGOS_LOGIN_PERMITIDOS = ['Administrador', 'Funcionário', 'Engenheiro', 'Almoxarife', 'Mestre de Obras', 'Pedreiro', 'Servente', 'Encanador', 'Eletricista', 'Faxina'];
const mapCargoParaLogin = (cargoObra) => CARGOS_LOGIN_PERMITIDOS.includes(cargoObra) ? cargoObra : 'Funcionário';

// Hierarquia dentro do cargo (pedido do Diego). Cargos de execução de obra
// usam Ajudante/Oficial/Encarregado; cargos técnicos/administrativos usam
// Júnior/Pleno/Sênior. O campo "hierarquia" na collection "funcionarios"
// (pb_migrations/1792700000_add_hierarquia_funcionarios.js) aceita os dois
// conjuntos de valores — esta tela decide qual oferecer pelo cargo escolhido.
const CARGOS_OBRA = ['Servente', 'Pedreiro', 'Encanador', 'Eletricista', 'Mestre de Obras', 'Faxina'];
const HIERARQUIA_OPCOES = {
  obra: ['Ajudante', 'Oficial', 'Encarregado'],
  tecnico: ['Júnior', 'Pleno', 'Sênior']
};
const cargoGroup = (cargoNome) => CARGOS_OBRA.includes(cargoNome) ? 'obra' : 'tecnico';

// Gera username automático baseado no NOME (não no email).
// Normaliza acentos, usa primeiro + último nome separados por ponto e
// garante unicidade consultando a collection "users".
const normalizeNameForUsername = (nome) => {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
};

const generateUsernameFromName = async (nome) => {
  const parts = normalizeNameForUsername(nome);
  if (parts.length === 0) parts.push('funcionario');
  let base;
  if (parts.length === 1) {
    base = parts[0];
  } else {
    base = `${parts[0]}.${parts[parts.length - 1]}`;
  }
  base = base.slice(0, 38);

  let username = base;
  let suffix = 1;
  while (suffix <= 99) {
    try {
      const res = await pb.collection('users').getList(1, 1, {
        filter: `username = "${username}"`,
        $autoCancel: false,
      });
      if (res.totalItems === 0) return username;
    } catch {
      return username;
    }
    suffix += 1;
    username = `${base}${suffix}`.slice(0, 40);
  }
  return `${base}${Date.now().toString().slice(-4)}`.slice(0, 40);
};

const formatCPF = (value) => {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const isValidCPF = (cpf) => {
  const digits = String(cpf || '').replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i], 10) * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== parseInt(digits[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 === 10) check2 = 0;
  return check2 === parseInt(digits[10], 10);
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim().toLowerCase());
};

// Senha interna, descartável, usada só para satisfazer a exigência do
// PocketBase de que toda conta tenha uma senha ao ser criada. Nunca é
// mostrada para ninguém (nem admin, nem funcionário) — a conta fica
// "Inativa" até o próprio funcionário definir a senha de verdade pelo
// link de convite (ver criarAcessoParaFuncionario abaixo).
const generateTempPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const nums = '23456789';
  const sym = '!@#$%&*';
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  let pwd =
    pick(upper) + pick(lower) + pick(nums) + pick(sym) +
    Array.from({ length: 6 }, () => pick(upper + lower + nums + sym)).join('');
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
};

// Token de convite com validade de 7 dias — mesmo mecanismo de
// password_reset_token/password_reset_expires já usado em "esqueci minha
// senha" (ver AuthContext.jsx -> requestPasswordReset), só que gerado no
// momento da criação do acesso, não depois de uma solicitação do usuário.
const generateInviteToken = () => {
  const token = crypto.randomUUID();
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  return { token, expires: expires.toISOString() };
};

const emptyForm = {
  matricula: '',
  nome: '',
  cpf: '',
  email: '',
  cargoId: '',
  hierarquia: '',
  departamento: '',
  telefone: '',
  obraId: 'none',
  status: 'Ativo',
  dataAdmissao: ''
};

const EmployeeManagement = () => {
  const { currentUser, createUser } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [criarAcesso, setCriarAcesso] = useState(false);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [selectedEmployeeTrainings, setSelectedEmployeeTrainings] = useState([]);
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProject, setFilterProject] = useState('all');

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (currentUser?.company_id) {
      refreshEmployeeList();
    }
  }, [currentUser]);

  useEffect(() => {
    const handleUsersUpdated = () => {
      if (currentUser?.company_id) {
        refreshEmployeeList();
      }
    };
    window.addEventListener('usersUpdated', handleUsersUpdated);
    return () => window.removeEventListener('usersUpdated', handleUsersUpdated);
  }, [currentUser]);

  const refreshEmployeeList = async () => {
    if (!currentUser?.company_id) return;
    setLoading(true);
    try {
      const [employeesData, cargosData, obrasData] = await Promise.all([
        pb.collection('funcionarios').getFullList({
          filter: `company_id = "${currentUser.company_id}"`,
          expand: 'cargoId,obraId',
          sort: '-created',
          $autoCancel: false
        }),
        pb.collection('cargos').getFullList({ $autoCancel: false }),
        pb.collection('obras').getFullList({
          filter: `company_id = "${currentUser.company_id}"`,
          $autoCancel: false
        })
      ]);
      setEmployees(employeesData);
      setCargos(cargosData);
      setObras(obrasData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Falha ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  // Verifica unicidade do CPF na collection funcionarios (mesma empresa).
  // Compara tanto o valor mascarado quanto o limpo, para compatibilidade
  // com registros antigos que possam estar em qualquer dos formatos.
  const isCpfUnique = async (cpf, excludeId = null) => {
    const clean = String(cpf || '').replace(/\D/g, '');
    if (!clean) return true;
    const masked = formatCPF(clean);
    let filter = `(cpf = "${masked}" || cpf = "${clean}")`;
    if (excludeId) filter += ` && id != "${excludeId}"`;
    try {
      const res = await pb.collection('funcionarios').getList(1, 1, {
        filter,
        $autoCancel: false,
      });
      return res.totalItems === 0;
    } catch {
      return true;
    }
  };

  // Verifica unicidade do email na collection users (login).
  const isEmailUniqueInUsers = async (email) => {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return true;
    try {
      const res = await pb.collection('users').getList(1, 1, {
        filter: `email = "${clean}"`,
        $autoCancel: false,
      });
      return res.totalItems === 0;
    } catch {
      return true;
    }
  };

  const criarAcessoParaFuncionario = async (funcionario, cargoNome) => {
    if (!funcionario.email) {
      toast.error('Não foi possível criar o acesso: o funcionário não tem email cadastrado.');
      return false;
    }
    if (!isValidEmail(funcionario.email)) {
      toast.error('Não foi possível criar o acesso: o email do funcionário é inválido.');
      return false;
    }

    const emailUnique = await isEmailUniqueInUsers(funcionario.email);
    if (!emailUnique) {
      toast.error('Funcionário salvo, mas o acesso não pôde ser criado: já existe um usuário com este email.');
      return false;
    }

    const descartavel = generateTempPassword();
    const username = await generateUsernameFromName(funcionario.nome);
    const { token: inviteToken, expires: inviteExpires } = generateInviteToken();

    try {
      await createUser({
        email: funcionario.email,
        password: descartavel,
        passwordConfirm: descartavel,
        name: funcionario.nome,
        username,
        cargo: mapCargoParaLogin(cargoNome),
        role: mapCargoParaLogin(cargoNome),
        telefone: funcionario.telefone,
        company_id: currentUser.company_id,
        funcionario_id: funcionario.id,
        // Conta criada "Inativa" + com token de convite: o funcionário só
        // consegue logar depois de confirmar os dados e criar a própria
        // senha em /ativar-conta (ver pb_hooks/activate-invite.pb.js).
        status: 'Inativo',
        password_reset_token: inviteToken,
        password_reset_expires: inviteExpires
      });

      // O hook send-welcome-email.pb.js detecta o password_reset_token e
      // envia automaticamente o email de convite com o link de ativação —
      // nenhuma senha passa pelo admin ou aparece na tela.
      toast.success(
        `Funcionário salvo e convite enviado para ${funcionario.email}. ` +
        `Ele vai confirmar os dados e criar a própria senha pelo link recebido por email.`,
        { duration: 12000 }
      );

      await auditLog(
        AUDIT_ACTIONS.USER_CREATED,
        AUDIT_MODULES.USERS,
        `Convite de acesso enviado a partir do funcionário: ${funcionario.nome} (user: ${username}) — vínculo funcionario_id=${funcionario.id}`,
        'success'
      );
      return true;
    } catch (error) {
      console.error('Error creating login for employee:', error);
      const msg = error.data?.message || error.message || 'Erro ao criar acesso do funcionário';
      toast.error(`Funcionário salvo, mas o acesso ao sistema não pôde ser criado: ${msg}`);
      return false;
    }
  };

  const handleFotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('A foto deve ter no máximo 20MB.');
      return;
    }
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const removeFoto = () => {
    setFotoFile(null);
    setFotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser?.company_id) {
      toast.error('Empresa não identificada');
      return;
    }

    // --- Validações ---
    if (!formData.nome || formData.nome.trim().length < 3) {
      toast.error('Nome completo é obrigatório (mínimo 3 caracteres).');
      return;
    }

    if (!formData.cpf) {
      toast.error('CPF é obrigatório.');
      return;
    }
    if (!isValidCPF(formData.cpf)) {
      toast.error('CPF inválido. Confira os números digitados.');
      return;
    }

    if (criarAcesso && !formData.email) {
      toast.error('Email é obrigatório quando "Criar acesso ao sistema" está marcado.');
      return;
    }
    if (formData.email && !isValidEmail(formData.email)) {
      toast.error('Email inválido.');
      return;
    }

    // Unicidade do CPF
    const cpfOk = await isCpfUnique(formData.cpf, editingEmployee?.id);
    if (!cpfOk) {
      toast.error('Já existe um funcionário cadastrado com este CPF.');
      return;
    }

    // Unicidade do email no login (se for criar acesso)
    if (criarAcesso && formData.email) {
      const emailOk = await isEmailUniqueInUsers(formData.email);
      if (!emailOk) {
        toast.error('Já existe um usuário com este email. Não é possível criar o acesso.');
        return;
      }
    }

    setSubmitting(true);
    try {
      // O ID (01, 02...) é dado pelo servidor por ordem de chegada na empresa
      // (pb_hooks/id-tempo-de-casa.pb.js); a tela não gera mais "FUN-000001".

      // Usa FormData para permitir upload da foto (campo file).
      const fd = new FormData();
      fd.append('matricula', formData.matricula);
      fd.append('nome', formData.nome.trim());
      fd.append('nome_completo', formData.nome.trim());
      fd.append('company_id', currentUser.company_id);
      fd.append('cargoId', formData.cargoId || '');
      fd.append('hierarquia', formData.hierarquia || '');
      fd.append('departamento', formData.departamento || '');
      fd.append('telefone', formData.telefone || '');
      fd.append('obraId', formData.obraId === 'none' ? '' : formData.obraId);
      fd.append('status', formData.status);
      fd.append('dataAdmissao', formData.dataAdmissao || '');
      fd.append('cpf', formData.cpf || '');
      fd.append('email', formData.email || '');

      if (fotoFile) {
        fd.append('foto', fotoFile);
      }

      let novoFuncionario;
      if (editingEmployee) {
        novoFuncionario = await pb.collection('funcionarios').update(editingEmployee.id, fd, { $autoCancel: false });
        toast.success('Funcionário atualizado com sucesso');
        await auditLog(
          AUDIT_ACTIONS.RECORD_UPDATED,
          AUDIT_MODULES.EMPLOYEES,
          `Funcionário editado: ${formData.nome} (ID ${editingEmployee.id})`,
          'success'
        );
      } else {
        novoFuncionario = await pb.collection('funcionarios').create(fd, { $autoCancel: false });
        toast.success('Funcionário adicionado com sucesso');
        await auditLog(
          AUDIT_ACTIONS.RECORD_CREATED,
          AUDIT_MODULES.EMPLOYEES,
          `Funcionário criado: ${formData.nome} (ID ${novoFuncionario.id})`,
          'success'
        );

        if (criarAcesso) {
          const cargoNome = cargos.find(c => c.id === formData.cargoId)?.nome;
          await criarAcessoParaFuncionario(novoFuncionario, cargoNome);
        }
      }

      setDialogOpen(false);
      resetForm();
      refreshEmployeeList();
    } catch (error) {
      console.error('Error saving employee:', error);
      const msg = error.data?.message || error.message || 'Erro ao salvar funcionário';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      matricula: employee.matricula || '',
      nome: employee.nome || '',
      cpf: employee.cpf ? formatCPF(employee.cpf.replace(/\D/g, '')) : '',
      email: employee.email || '',
      cargoId: employee.cargoId || '',
      hierarquia: employee.hierarquia || '',
      departamento: employee.departamento || '',
      telefone: employee.telefone || '',
      obraId: employee.obraId || 'none',
      status: employee.status || 'Ativo',
      dataAdmissao: employee.dataAdmissao ? String(employee.dataAdmissao).split('T')[0] : ''
    });
    // Pré-visualiza foto existente
    if (employee.foto) {
      try {
        setFotoPreview(pb.files.getURL(employee, employee.foto));
      } catch {
        setFotoPreview(null);
      }
    } else {
      setFotoPreview(null);
    }
    setFotoFile(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id, nome) => {
    try {
      await pb.collection('funcionarios').delete(id, { $autoCancel: false });
      toast.success('Funcionário excluído com sucesso');
      await auditLog(
        AUDIT_ACTIONS.RECORD_DELETED,
        AUDIT_MODULES.EMPLOYEES,
        `Funcionário excluído: ${nome || id} (ID ${id})`,
        'success'
      );
      refreshEmployeeList();
    } catch (error) {
      console.error('Error deleting employee:', error, {
        status: error?.status,
        data: error?.data,
        message: error?.data?.message || error?.message,
      });
      const msg = error?.data?.message || 'Não foi possível excluir o funcionário. Verifique suas permissões ou tente novamente.';
      toast.error(msg);
    }
  };

  const viewTrainingHistory = async (employee) => {
    if (!currentUser?.company_id) return;
    try {
      const trainings = await pb.collection('treinamentos').getFullList({
        filter: `funcionarioId = "${employee.id}" && company_id = "${currentUser.company_id}"`,
        sort: '-dataValidade',
        $autoCancel: false
      });
      setSelectedEmployeeTrainings(trainings);
      setTrainingDialogOpen(true);
    } catch (error) {
      console.error('Error fetching trainings:', error);
      toast.error('Não foi possível carregar o histórico de treinamentos');
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingEmployee(null);
    setCriarAcesso(false);
    setFotoFile(null);
    setFotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filteredEmployees = employees.filter(emp => {
    if (filterRole !== 'all' && emp.cargoId !== filterRole) return false;
    if (filterStatus !== 'all' && emp.status !== filterStatus) return false;
    if (filterProject !== 'all' && emp.obraId !== filterProject) return false;
    return true;
  });

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Gestão de Funcionários - DNM&LTDA</title>
        </Helmet>
        <Header />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-64 mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Gestão de Funcionários - DNM&LTDA</title>
        <meta name="description" content="Gerencie funcionários e suas alocações" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Gestão de Funcionários</h1>
            <p className="text-muted-foreground">Gerencie sua equipe de obra</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Funcionário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? 'Editar Funcionário' : 'Adicionar Novo Funcionário'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Seção 1: Dados Pessoais */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary border-b pb-2">Dados Pessoais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="matricula">ID do Funcionário *</Label>
                      <Input
                        id="matricula"
                        value={formData.matricula}
                        onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                        required
                        className="text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome Completo *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        required
                        className="text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        required
                        className="text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telefone">Telefone</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        className="text-foreground"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="foto">Foto</Label>
                      <div className="flex items-center gap-4">
                        {fotoPreview && (
                          <div className="relative">
                            <img
                              src={fotoPreview}
                              alt="Pré-visualização"
                              className="w-20 h-20 rounded-lg object-cover border"
                            />
                            <button
                              type="button"
                              onClick={removeFoto}
                              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 shadow"
                              title="Remover foto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            ref={fileInputRef}
                            id="foto"
                            type="file"
                            accept="image/*"
                            onChange={handleFotoChange}
                            className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer hover:file:bg-primary/90"
                          />
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Upload className="w-3 h-3" /> JPG/PNG/WebP — máx 20MB
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção 2: Dados Profissionais */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary border-b pb-2">Dados Profissionais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cargoId">Cargo</Label>
                      <Select
                        value={formData.cargoId}
                        onValueChange={(value) => {
                          const novoCargoNome = cargos.find(c => c.id === value)?.nome;
                          const opcoesAntigas = HIERARQUIA_OPCOES[cargoGroup(cargos.find(c => c.id === formData.cargoId)?.nome)];
                          const opcoesNovas = HIERARQUIA_OPCOES[cargoGroup(novoCargoNome)];
                          setFormData({
                            ...formData,
                            cargoId: value,
                            // Ao trocar de cargo pra um grupo de hierarquia diferente
                            // (ex.: de "Pedreiro" pra "Engenheiro"), limpa a hierarquia
                            // escolhida — os valores (Ajudante/Oficial/Encarregado vs
                            // Júnior/Pleno/Sênior) não se misturam entre os grupos.
                            hierarquia: opcoesNovas === opcoesAntigas ? formData.hierarquia : ''
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          {cargos.map(cargo => (
                            <SelectItem key={cargo.id} value={cargo.id}>{cargo.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hierarquia">Hierarquia</Label>
                      <Select
                        value={formData.hierarquia}
                        onValueChange={(value) => setFormData({ ...formData, hierarquia: value })}
                        disabled={!formData.cargoId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={formData.cargoId ? "Selecione o nível" : "Escolha o cargo primeiro"} />
                        </SelectTrigger>
                        <SelectContent>
                          {HIERARQUIA_OPCOES[cargoGroup(cargos.find(c => c.id === formData.cargoId)?.nome)].map(nivel => (
                            <SelectItem key={nivel} value={nivel}>{nivel}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="departamento">Departamento</Label>
                      <Input
                        id="departamento"
                        value={formData.departamento}
                        onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                        placeholder="Ex.: Operações, Administrativo..."
                        className="text-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="obraId">Obra</Label>
                      <Select value={formData.obraId} onValueChange={(value) => setFormData({ ...formData, obraId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a obra" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {obras.map(obra => (
                            <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Ativo">Ativo</SelectItem>
                          <SelectItem value="Inativo">Inativo</SelectItem>
                          <SelectItem value="Afastado">Afastado</SelectItem>
                          <SelectItem value="Demitido">Demitido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dataAdmissao">Data de Admissão</Label>
                      <Input
                        id="dataAdmissao"
                        type="date"
                        value={formData.dataAdmissao}
                        onChange={(e) => setFormData({ ...formData, dataAdmissao: e.target.value })}
                        className="text-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 3: Acesso ao Sistema */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary border-b pb-2">Acesso ao Sistema</h3>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email {criarAcesso ? '*' : ''}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required={criarAcesso}
                      className="text-foreground"
                    />
                  </div>
                  {!editingEmployee && (
                    <div className="flex items-start gap-2 rounded-md border p-3">
                      <Checkbox
                        id="criarAcesso"
                        checked={criarAcesso}
                        onCheckedChange={(checked) => setCriarAcesso(checked === true)}
                      />
                      <div>
                        <Label htmlFor="criarAcesso" className="cursor-pointer">Criar acesso ao sistema (login) para este funcionário</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Requer email preenchido. Será gerado um username automático (baseado no nome) e enviado um
                          convite por email: o próprio funcionário confirma os dados e cria a sua senha pelo link recebido.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancelar</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</span>
                    ) : (
                      editingEmployee ? 'Atualizar Funcionário' : 'Adicionar Funcionário'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Cargos</SelectItem>
                    {cargos.map(cargo => (
                      <SelectItem key={cargo.id} value={cargo.id}>{cargo.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                    <SelectItem value="Afastado">Afastado</SelectItem>
                    <SelectItem value="Demitido">Demitido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Obra</Label>
                <Select value={filterProject} onValueChange={setFilterProject}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Obras</SelectItem>
                    {obras.map(obra => (
                      <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum funcionário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEmployees.map(employee => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.matricula}</TableCell>
                      <TableCell>{employee.nome}</TableCell>
                      <TableCell>
                        {employee.expand?.cargoId?.nome || '-'}
                        {employee.hierarquia && (
                          <span className="text-xs text-muted-foreground block">{employee.hierarquia}</span>
                        )}
                      </TableCell>
                      <TableCell>{employee.departamento || '-'}</TableCell>
                      <TableCell>{employee.telefone || '-'}</TableCell>
                      <TableCell>{employee.expand?.obraId?.nome || '-'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          employee.status === 'Ativo' ? 'bg-green-100 text-green-800' :
                          employee.status === 'Inativo' ? 'bg-gray-100 text-gray-800' :
                          employee.status === 'Demitido' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {employee.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => viewTrainingHistory(employee)}>
                            <GraduationCap className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(employee)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Funcionário</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir {employee.nome}? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(employee.id, employee.nome)}>Excluir</AlertDialogAction>
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

        <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Histórico de Treinamentos</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedEmployeeTrainings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum treinamento encontrado</p>
              ) : (
                selectedEmployeeTrainings.map(training => (
                  <div key={training.id} className="p-4 rounded-lg border">
                    <p className="font-medium">{training.curso}</p>
                    <p className="text-sm text-muted-foreground">Válido até: {new Date(training.dataValidade).toLocaleDateString('pt-BR')}</p>
                    <p className="text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        new Date(training.dataValidade) >= new Date() ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {new Date(training.dataValidade) >= new Date() ? 'Válido' : 'Expirado'}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default EmployeeManagement;
