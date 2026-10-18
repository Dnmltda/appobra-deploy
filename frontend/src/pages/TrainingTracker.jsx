import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext.jsx';

const TrainingTracker = () => {
  const { currentUser } = useAuth();
  const [trainings, setTrainings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const [formData, setFormData] = useState({
    funcionarioId: '',
    curso: '',
    dataValidade: ''
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
      const [trainingsData, employeesData] = await Promise.all([
        pb.collection('treinamentos').getFullList({ 
          filter: `company_id = "${currentUser.company_id}"`,
          expand: 'funcionarioId', 
          sort: '-dataValidade', 
          $autoCancel: false 
        }),
        pb.collection('funcionarios').getFullList({ 
          filter: `company_id = "${currentUser.company_id}"`,
          $autoCancel: false 
        })
      ]);
      setTrainings(trainingsData);
      setEmployees(employeesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Não foi possível carregar os treinamentos');
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
      const payload = {
        ...formData,
        company_id: currentUser.company_id
      };

      if (editingTraining) {
        await pb.collection('treinamentos').update(editingTraining.id, payload, { $autoCancel: false });
        toast.success('Treinamento atualizado');
      } else {
        await pb.collection('treinamentos').create(payload, { $autoCancel: false });
        toast.success('Treinamento cadastrado');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving training:', error);
      toast.error('Não foi possível salvar o treinamento');
    }
  };

  const handleEdit = (training) => {
    setEditingTraining(training);
    setFormData({
      funcionarioId: training.funcionarioId,
      curso: training.curso,
      dataValidade: training.dataValidade
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      funcionarioId: '',
      curso: '',
      dataValidade: ''
    });
    setEditingTraining(null);
  };

  const getTrainingStatus = (validDate) => {
    const today = new Date();
    const valid = new Date(validDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    if (valid < today) return 'expired';
    if (valid <= thirtyDaysFromNow) return 'expiring';
    return 'valid';
  };

  const filteredTrainings = trainings.filter(training => {
    if (filterStatus === 'all') return true;
    return getTrainingStatus(training.dataValidade) === filterStatus;
  });

  const expiringTrainings = trainings.filter(t => getTrainingStatus(t.dataValidade) === 'expiring');

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Controle de Treinamentos - DNM&LTDA</title>
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
        <title>Controle de Treinamentos - DNM&LTDA</title>
        <meta name="description" content="Acompanhe certificações de treinamento e conformidade dos funcionários" />
      </Helmet>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Controle de Treinamentos</h1>
            <p className="text-muted-foreground">Monitore a validade de certificações e conformidade</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Treinamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTraining ? 'Editar Treinamento' : 'Adicionar Novo Treinamento'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="funcionarioId">Funcionário</Label>
                  <Select value={formData.funcionarioId} onValueChange={(value) => setFormData({ ...formData, funcionarioId: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="curso">Nome do Curso</Label>
                  <Input
                    id="curso"
                    value={formData.curso}
                    onChange={(e) => setFormData({ ...formData, curso: e.target.value })}
                    required
                    className="text-foreground"
                    placeholder="ex: NR-35 Trabalho em Altura"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataValidade">Data de Validade</Label>
                  <Input
                    id="dataValidade"
                    type="date"
                    value={formData.dataValidade}
                    onChange={(e) => setFormData({ ...formData, dataValidade: e.target.value })}
                    required
                    className="text-foreground"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">{editingTraining ? 'Atualizar' : 'Adicionar'} Treinamento</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {expiringTrainings.length > 0 && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Relatório de Conformidade - Vencendo em Breve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expiringTrainings.map(training => (
                  <div key={training.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="font-medium">{training.expand?.funcionarioId?.nome || 'Desconhecido'}</p>
                      <p className="text-sm text-muted-foreground">{training.curso}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-destructive">
                        Vence em {new Date(training.dataValidade).toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.ceil((new Date(training.dataValidade) - new Date()) / (1000 * 60 * 60 * 24))} dias restantes
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtrar por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Treinamentos</SelectItem>
                <SelectItem value="valid">Válido</SelectItem>
                <SelectItem value="expiring">Vencendo em Breve</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Data de Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrainings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum treinamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrainings.map(training => {
                    const status = getTrainingStatus(training.dataValidade);
                    return (
                      <TableRow key={training.id}>
                        <TableCell className="font-medium">{training.expand?.funcionarioId?.nome || 'Desconhecido'}</TableCell>
                        <TableCell>{training.curso}</TableCell>
                        <TableCell>{new Date(training.dataValidade).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            status === 'valid' ? 'bg-green-100 text-green-800' :
                            status === 'expiring' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {status === 'valid' ? 'Válido' : status === 'expiring' ? 'Vencendo em Breve' : 'Expirado'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(training)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default TrainingTracker;
