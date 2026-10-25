import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { t } from '@/lib/translations.js';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet, ArrowDownCircle, ArrowUpCircle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header.jsx';
import { falhaAoCarregar } from '@/lib/erros.js';

const DashboardFinanceiro = () => {
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState({ receitas: 0, despesas: 0, saldo: 0 });

  useEffect(() => {
    if (!currentUser?.company_id) return;

    const qReceitas = { filter: `obraId.company_id = "${currentUser.company_id}"`, $autoCancel: false };
    const qDespesas = { filter: `obraId.company_id = "${currentUser.company_id}"`, $autoCancel: false };

    Promise.all([
      pb.collection('receitas').getFullList(qReceitas).catch(e => { console.error('Erro ao consultar [receitas]:', e); throw e; }),
      pb.collection('despesas').getFullList(qDespesas).catch(e => { console.error('Erro ao consultar [despesas]:', e); throw e; })
    ]).then(([rec, desp]) => {
      const totalR = rec.reduce((a, b) => a + (b.valor || 0), 0);
      const totalD = desp.reduce((a, b) => a + (b.valor || 0), 0);
      setMetrics({ receitas: totalR, despesas: totalD, saldo: totalR - totalD });
    }).catch(falhaAoCarregar('o painel financeiro'));
  }, [currentUser]);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <>
      <Helmet><title>{t('financialDashboard', language)} - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8">
        <div className="app-container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-primary">{t('financialDashboard', language)}</h1>
            <p className="text-muted-foreground">Indicadores financeiros consolidados</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-card shadow-sm border-border">
              <CardContent className="p-6 flex justify-between items-center">
                <div><p className="text-sm font-medium text-muted-foreground uppercase">Receita Total</p><h3 className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(metrics.receitas)}</h3></div>
                <div className="p-3 bg-green-100 rounded-xl"><TrendingUp className="w-6 h-6 text-green-600" /></div>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-sm border-border">
              <CardContent className="p-6 flex justify-between items-center">
                <div><p className="text-sm font-medium text-muted-foreground uppercase">Despesa Total</p><h3 className="text-3xl font-bold text-destructive mt-1">{formatCurrency(metrics.despesas)}</h3></div>
                <div className="p-3 bg-destructive/10 rounded-xl"><TrendingDown className="w-6 h-6 text-destructive" /></div>
              </CardContent>
            </Card>
            <Card className="bg-primary text-primary-foreground shadow-sm">
              <CardContent className="p-6 flex justify-between items-center">
                <div><p className="text-sm font-medium text-white/70 uppercase">Saldo</p><h3 className="text-3xl font-bold text-accent mt-1">{formatCurrency(metrics.saldo)}</h3></div>
                <div className="p-3 bg-white/10 rounded-xl"><Wallet className="w-6 h-6 text-accent" /></div>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Link to="/financeiro/contas-pagar">
              <Card className="bg-card shadow-sm border-border hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-xl"><ArrowUpCircle className="w-6 h-6 text-destructive" /></div>
                    <div>
                      <h3 className="font-semibold text-lg">Contas a Pagar</h3>
                      <p className="text-sm text-muted-foreground">Ver e gerenciar contas a pagar</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
            <Link to="/financeiro/contas-receber">
              <Card className="bg-card shadow-sm border-border hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-6 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-xl"><ArrowDownCircle className="w-6 h-6 text-green-600" /></div>
                    <div>
                      <h3 className="font-semibold text-lg">Contas a Receber</h3>
                      <p className="text-sm text-muted-foreground">Ver e gerenciar contas a receber de clientes</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          </div>

          <Card className="bg-card shadow-sm border-border min-h-[400px] flex items-center justify-center">
            <p className="text-muted-foreground">Gráficos financeiros detalhados estarão disponíveis em breve.</p>
          </Card>
        </div>
      </main>
    </>
  );
};

export default DashboardFinanceiro;
