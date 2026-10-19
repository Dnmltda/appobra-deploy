import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';

const TreinamentosPage = () => {
  const { currentUser } = useAuth();
  const [treinamentos, setTreinamentos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    funcionarioId: '', curso: '', tipo: 'NR10', data_conclusao: '', dataValidade: '', status: 'Válido'
  });
  const [certificado, setCertificado] = useState(null);

  useEffect(() => {
    if (currentUser?.company_id) {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser?.company_id) return;
    
    setLoading(true);
    try {
      const records = await pb.collection('treinamentos').getFullList({ 
        filter: `company_id = "${currentUser.company_id}"`,
        expand: 'funcionarioId', 
        sort: '-dataValidade', 
        $autoCancel: false 
      });
      setTreinamentos(records);
      const funcRecords = await pb.collection('funcionarios').getFullList({ 
        filter: `company_id = "${currentUser.company_id}" && status="Ativo"`, 
        $autoCancel: false 
      });
      setFuncionarios(funcRecords);
    } catch (error) {
      toast.error('Erro ao carregar treinamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        funcionarioId: item.funcionarioId || '',
        curso: item.curso || '',
        tipo: item.tipo || 'NR10',
        data_conclusao: item.data_conclusao?.split('T')[0] || '',
        dataValidade: item.dataValidade?.split('T')[0] || '',
        status: item.status || 'Válido'
      });
      setCertificado(null);
    } else {
      setEditingId(null);
      setFormData({
        funcionarioId: '', curso: '', tipo: 'NR10', data_conclusao: '', dataValidade: '', status: 'Válido'
      });
      setCertificado(null);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser?.company_id) {
      toast.error('Empresa não identificada');
      return;
    }
    
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      data.append('company_id', currentUser.company_id);
      
      if (!editingId) data.append('id_unico', `TRN-${Date.now()}`);
      if (certificado) data.append('certificado', certificado);

      if (editingId) {
        await pb.collection('treinamentos').update(editingId, data, { $autoCancel: false });
        toast.success('Treinamento atualizado com sucesso');
      } else {
        await pb.collection('treinamentos').create(data, { $autoCancel: false });
        toast.success('Treinamento registrado com sucesso');
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error('Erro ao salvar treinamento');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir?')) return;
    try {
      await pb.collection('treinamentos').delete(id, { $autoCancel: false });
      toast.success('Treinamento excluído');
      fetchData();
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const expirations = treinamentos.filter(t => {
    const validade = new Date(t.dataValidade);
    const today = new Date();
    const diffTime = validade - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= 0;
  });

  return (
    <>
      <Helmet><title>Treinamentos - RH</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary">Treinamentos</h1>
              <p className="text-muted-foreground">Gestão de NRs e capacitações</p>
            </div>
            <Button onClick={() => handleOpenModal()} className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Novo Registro
            </Button>
          </div>

          {expirations.length > 0 && (
            <Card className="mb-8 border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-destructive flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5" /> Alertas de Vencimento (Próximos 30 dias)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 space-y-1">
                  {expirations.map(exp => (
                    <li key={exp.id} className="text-sm">
                      <span className="font-semibold">{exp.expand?.funcionarioId?.nome_completo}</span> - {exp.tipo} ({exp.curso}) vence em {new Date(exp.dataValidade).toLocaleDateString('pt-BR')}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Histórico de Treinamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Tipo / Curso</TableHead>
                      <TableHead>Conclusão</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treinamentos.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.expand?.funcionarioId?.nome_completo}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="mb-1">{t.tipo}</Badge><br/>
                          <span className="text-sm text-muted-foreground">{t.curso}</span>
                        </TableCell>
                        <TableCell>{new Date(t.data_conclusao).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{new Date(t.dataValidade).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge variant={t.status === 'Válido' ? 'default' : t.status === 'Vencido' ? 'destructive' : 'secondary'}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {t.certificado && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={pb.files.getURL(t, t.certificado)} target="_blank" rel="noreferrer" title="Ver Certificado"><FileText className="w-4 h-4" /></a>
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(t)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Treinamento' : 'Registrar Treinamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2 col-span-2">
              <Label>Funcionário *</Label>
              <Select value={formData.funcionarioId} onValueChange={v => setFormData({...formData, funcionarioId: v})} required>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({...formData, tipo: v})} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NR10">NR10</SelectItem>
                  <SelectItem value="NR18">NR18</SelectItem>
                  <SelectItem value="NR35">NR35</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Nome do Curso *</Label>
              <Input required value={formData.curso} onChange={e => setFormData({...formData, curso: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Data de Conclusão *</Label>
              <Input type="date" required value={formData.data_conclusao} onChange={e => setFormData({...formData, data_conclusao: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Data de Validade *</Label>
              <Input type="date" required value={formData.dataValidade} onChange={e => setFormData({...formData, dataValidade: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Válido">Válido</SelectItem>
                  <SelectItem value="Vencido">Vencido</SelectItem>
                  <SelectItem value="Próximo de vencer">Próximo de vencer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Certificado (PDF/Img)</Label>
              <Input type="file" onChange={e => setCertificado(e.target.files[0])} />
            </div>
            <div className="col-span-2 flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TreinamentosPage;