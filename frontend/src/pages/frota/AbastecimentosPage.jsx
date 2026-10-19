import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

const AbastecimentosPage = () => {
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
      const records = await pb.collection('abastecimentos').getFullList({ 
        filter: `company_id = "${currentUser.company_id}"`,
        expand: 'veiculo_id', 
        sort: '-data', 
        $autoCancel: false 
      });
      setRegistros(records);
    } catch (error) {
      toast.error('Erro ao carregar abastecimentos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Abastecimentos - Frota</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary">Abastecimentos</h1>
              <p className="text-muted-foreground">Controle de consumo de combustível</p>
            </div>
            <Button className="bg-primary text-primary-foreground opacity-50 cursor-not-allowed" onClick={() => toast.info('Em desenvolvimento')}>
              <Plus className="w-4 h-4 mr-2" /> Novo Registro
            </Button>
          </div>

          <Card className="shadow-sm">
            <CardHeader><CardTitle>Histórico de Abastecimentos</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Carregando...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Veículo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Combustível</TableHead>
                      <TableHead>Quantidade (L)</TableHead>
                      <TableHead>Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registros.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum abastecimento.</TableCell></TableRow>}
                    {registros.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold">{r.expand?.veiculo_id?.placa} - {r.expand?.veiculo_id?.modelo}</TableCell>
                        <TableCell>{new Date(r.data).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>{r.combustivel || '-'}</TableCell>
                        <TableCell>{r.quantidade} L</TableCell>
                        <TableCell>R$ {r.valor?.toFixed(2)}</TableCell>
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

export default AbastecimentosPage;