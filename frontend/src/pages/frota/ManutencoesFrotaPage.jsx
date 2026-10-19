import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const ManutencoesFrotaPage = () => {
  const { currentUser } = useAuth();
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.company_id) {
      fetchData();
    }
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser?.company_id) return;
    
    setLoading(true);
    try {
      const records = await pb.collection('manutencoes').getFullList({ 
        filter: `company_id = "${currentUser.company_id}"`,
        expand: 'veiculo_id', 
        sort: '-data', 
        $autoCancel: false 
      });
      setRegistros(records);
    } catch (error) {
      toast.error('Erro ao carregar manutenções');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Manutenções - Frota</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary">Manutenções</h1>
              <p className="text-muted-foreground">Histórico e agendamentos</p>
            </div>
            <Button className="bg-primary text-primary-foreground opacity-50 cursor-not-allowed" onClick={() => toast.info('Em desenvolvimento')}>
              <Plus className="w-4 h-4 mr-2" /> Nova Manutenção
            </Button>
          </div>

          <Card className="shadow-sm">
            <CardHeader><CardTitle>Histórico de Manutenções</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Carregando...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Oficina</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registros.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma manutenção.</TableCell></TableRow>}
                    {registros.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold">{r.expand?.veiculo_id?.placa}</TableCell>
                        <TableCell>{new Date(r.data).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell><Badge variant="outline">{r.tipo}</Badge></TableCell>
                        <TableCell>{r.oficina || '-'}</TableCell>
                        <TableCell>R$ {r.custo?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell><Badge>{r.status || 'Concluída'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default ManutencoesFrotaPage;