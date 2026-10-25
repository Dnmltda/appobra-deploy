import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/contexts/AuthContext.jsx';
import Header from '@/components/Header.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Droplet, PenTool as PenToolIcon, AlertTriangle } from 'lucide-react';
import { falhaAoCarregar } from '@/lib/erros.js';

const FrotaDashboardPage = () => {
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState({ veiculos: 0, abastecimentos: 0, manutencoes: 0, alertas: 0 });

  useEffect(() => {
    if (currentUser?.company_id) {
      const companyFilter = `company_id = "${currentUser.company_id}"`;
      Promise.all([
        pb.collection('veiculos').getList(1, 1, { filter: `${companyFilter} && status="Ativo"`, $autoCancel: false }),
        pb.collection('abastecimentos').getList(1, 1, { filter: companyFilter, $autoCancel: false }), // Note: might need company_id added to schema eventually
        pb.collection('manutencoes').getList(1, 1, { filter: companyFilter, $autoCancel: false }),
        pb.collection('licenciamentos').getList(1, 1, { filter: `${companyFilter} && status="Pendente"`, $autoCancel: false })
      ]).then(([v, a, m, l]) => {
        setMetrics({ veiculos: v.totalItems, abastecimentos: a.totalItems, manutencoes: m.totalItems, alertas: l.totalItems });
      }).catch(falhaAoCarregar('o painel da frota'));
    }
  }, [currentUser]);

  return (
    <>
      <Helmet><title>Dashboard Frota - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary">Painel da Frota</h1>
            <p className="text-muted-foreground">Visão geral e indicadores</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-xl text-primary"><Truck className="w-6 h-6" /></div>
                <div><p className="text-sm text-muted-foreground">Total Veículos</p><h3 className="text-2xl font-bold">{metrics.veiculos}</h3></div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-accent/10 rounded-xl text-accent"><Droplet className="w-6 h-6" /></div>
                <div><p className="text-sm text-muted-foreground">Abastecimentos</p><h3 className="text-2xl font-bold">{metrics.abastecimentos}</h3></div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><PenToolIcon className="w-6 h-6" /></div>
                <div><p className="text-sm text-muted-foreground">Manutenções</p><h3 className="text-2xl font-bold">{metrics.manutencoes}</h3></div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-destructive/20">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-destructive/10 rounded-xl text-destructive"><AlertTriangle className="w-6 h-6" /></div>
                <div><p className="text-sm text-muted-foreground">Alertas Licenciam.</p><h3 className="text-2xl font-bold text-destructive">{metrics.alertas}</h3></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
};

export default FrotaDashboardPage;