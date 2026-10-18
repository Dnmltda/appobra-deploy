import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Users } from 'lucide-react';
import { toast } from 'sonner';

const EquipesPage = () => {
  const { currentUser } = useAuth();
  const [equipes, setEquipes] = useState([]);
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
      const records = await pb.collection('equipes').getFullList({ 
        filter: `company_id = "${currentUser.company_id}"`,
        expand: 'lider_id', 
        sort: 'nome', 
        $autoCancel: false 
      });
      setEquipes(records);
    } catch (error) {
      toast.error('Erro ao carregar equipes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Equipes - RH</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary">Equipes de Trabalho</h1>
              <p className="text-muted-foreground">Gerencie times e líderes</p>
            </div>
            <Button className="bg-primary text-primary-foreground opacity-50 cursor-not-allowed" onClick={() => toast.info('Funcionalidade em desenvolvimento')}>
              <Plus className="w-4 h-4 mr-2" /> Nova Equipe
            </Button>
          </div>

          <Card className="shadow-sm">
            <CardHeader><CardTitle>Lista de Equipes</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Carregando...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Líder</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          <p>Nenhuma equipe cadastrada.</p>
                        </TableCell>
                      </TableRow>
                    )}
                    {equipes.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-bold">{e.nome}</TableCell>
                        <TableCell>{e.expand?.lider_id?.nome_completo || 'Sem líder'}</TableCell>
                        <TableCell className="text-muted-foreground">{e.descricao || '-'}</TableCell>
                        <TableCell><Badge variant={e.status === 'Ativa' ? 'default' : 'secondary'}>{e.status}</Badge></TableCell>
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

export default EquipesPage;