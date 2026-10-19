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
import { Plus, Search, Edit, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';

const VeiculosPage = () => {
  const { currentUser } = useAuth();
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    placa: '', marca: '', modelo: '', ano: '', cor: '', tipo: 'Carro', 
    chassi: '', renavam: '', combustivel: 'Gasolina', capacidade_carga: '', status: 'Ativo'
  });

  useEffect(() => {
    if (currentUser?.company_id) {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser?.company_id) return;
    
    setLoading(true);
    try {
      const records = await pb.collection('veiculos').getFullList({ 
        filter: `company_id = "${currentUser.company_id}"`,
        sort: '-created', 
        $autoCancel: false 
      });
      setVeiculos(records);
    } catch (error) {
      toast.error('Erro ao carregar veículos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (v = null) => {
    if (v) {
      setEditingId(v.id);
      setFormData({
        placa: v.placa || '', marca: v.marca || '', modelo: v.modelo || '', ano: v.ano || '', 
        cor: v.cor || '', tipo: v.tipo || 'Carro', chassi: v.chassi || '', renavam: v.renavam || '', 
        combustivel: v.combustivel || 'Gasolina', capacidade_carga: v.capacidade_carga || '', status: v.status || 'Ativo'
      });
    } else {
      setEditingId(null);
      setFormData({
        placa: '', marca: '', modelo: '', ano: '', cor: '', tipo: 'Carro', 
        chassi: '', renavam: '', combustivel: 'Gasolina', capacidade_carga: '', status: 'Ativo'
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser?.company_id) {
      toast.error('Erro: Nenhuma empresa ativa selecionada no sistema.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const data = { 
        ...formData, 
        company_id: currentUser.company_id 
      };
      
      if (!editingId) data.id_unico = `VEI-${Date.now()}`;
      
      if (editingId) {
        await pb.collection('veiculos').update(editingId, data, { $autoCancel: false });
        toast.success('Veículo atualizado com sucesso');
      } else {
        await pb.collection('veiculos').create(data, { $autoCancel: false });
        toast.success('Veículo cadastrado com sucesso');
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      const msg = error.data?.message || error.message || 'Erro inesperado ao salvar veículo';
      toast.error(msg);
      console.error('Erro de validação/banco:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir?')) return;
    try {
      await pb.collection('veiculos').delete(id, { $autoCancel: false });
      toast.success('Veículo excluído');
      fetchData();
    } catch (error) {
      const msg = error.data?.message || error.message || 'Erro ao excluir';
      toast.error(msg);
    }
  };

  const filtered = veiculos.filter(v => 
    v.placa?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.modelo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Helmet><title>Veículos - Frota</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary">Gestão de Veículos</h1>
              <p className="text-muted-foreground">Cadastro e controle da frota</p>
            </div>
            <Button onClick={() => handleOpenModal()} className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Novo Veículo
            </Button>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="border-b pb-4 flex flex-row justify-between items-center">
              <CardTitle className="text-xl">Frota Ativa</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar placa ou modelo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Tipo / Combustível</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><Truck className="w-12 h-12 mx-auto mb-2 opacity-20"/>Nenhum veículo encontrado.</TableCell></TableRow>
                    )}
                    {filtered.map(v => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="font-bold">{v.marca} {v.modelo}</div>
                          <div className="text-sm text-muted-foreground">{v.cor} • {v.ano}</div>
                        </TableCell>
                        <TableCell className="font-medium tracking-wider">{v.placa}</TableCell>
                        <TableCell>
                          <div>{v.tipo}</div>
                          <div className="text-sm text-muted-foreground">{v.combustivel}</div>
                        </TableCell>
                        <TableCell><Badge variant={v.status === 'Ativo' ? 'default' : 'secondary'}>{v.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(v)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(v.id)}><Trash2 className="w-4 h-4" /></Button>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Veículo' : 'Cadastrar Veículo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2 col-span-1">
              <Label>Placa *</Label>
              <Input required value={formData.placa} onChange={e => setFormData({...formData, placa: e.target.value})} className="uppercase" />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Renavam</Label>
              <Input value={formData.renavam} onChange={e => setFormData({...formData, renavam: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Tipo *</Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({...formData, tipo: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Carro">Carro</SelectItem>
                  <SelectItem value="Caminhão">Caminhão</SelectItem>
                  <SelectItem value="Van">Van</SelectItem>
                  <SelectItem value="Moto">Moto</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Marca *</Label>
              <Input required value={formData.marca} onChange={e => setFormData({...formData, marca: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Modelo *</Label>
              <Input required value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Ano</Label>
              <Input type="number" value={formData.ano} onChange={e => setFormData({...formData, ano: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Cor</Label>
              <Input value={formData.cor} onChange={e => setFormData({...formData, cor: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Chassi</Label>
              <Input value={formData.chassi} onChange={e => setFormData({...formData, chassi: e.target.value})} />
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Combustível</Label>
              <Select value={formData.combustivel} onValueChange={v => setFormData({...formData, combustivel: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gasolina">Gasolina</SelectItem>
                  <SelectItem value="Diesel">Diesel</SelectItem>
                  <SelectItem value="Etanol">Etanol</SelectItem>
                  <SelectItem value="Elétrico">Elétrico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-1">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={v => setFormData({...formData, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Sucata">Sucata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VeiculosPage;