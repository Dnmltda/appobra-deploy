import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Plus, Hammer, MapPin, CheckCircle, PackageOpen, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { falhaAoCarregar } from '@/lib/erros.js';

const LossesGainsModule = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('quebras');
  const [showModal, setShowModal] = useState(false);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  // Listas para escolher o item e o local (antes eram texto livre).
  const [materiais, setMateriais] = useState([]);
  const [obras, setObras] = useState([]);
  const [itemOutro, setItemOutro] = useState(false);

  useEffect(() => {
    if (!currentUser?.company_id) return;
    const f = `company_id = "${currentUser.company_id}"`;
    pb.collection('materiais').getFullList({ filter: f, sort: 'name', $autoCancel: false }).then(setMateriais).catch((err) => { setMateriais([]); falhaAoCarregar('os materiais')(err); });
    pb.collection('obras').getFullList({ filter: f, sort: 'nome', $autoCancel: false }).then(setObras).catch((err) => { setObras([]); falhaAoCarregar('as obras')(err); });
  }, [currentUser?.company_id]);

  const escolherMaterial = (id) => {
    if (id === 'outro') { setItemOutro(true); setFormData((f) => ({ ...f, item_id: '', item_nome: '' })); return; }
    const m = materiais.find((x) => x.id === id);
    setItemOutro(false);
    setFormData((f) => ({
      ...f,
      item_id: id,
      item_nome: m?.name || '',
      valor_estimado: f.valor_estimado || (m?.unit_cost ? Number((m.unit_cost * Number(f.quantidade || 1)).toFixed(2)) : ''),
    }));
  };
  
  const [formData, setFormData] = useState({
    tipo: 'Quebra', item_nome: '', quantidade: 1, data: new Date().toISOString().split('T')[0],
    motivo: '', valor_estimado: '', status: 'Registrado', localizacao: '', descricao: ''
  });

  useEffect(() => {
    if (currentUser?.company_id) {
      fetchData();
    }
  }, [activeTab, currentUser]);

  const fetchData = async () => {
    if (!currentUser || !currentUser.company_id) return;
    setLoading(true);
    try {
      const typeMap = { 'quebras': 'Quebra', 'extravios': 'Extravio', 'avarias': 'Avaria', 'sobras': 'Sobra', 'recuperacoes': 'Recuperação' };
      
      const records = await pb.collection('perdas_ganhos').getFullList({ 
        filter: `tipo = "${typeMap[activeTab]}" && company_id = "${currentUser.company_id}"`,
        sort: '-data', 
        $autoCancel: false 
      });
      setRegistros(records);
      
      // Calculate chart from real data
      const dataGrouped = records.reduce((acc, r) => {
        const month = new Date(r.data).toLocaleString('pt-BR', { month: 'short' });
        if(!acc[month]) acc[month] = { name: month, valor: 0 };
        acc[month].valor += (r.valor_estimado || 0);
        return acc;
      }, {});
      setChartData(Object.values(dataGrouped));
      
    } catch (error) {
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    const typeMap = { 'quebras': 'Quebra', 'extravios': 'Extravio', 'avarias': 'Avaria', 'sobras': 'Sobra', 'recuperacoes': 'Recuperação' };
    setFormData({
      tipo: typeMap[activeTab], item_id: '', item_nome: '', quantidade: 1, data: new Date().toISOString().split('T')[0],
      motivo: '', valor_estimado: '', status: 'Registrado', localizacao: '', descricao: ''
    });
    setItemOutro(false);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !currentUser.company_id) return;
    if (!String(formData.item_nome || '').trim()) { toast.error('Escolha o item'); return; }
    try {
      const data = {
        ...formData,
        responsavel_id: currentUser.id,
        company_id: currentUser.company_id
      };
      await pb.collection('perdas_ganhos').create(data, { $autoCancel: false });
      toast.success('Registro efetuado com sucesso');
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error('Erro ao salvar registro');
    }
  };

  return (
    <>
      <Helmet><title>Perdas e Ganhos - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <AlertTriangle className="w-8 h-8" />
              Perdas e Ganhos
            </h1>
            <p className="text-muted-foreground mt-2">Monitoramento de quebras, extravios, avarias e recuperações</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="shadow-sm border-l-4 border-l-red-500">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Perdas (Ativo)</p>
                    <h3 className="text-3xl font-bold text-foreground mt-1">
                      R$ {registros.filter(r => r.tipo !== 'Recuperação' && r.tipo !== 'Sobra').reduce((a, b) => a + (b.valor_estimado || 0), 0).toFixed(2)}
                    </h3>
                  </div>
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg"><TrendingDown className="w-5 h-5"/></div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Recuperações (Ativo)</p>
                    <h3 className="text-3xl font-bold text-foreground mt-1">
                      R$ {registros.filter(r => r.tipo === 'Recuperação' || r.tipo === 'Sobra').reduce((a, b) => a + (b.valor_estimado || 0), 0).toFixed(2)}
                    </h3>
                  </div>
                  <div className="p-2 bg-green-100 text-green-600 rounded-lg"><CheckCircle className="w-5 h-5"/></div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm md:col-span-1">
              <CardContent className="p-4 h-full min-h-[120px]">
                <p className="text-sm font-medium text-muted-foreground mb-2">Tendência</p>
                <div className="h-[60px] w-full">
                  {chartData.length === 0 ? <span className="text-xs text-muted-foreground">Sem dados</span> : 
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <Area type="monotone" dataKey="valor" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive)/0.2)" />
                    </AreaChart>
                  </ResponsiveContainer>}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg border-border">
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full flex justify-start rounded-none border-b bg-muted/20 h-auto p-0 overflow-x-auto">
                  <TabsTrigger value="quebras" className="py-4 px-6 font-semibold"><Hammer className="w-4 h-4 mr-2"/> Quebras</TabsTrigger>
                  <TabsTrigger value="extravios" className="py-4 px-6 font-semibold"><MapPin className="w-4 h-4 mr-2"/> Extravios</TabsTrigger>
                  <TabsTrigger value="avarias" className="py-4 px-6 font-semibold"><AlertTriangle className="w-4 h-4 mr-2"/> Avarias</TabsTrigger>
                  <TabsTrigger value="sobras" className="py-4 px-6 font-semibold"><PackageOpen className="w-4 h-4 mr-2"/> Sobras</TabsTrigger>
                  <TabsTrigger value="recuperacoes" className="py-4 px-6 font-semibold"><CheckCircle className="w-4 h-4 mr-2"/> Recuperações</TabsTrigger>
                </TabsList>
                
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold capitalize text-primary">{activeTab} Registrados</h2>
                    <Button onClick={handleOpenModal} className="bg-primary text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" /> Novo Registro
                    </Button>
                  </div>
                  
                  {loading ? <div className="text-center py-12 text-muted-foreground">Carregando dados...</div> : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Qtd / Local</TableHead>
                          <TableHead>Valor Est.</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registros.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8">Nenhum registro encontrado.</TableCell></TableRow>}
                        {registros.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.item_nome}<div className="text-xs text-muted-foreground">{r.motivo}</div></TableCell>
                            <TableCell>{new Date(r.data).toLocaleDateString()}</TableCell>
                            <TableCell><span className="font-bold">{r.quantidade}</span><div className="text-xs text-muted-foreground">{r.localizacao || '-'}</div></TableCell>
                            <TableCell>R$ {r.valor_estimado?.toFixed(2) || '0.00'}</TableCell>
                            <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar {formData.tipo}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mt-4">
            <div className="col-span-2 space-y-2">
              <Label>Item</Label>
              <Select value={itemOutro ? 'outro' : (formData.item_id || '')} onValueChange={escolherMaterial}>
                <SelectTrigger><SelectValue placeholder="Escolha o material" /></SelectTrigger>
                <SelectContent>
                  {materiais.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.code ? ` (${m.code})` : ''}</SelectItem>)}
                  <SelectItem value="outro">Outro item (não cadastrado)</SelectItem>
                </SelectContent>
              </Select>
              {itemOutro && (
                <Input required placeholder="Descreva o item" value={formData.item_nome} onChange={e=>setFormData({...formData, item_nome: e.target.value})} />
              )}
            </div>
            <div className="col-span-1"><Label>Data</Label><Input type="date" required value={formData.data} onChange={e=>setFormData({...formData, data: e.target.value})} /></div>
            <div className="col-span-1"><Label>Qtd</Label><Input type="number" required value={formData.quantidade} onChange={e=>setFormData({...formData, quantidade: e.target.value})} /></div>
            <div className="col-span-1 space-y-2"><Label>Localização</Label>
              <Select value={formData.localizacao || 'none'} onValueChange={(v)=>setFormData({...formData, localizacao: v === 'none' ? '' : v})}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  <SelectItem value="Almoxarifado">Almoxarifado</SelectItem>
                  {obras.map((o) => <SelectItem key={o.id} value={o.nome}>{o.nome}</SelectItem>)}
                  <SelectItem value="Outro local">Outro local</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1"><Label>Valor R$</Label><Input type="number" step="0.01" value={formData.valor_estimado} onChange={e=>setFormData({...formData, valor_estimado: parseFloat(e.target.value)})} /></div>
            <div className="col-span-2"><Label>Motivo</Label><Input value={formData.motivo} onChange={e=>setFormData({...formData, motivo: e.target.value})} /></div>
            <div className="col-span-2 flex justify-end gap-3 mt-4">
              <Button type="button" variant="outline" onClick={()=>setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LossesGainsModule;