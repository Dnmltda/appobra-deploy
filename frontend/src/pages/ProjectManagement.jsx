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
import { Plus, Users, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext.jsx';

const ProjectManagement = () => {
  const { currentUser } = useAuth();
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
    dataFim: ''
  });

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
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load projects');
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
        toast.success('Project updated successfully');
      } else {
        await pb.collection('obras').create(data, { $autoCancel: false });
        toast.success('Project created successfully');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      nome: project.nome,
      descricao: project.descricao || '',
      status: project.status || 'Planejamento',
      dataInicio: project.dataInicio || '',
      dataFim: project.dataFim || ''
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
      toast.error('Failed to load team');
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
      
      toast.success('Employee allocated successfully');
      setAllocateDialogOpen(false);
      setAllocateData({ employeeId: '' });
      fetchData();
    } catch (error) {
      console.error('Error allocating employee:', error);
      toast.error('Failed to allocate employee');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      status: 'Planejamento',
      dataInicio: '',
      dataFim: ''
    });
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
            <h1 className="text-3xl font-bold mb-2">Gestão de Obras</h1>
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
              No projects found. Create your first project to get started.
            </div>
          ) : (
            projects.map(project => (
              <Card key={project.id}>
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
                      <span className="text-muted-foreground">Team Size:</span>
                      <span className="font-medium">{getTeamSize(project.id)} membros</span>
                    </div>
                    {project.dataInicio && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Start:</span>
                        <span>{new Date(project.dataInicio).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openAllocateDialog(project)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Allocate
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => viewTeam(project)}>
                      <Users className="w-4 h-4 mr-1" />
                      Ver Equipe
                    </Button>
                  </div>
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
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      employee.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {employee.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alocar Funcionário em {selectedProject?.nome}</DialogTitle>
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
                <Button type="submit">Alocar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default ProjectManagement;
