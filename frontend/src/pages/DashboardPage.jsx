import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { t } from '@/lib/translations.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Building2, ShoppingCart, DollarSign, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import Header from '@/components/Header.jsx';

const DashboardPage = () => {
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    funcionarios: 0,
    projetos: 0,
    compras: 0,
    receita: 0
  });
  const [alerts, setAlerts] = useState({ epi: [], estoque: [] });
  const [recentPurchases, setRecentPurchases] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const [chartData, setChartData] = useState({ financeiro: [], projetos: [] });

  useEffect(() => {
    if (currentUser?.company_id) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const fetchDashboardData = async () => {
    if (!currentUser || !currentUser.company_id) return;
    
    try {
      const companyFilter = `company_id = "${currentUser.company_id}"`;
      const obraCompanyFilter = `obraId.company_id = "${currentUser.company_id}"`;
      
      const qFuncionarios = { filter: `${companyFilter} && status="Ativo"`, $autoCancel: false };
      const qObras = { filter: companyFilter, $autoCancel: false };
      const qPedidos = { expand: 'fornecedorId', sort: '-created', filter: `${companyFilter} && (status="Enviado" || status="Confirmado" || status="Pendente")`, $autoCancel: false };
      const qReceitas = { filter: obraCompanyFilter, $autoCancel: false };
      const qDespesas = { filter: obraCompanyFilter, $autoCancel: false };
      const qTreinamentos = { expand: 'funcionarioId', filter: companyFilter, $autoCancel: false };
      const solicitacoesObraFilter = `obra_id.company_id = "${currentUser.company_id}"`;
      const qSolicitacoes = { expand: 'obra_id', sort: '-created', filter: solicitacoesObraFilter, $autoCancel: false };

      const results = await Promise.allSettled([
        pb.collection('funcionarios').getList(1, 1, qFuncionarios),
        pb.collection('obras').getFullList(qObras),
        pb.collection('compras').getList(1, 5, qPedidos),
        pb.collection('receitas').getFullList(qReceitas),
        pb.collection('despesas').getFullList(qDespesas),
        pb.collection('treinamentos').getFullList(qTreinamentos),
        pb.collection('solicitacoes').getList(1, 5, qSolicitacoes)
      ]);

      const funcionarios = results[0].status === 'fulfilled' ? results[0].value : { totalItems: 0 };
      const obras = results[1].status === 'fulfilled' ? results[1].value : [];
      const compras = results[2].status === 'fulfilled' ? results[2].value : { totalItems: 0, items: [] };
      const receitas = results[3].status === 'fulfilled' ? results[3].value : [];
      const despesas = results[4].status === 'fulfilled' ? results[4].value : [];
      const treinamentos = results[5].status === 'fulfilled' ? results[5].value : [];
      const solicitacoes = results[6].status === 'fulfilled' ? results[6].value : { items: [] };

      const totalReceita = receitas.reduce((acc, curr) => acc + (curr.valor || 0), 0);

      setMetrics({
        funcionarios: funcionarios.totalItems || 0,
        projetos: obras.length || 0,
        compras: compras.totalItems || 0,
        receita: totalReceita || 0
      });

      // Chart Data: Financeiro
      const mesesMap = {};
      const addVal = (list, type) => {
        list.forEach(item => {
          const m = new Date(item.created || item.data).toLocaleString('pt-BR', { month: 'short' });
          if (!mesesMap[m]) mesesMap[m] = { name: m, receitas: 0, despesas: 0 };
          mesesMap[m][type] += (item.valor || 0);
        });
      };
      addVal(receitas, 'receitas');
      addVal(despesas, 'despesas');
      const financData = Object.values(mesesMap);

      // Chart Data: Projetos
      const projStatus = obras.reduce((acc, o) => {
        const status = o.status || 'Indefinido';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      const projChart = Object.keys(projStatus).map(key => ({ name: key, value: projStatus[key] }));

      setChartData({
        financeiro: financData,
        projetos: projChart
      });

      setRecentPurchases(compras.items || []);
      setRecentRequests(solicitacoes.items || []);

      const today = new Date();
      const thirtyDays = new Date(today);
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      
      const expiringEpi = treinamentos.filter(t => {
        if (!t.dataValidade) return false;
        const d = new Date(t.dataValidade);
        return d >= today && d <= thirtyDays;
      }).slice(0, 5);

      setAlerts({ epi: expiringEpi, estoque: [] });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0F2744', '#C9A227', '#E8E8E8', '#D0D0D0'];
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <>
      <Helmet><title>{t('dashboard', language)} - Gestão</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/20 min-h-screen">
        <div className="app-container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-primary">{t('dashboard', language)}</h1>
            <p className="text-muted-foreground">Visão geral integrada das operações</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : !currentUser?.company_id ? (
             <div className="text-center py-12 text-muted-foreground">Acesso negado. Usuário sem empresa vinculada.</div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card className="bg-card shadow-sm border-border">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground uppercase">Total Funcionários Ativos</p>
                      <h3 className="text-3xl font-bold text-primary mt-1">{metrics.funcionarios}</h3>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-xl"><Users className="w-6 h-6 text-primary" /></div>
                  </CardContent>
                </Card>
                <Card className="bg-card shadow-sm border-border">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground uppercase">Projetos</p>
                      <h3 className="text-3xl font-bold text-primary mt-1">{metrics.projetos}</h3>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-xl"><Building2 className="w-6 h-6 text-primary" /></div>
                  </CardContent>
                </Card>
                <Card className="bg-card shadow-sm border-border">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground uppercase">Compras</p>
                      <h3 className="text-3xl font-bold text-accent mt-1">{metrics.compras}</h3>
                    </div>
                    <div className="p-3 bg-accent/10 rounded-xl"><ShoppingCart className="w-6 h-6 text-accent" /></div>
                  </CardContent>
                </Card>
                <Card className="bg-card shadow-sm border-border">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground uppercase">Receita Total</p>
                      <h3 className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(metrics.receita)}</h3>
                    </div>
                    <div className="p-3 bg-green-100 rounded-xl"><DollarSign className="w-6 h-6 text-green-600" /></div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <Card className="lg:col-span-2 shadow-sm border-border">
                  <CardHeader><CardTitle className="text-primary text-lg">Receitas vs Despesas</CardTitle></CardHeader>
                  <CardContent className="h-80 flex items-center justify-center">
                    {chartData.financeiro.length === 0 ? (
                      <p className="text-muted-foreground">Sem dados disponíveis</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.financeiro}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
                          <Tooltip contentStyle={{borderRadius:'8px'}} formatter={(value) => formatCurrency(value)} />
                          <Legend />
                          <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#0F2744" strokeWidth={3} dot={{r: 4}} />
                          <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#C9A227" strokeWidth={3} dot={{r: 4}} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border">
                  <CardHeader><CardTitle className="text-primary text-lg">Projetos por Status</CardTitle></CardHeader>
                  <CardContent className="h-80 flex items-center justify-center">
                    {chartData.projetos.length === 0 ? (
                      <p className="text-muted-foreground">Sem dados disponíveis</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData.projetos} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {chartData.projetos.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Tables & Alerts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card className="shadow-sm border-border">
                    <CardHeader><CardTitle className="text-primary text-lg">Últimas Compras</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentPurchases.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhuma compra encontrada</TableCell></TableRow>
                          ) : recentPurchases.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">{p.numero}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{p.descricao}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(p.valor || 0)}</TableCell>
                              <TableCell><span className="text-xs px-2 py-1 bg-accent/20 text-accent-foreground font-semibold rounded-full">{p.status}</span></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-destructive text-lg flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" /> Alertas de Treinamento
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {alerts.epi.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum alerta crítico</p>
                      ) : (
                        <div className="space-y-3 mt-2">
                          {alerts.epi.map(epi => (
                            <div key={epi.id} className="p-3 bg-white rounded-lg border border-destructive/20 shadow-sm flex flex-col gap-1">
                              <span className="text-sm font-bold text-foreground">{epi.expand?.funcionarioId?.nome || 'Desconhecido'}</span>
                              <span className="text-xs text-muted-foreground">{epi.curso}</span>
                              <span className="text-xs font-semibold text-destructive mt-1">Vence: {new Date(epi.dataValidade).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default DashboardPage;