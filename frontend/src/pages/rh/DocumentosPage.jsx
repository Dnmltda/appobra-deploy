import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import Header from '@/components/Header.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

const DocumentosPage = () => {
  const { currentUser } = useAuth();
  const [docs, setDocs] = useState([]);
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
      const records = await pb.collection('documentos').getFullList({ 
        filter: `company_id = "${currentUser.company_id}"`,
        expand: 'funcionario_id', 
        sort: '-created', 
        $autoCancel: false 
      });
      setDocs(records);
    } catch (error) {
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet><title>Documentos - RH</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary">Documentos</h1>
            <p className="text-muted-foreground">Repositório de documentos dos colaboradores</p>
          </div>

          <Card className="shadow-sm">
            <CardHeader><CardTitle>Arquivos</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="text-center py-8">Carregando...</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><FileText className="w-12 h-12 mx-auto opacity-20 mb-2" />Nenhum documento</TableCell></TableRow>
                    )}
                    {docs.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-bold">{d.expand?.funcionario_id?.nome_completo}</TableCell>
                        <TableCell>{d.tipo}</TableCell>
                        <TableCell>{d.data_validade ? new Date(d.data_validade).toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                        <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          {d.arquivo && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={pb.files.getURL(d, d.arquivo)} target="_blank" rel="noreferrer"><Download className="w-4 h-4" /></a>
                            </Button>
                          )}
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
    </>
  );
};

export default DocumentosPage;