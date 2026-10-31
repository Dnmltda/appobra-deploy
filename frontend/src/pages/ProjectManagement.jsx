import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users, Pencil, Building2, UserMinus, ArrowRight, Layers } from 'lucide-react';
import IconeModulo3D from '@/components/marca/IconeModulo3D.jsx';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { t } from '@/lib/translations.js';
import { mensagemErro } from '@/lib/erros.js';
import { podeEditarEstrutura } from '@/lib/permissoes.js';

const ProjectManagement = () => {
  const { currentUser } = useAuth();
  const { language } = useLanguage();
  // Estrutura (andares/unidades) só na obra nova; obra existente monta pela tela de andamento.
  const [estrutura, setEstrutura] = useState({ tipo: 'Sem estrutura', andares: '', quartos: '' });
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedProjectTeam, setSelectedProjectTeam] = useState([]);
  const [editingProject, setEditingProject] = useState(null);

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    status: 'Planejamento',
    dataInicio: '',
    dataFim: '',
    clientes_acesso: []
  });
  // Acessos com cargo Cliente: o administrador escolhe quem acompanha cada obra
  // (o Cliente só vê as obras marcadas; pb_hooks/obras-cliente.pb.js).
  const [clientes, setClientes] = useState([]);

  const [allocateData, setAllocateData] = useState({
    employeeId: ''
  });

  useEffect(() => {
    if (currentUser?.company_id) {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser?.company_id) {
      toast.error('Empresa não identificada');
      setLoading(false);
      return;
    }

    try {
      const [projectsData, employeesData] = await Promise.all([
        pb.collection('obras').getFullList({ 
          filter: `company_id = "${currentUser.company_id}"`,
          sort: '-created', 
          $autoCancel: false 
        }),
        pb.collection('funcionarios').getFullList({ 
          filter: `company_id = "${currentUser.company_id}"`,
          expand: 'cargoId', 
          $autoCancel: false 
        })
      ]);
      setProjects(projectsData);
      setEmployees(employeesData);
      pb.collection('users').getFullList({
        filter: `company_id = "${currentUser.company_id}" && cargo = "Cliente" && status = "Ativo"`,
        sort: 'name', $autoCancel: false
      }).then(setClientes).catch(() => setClientes([]));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Não foi possível carregar as obras');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser?.company_id) {
      toast.error('Empresa não selecionada');
      return;
    }

    try {
      const data = {
        ...formData,
        company_id: currentUser.company_id,
        descricao: formData.descricao || null,
        dataInicio: formData.dataInicio || null,
        dataFim: formData.dataFim || null
      };

      if (editingProject) {
        await pb.collection('obras').update(editingProject.id, data, { $autoCancel: false });
        toast.success('Obra atualizada');
      } else {
        const nova = await pb.collection('obras').create(data, { $autoCancel: false });
        toast.success('Obra cadastrada');
        if (estrutura.tipo === 'Prédio' || estrutura.tipo === 'Casa') {
          try {
            await pb.send('/api/custom/estrutura/gerar', {
              method: 'POST', $autoCancel: false,
              body: estrutura.tipo === 'Prédio'
                ? { obra_id: nova.id, tipo: 'Prédio', andares: Number(estrutura.andares) }
                : { obra_id: nova.id, tipo: 'Casa', quartos: Number(estrutura.quartos || 0), comodos: ['Cozinha', 'Sala', 'Banheiro'] },
            });
            toast.success(t('est_montada', language));
          } catch (err) {
            toast.error(mensagemErro(err, t('est_erroSalvar', language)));
          }
        }
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Não foi possível salvar a obra');
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      nome: project.nome,
      descricao: project.descricao || '',
      status: project.status || 'Planejamento',
      dataInicio: project.dataInicio || '',
      dataFim: project.dataFim || '',
      clientes_acesso: project.clientes_acesso || []
    });
    setDialogOpen(true);
  };

  const viewTeam = async (project) => {
    try {
      const team = await pb.collection('funcionarios').getFullList({
        filter: `obraId = "${project.id}" && company_id = "${currentUser.company_id}"`,
        expand: 'cargoId',
        $autoCancel: false
      });
      setSelectedProjectTeam(team);
      setSelectedProject(project);
      setTeamDialogOpen(true);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast.error('Não foi possível carregar a equipe');
    }
  };

  const openAllocateDialog = (project) => {
    setSelectedProject(project);
    setAllocateDialogOpen(true);
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    try {
      await pb.collection('funcionarios').update(allocateData.employeeId, {
        obraId: selectedProject.id
      }, { $autoCancel: false });
      
      toast.success('Funcionário alocado na obra');
      setAllocateDialogOpen(false);
      setAllocateData({ employeeId: '' });
      fetchData();
    } catch (error) {
      console.error('Error allocating employee:', error);
      toast.error('Não foi possível alocar o funcionário');
    }
  };

  // Tirar da obra: o funcionário fica sem obra (pedido do Diego, 19/10/2026).
  const tirarDaObra = async (employee) => {
    try {
      await pb.collection('funcionarios').update(employee.id, { obraId: '' }, { $autoCancel: false });
      setSelectedProjectTeam((t) => t.filter((e) => e.id !== employee.id));
      toast.success(`${employee.nome} saiu da obra`);
      fetchData();
    } catch (error) {
      console.error('Error removing employee:', error);
      toast.error('Não foi possível tirar o funcionário da obra');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      status: 'Planejamento',
      dataInicio: '',
      dataFim: '',
      clientes_acesso: []
    });
    setEstrutura({ tipo: 'Sem estrutura', andares: '', quartos: '' });
    setEditingProject(null);
  };

  const getTeamSize = (projectId) => {
    return employees.filter(emp => emp.obraId === projectId).length;
  };

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Gestão de Obras - DNM&LTDA</title>
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
        <title>Gestão de Obras - DNM&LTDA</title>
        <meta name="description" content="Gerencie obras e alocação de equipes" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-marinho flex items-center gap-3"><IconeModulo3D icon={Building2} />Gestão de Obras</h1>
            <p className="text-muted-foreground">Gerencie obras e aloque equipes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Obra
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProject ? 'Editar Obra' : 'Nova Obra'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Obra</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                    className="text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={3}
                    className="text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Planejamento">Planejamento</SelectItem>
                      <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                      <SelectItem value="Pausada">Pausada</SelectItem>
                      <SelectItem value="Concluída">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataInicio">Data de Início</Label>
                    <Input
                      id="dataInicio"
                      type="date"
                      value={formData.dataInicio}
                      onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dataFim">Data de Término</Label>
                    <Input
                      id="dataFim"
                      type="date"
                      value={formData.dataFim}
                      onChange={(e) => setFormData({ ...formData, dataFim: e.target.value })}
                      className="text-foreground"
                    />
                  </div>
                </div>
                {!editingProject && podeEditarEstrutura(currentUser) && (
                  <div className="space-y-2">
                    <Label htmlFor="tipo_estrutura">{t('est_tipoEstrutura', language)}</Label>
                    <Select value={estrutura.tipo} onValueChange={(v) => setEstrutura({ ...estrutura, tipo: v })}>
                      <SelectTrigger id="tipo_estrutura"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sem estrutura">{t('est_semEstrutura', language)}</SelectItem>
                        <SelectItem value="Prédio">{t('est_predio', language)}</SelectItem>
                        <SelectItem value="Casa">{t('est_casa', language)}</SelectItem>
                      </SelectContent>
                    </Select>
                    {estrutura.tipo === 'Prédio' && (
                      <Input id="est_andares_form" type="number" min="1" max="200" inputMode="numeric" required placeholder={t('est_quantosAndares', language)}
                        value={estrutura.andares} onChange={(e) => setEstrutura({ ...estrutura, andares: e.target.value })} />
                    )}
                    {estrutura.tipo === 'Casa' && (
                      <Input id="est_quartos_form" type="number" min="0" max="30" inputMode="numeric" placeholder={t('est_quantosQuartos', language)}
                        value={estrutura.quartos} onChange={(e) => setEstrutura({ ...estrutura, quartos: e.target.value })} />
                    )}
                  </div>
                )}
                {clientes.length > 0 && (
                  <div className="space-y-2">
                    <Label>Clientes que acompanham esta obra</Label>
                    <div className="space-y-1 max-h-32 overflow-y-auto rounded-md border p-2">
                      {clientes.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={formData.clientes_acesso.includes(c.id)}
                            onChange={(e) => setFormData({
                              ...formData,
                              clientes_acesso: e.target.checked
                                ? [...formData.clientes_acesso, c.id]
                                : formData.clientes_acesso.filter((x) => x !== c.id)
                            })}
                          />
                          {c.name || c.username}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">O cliente só vê as obras marcadas aqui.</p>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">{editingProject ? 'Atualizar' : 'Criar'} Obra</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Nenhuma obra cadastrada ainda. Clique em "Nova Obra" para começar.
            </div>
          ) : (
            projects.map(project => (
              <Card key={project.id} className="overflow-hidden">
                <Link to={`/obras/${project.id}`} className="block bg-muted aspect-[16/9]" aria-label={`Abrir obra ${project.nome}`}>
                  {project.fotos?.length ? (
                    <img src={pb.files.getURL(project, project.fotos[0])} alt={`Foto da obra ${project.nome}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-muted-foreground"><Building2 className="w-10 h-10 opacity-40" /></span>
                  )}
                </Link>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{project.nome}</span>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(project)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{project.descricao}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        project.status === 'Em Andamento' ? 'bg-blue-100 text-blue-800' :
                        project.status === 'Concluída' ? 'bg-green-100 text-green-800' :
                        project.status === 'Pausada' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Equipe:</span>
                      <span className="font-medium">{getTeamSize(project.id)} membros</span>
                    </div>
                    {project.dataInicio && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Início:</span>
                        <span>{new Date(project.dataInicio).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openAllocateDialog(project)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Colocar funcionário
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => viewTeam(project)}>
                      <Users className="w-4 h-4 mr-1" />
                      Ver Equipe
                    </Button>
                  </div>
                  {(project.tipo_estrutura === 'Prédio' || project.tipo_estrutura === 'Casa') && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('est_progresso', language)}:</span>
                        <span className="font-semibold">{Math.round(project.progress_percentage || 0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-royal" style={{ width: `${Math.min(100, project.progress_percentage || 0)}%` }} /></div>
                    </div>
                  )}
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to={`/obras/${project.id}/andamento`}><Layers className="w-4 h-4 mr-1" />{t('est_andamento', language)}</Link>
                  </Button>
                  <Button asChild size="sm" className="w-full">
                    <Link to={`/obras/${project.id}`}>Abrir obra: fotos e mural<ArrowRight className="w-4 h-4 ml-1" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Equipe - {selectedProject?.nome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {selectedProjectTeam.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum funcionário alocado a esta obra</p>
              ) : (
                selectedProjectTeam.map(employee => (
                  <div key={employee.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{employee.nome}</p>
                      <p className="text-sm text-muted-foreground">{employee.expand?.cargoId?.nome || 'Cargo desconhecido'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        employee.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {employee.status}
                      </span>
                      <Button size="sm" variant="ghost" title="Tirar da obra" onClick={() => tirarDaObra(employee)}>
                        <UserMinus className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Colocar funcionário em {selectedProject?.nome}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAllocate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Selecionar Funcionário</Label>
                <Select value={allocateData.employeeId} onValueChange={(value) => setAllocateData({ employeeId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter(emp => !emp.obraId || emp.obraId === selectedProject?.id).map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome} - {emp.expand?.cargoId?.nome || 'Cargo desconhecido'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAllocateDialogOpen(false)}>Cancelar</Button>
                <Button type="submit">Colocar na obra</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default ProjectManagement;
