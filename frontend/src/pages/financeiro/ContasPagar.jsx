import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { t } from '@/lib/translations.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {  FileText } from 'lucide-react';
import Header from '@/components/Header.jsx';

const ContasPagar = () => {
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  const [data, setData] = useState([]);

  useEffect(() => {
    if (currentUser?.company_id) {
      pb.collection('contas_pagar').getFullList({ 
        filter: `company_id = "${currentUser.company_id}"`,
        expand: 'fornecedorId', 
        sort: 'data_vencimento', 
        $autoCancel: false 
      }).then(setData).catch(console.error);
    }
  }, [currentUser]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <>
      <Helmet><title>{t('accountsPayable', language)} - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8">
        <div className="app-container">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-primary">{t('accountsPayable', language)}</h1>
              <p className="text-muted-foreground">Gestão de obrigações financeiras</p>
            </div>
          </div>

          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>{t('description', language)}</TableHead>
                    <TableHead>{t('supplier', language)}</TableHead>
                    <TableHead className="text-right">{t('amount', language)}</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>{t('status', language)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12"><FileText className="w-8 h-8 mx-auto text-muted-foreground opacity-30 mb-2"/>{t('noData', language)}</TableCell></TableRow>
                  ) : data.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.descricao}</TableCell>
                      <TableCell>{item.expand?.fornecedorId?.nome}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.valor)}</TableCell>
                      <TableCell>{new Date(item.data_vencimento).toLocaleDateString()}</TableCell>
                      <TableCell><span className="text-xs px-2 py-1 bg-muted text-muted-foreground font-semibold rounded-full">{item.status}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default ContasPagar;