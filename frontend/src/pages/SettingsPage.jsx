import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import CartaoInstalarApp from '@/components/marca/CartaoInstalarApp.jsx';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building, Monitor, Palette, Globe, Save, Shield, Lock, ListChecks } from 'lucide-react';
import CatalogoServicos from '@/components/CatalogoServicos.jsx';
import { ehAdmin } from '@/lib/permissoes.js';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { t } from '@/lib/translations.js';
import PasswordRecoveryModal from '@/components/PasswordRecoveryModal.jsx';

const SettingsPage = () => {
  const { language, setLanguage } = useLanguage();
  const { currentUser } = useAuth();
  const [localLanguage, setLocalLanguage] = useState(language || 'pt-BR');
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ users: 0, items: 0 });
  const [activeTab, setActiveTab] = useState('language');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [companyData, setCompanyData] = useState({
    id: '', nome: '', cnpj: '', razao_social: '', endereco: '', cidade: '', estado: '', telefone: '', email: ''
  });

  useEffect(() => {
    fetchData();
    if (activeTab === 'security') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (currentUser?.company_id) {
        const rec = await pb.collection('companies').getOne(currentUser.company_id, { $autoCancel: false });
        setCompanyData({
          id: rec.id,
          nome: rec.name || '',
          razao_social: rec.name || '',
          cnpj: rec.cnpj || '',
          endereco: rec.address || '',
          cidade: rec.city || '',
          estado: rec.state || '',
          telefone: rec.phone || '',
          email: rec.email || '',
        });
      }
      
      // Contagem só da empresa (o servidor também filtra; aqui fica explícito).
      const daEmpresa = { filter: `company_id = "${currentUser?.company_id || ''}"`, $autoCancel: false };
      const users = await pb.collection('users').getList(1, 1, daEmpresa);
      const funcs = await pb.collection('funcionarios').getList(1, 1, daEmpresa);
      const obras = await pb.collection('obras').getList(1, 1, daEmpresa);
      
      setStats({
        users: users.totalItems,
        items: funcs.totalItems + obras.totalItems
      });
    } catch (e) {
      console.error(e);
      // Em vez de mostrar zero como se fosse verdade.
      setStats({ users: '—', items: '—' });
      toast.error('Não foi possível carregar os números da empresa agora. Verifique a internet e tente de novo.');
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await pb.collection('auditoria').getList(1, 10, { 
        sort: '-created',
        filter: `modulo = "settings"`,
        $autoCancel: false 
      });
      setAuditLogs(logs.items);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveCompany = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: companyData.nome || companyData.razao_social,
        cnpj: companyData.cnpj,
        address: companyData.endereco,
        city: companyData.cidade,
        state: companyData.estado,
        phone: companyData.telefone,
        email: companyData.email,
      };
      await pb.collection('companies').update(companyData.id || currentUser.company_id, payload, { $autoCancel: false });
      toast.success(t('sucessoSalvar', language));
    } catch (error) {
      toast.error(t('erroSalvar', language));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageSave = () => {
    setLanguage(localLanguage);
    localStorage.setItem('appobra_language', localLanguage);
    window.location.reload();
  };

  const handleThemeSave = (val) => {
    setTheme(val);
    localStorage.setItem('theme', val);
    if(val === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    toast.success('Tema atualizado');
  };

  const tabs = [
    { id: 'language', label: t('preferenciasIdioma', language) || 'Idioma', icon: Globe },
    { id: 'company', label: 'Empresa', icon: Building },
    { id: 'system', label: 'Sistema', icon: Monitor },
    { id: 'theme', label: 'Tema', icon: Palette },
    { id: 'security', label: 'Segurança', icon: Shield },
    // Catálogo de serviços da obra (andares/unidades): só o Administrador.
    ...(ehAdmin(currentUser) ? [{ id: 'servicos', label: t('est_catalogo', language), icon: ListChecks }] : []),
    // A aba "Backup" (simulada) saiu: o backup de verdade entra com o
    // fechamento da empresa (Bloco 4; ver docs/ideias-futuras.md).
  ];

  return (
    <>
      <Helmet><title>{t('configuracoes', language)} - DNM&LTDA</title></Helmet>
      <Header />
      <main className="py-8">
        <div className="app-container max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 text-primary">{t('configuracoes', language)}</h1>
            <p className="text-muted-foreground">Gerencie as configurações gerais do sistema</p>
          </div>

          <div className="grid gap-8 md:grid-cols-4">
            <div className="hidden md:flex col-span-1 flex-col space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button 
                    key={tab.id}
                    variant="ghost" 
                    className={`justify-start font-medium ${activeTab === tab.id ? 'bg-accent/10 text-accent font-bold' : 'text-muted-foreground'}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon className="mr-3 h-5 w-5" /> {tab.label}
                  </Button>
                );
              })}
            </div>

            <div className="col-span-1 md:col-span-3 space-y-8">
              <CartaoInstalarApp />


              {activeTab === 'language' && (
                <Card className="shadow-sm border-border bg-card">
                  <CardHeader className="border-b border-border pb-4 flex flex-row items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Globe className="h-5 w-5 text-primary" /></div>
                    <div>
                      <CardTitle className="text-xl text-primary">{t('preferenciasIdioma', language) || 'Idioma'}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 flex gap-4">
                    <Select value={localLanguage} onValueChange={setLocalLanguage}>
                      <SelectTrigger className="w-[200px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">English</SelectItem>
                        <SelectItem value="es-ES">Español</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleLanguageSave} className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold">{t('salvar', language)}</Button>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'theme' && (
                <Card className="shadow-sm border-border bg-card">
                  <CardHeader className="border-b border-border pb-4 flex flex-row items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Palette className="h-5 w-5 text-primary" /></div>
                    <div>
                      <CardTitle className="text-xl text-primary">Tema da Interface</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <RadioGroup value={theme} onValueChange={handleThemeSave} className="flex gap-6">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="light" id="light" />
                        <Label htmlFor="light" className="font-medium cursor-pointer text-foreground">Modo Claro (Padrão)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dark" id="dark" />
                        <Label htmlFor="dark" className="font-medium cursor-pointer text-muted-foreground">Modo Escuro (Em breve)</Label>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'company' && (
                <Card className="shadow-sm border-border bg-card">
                  <CardHeader className="border-b border-border pb-4 flex flex-row items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Building className="h-5 w-5 text-primary" /></div>
                    <div>
                      <CardTitle className="text-xl text-primary">Dados da Empresa</CardTitle>
                      <CardDescription>Informações emitentes para relatórios e notas</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="font-bold text-foreground">Nome Fantasia</Label>
                        <Input value={companyData.nome} onChange={(e) => setCompanyData({...companyData, nome: e.target.value})} className="bg-background text-foreground" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-foreground">CNPJ</Label>
                        <Input value={companyData.cnpj} onChange={(e) => setCompanyData({...companyData, cnpj: e.target.value})} className="bg-background text-foreground" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="font-bold text-foreground">Razão Social</Label>
                        <Input value={companyData.razao_social} onChange={(e) => setCompanyData({...companyData, razao_social: e.target.value})} className="bg-background text-foreground" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="font-bold text-foreground">Endereço</Label>
                        <Input value={companyData.endereco} onChange={(e) => setCompanyData({...companyData, endereco: e.target.value})} className="bg-background text-foreground" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-foreground">Cidade</Label>
                        <Input value={companyData.cidade} onChange={(e) => setCompanyData({...companyData, cidade: e.target.value})} className="bg-background text-foreground" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-foreground">Estado (UF)</Label>
                        <Input value={companyData.estado} onChange={(e) => setCompanyData({...companyData, estado: e.target.value})} className="bg-background text-foreground" maxLength={2} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-foreground">Telefone</Label>
                        <Input value={companyData.telefone} onChange={(e) => setCompanyData({...companyData, telefone: e.target.value})} className="bg-background text-foreground" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold text-foreground">Email</Label>
                        <Input value={companyData.email} type="email" onChange={(e) => setCompanyData({...companyData, email: e.target.value})} className="bg-background text-foreground" />
                      </div>
                    </div>
                    <div className="flex justify-end pt-6">
                      <Button onClick={handleSaveCompany} disabled={isSaving} className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold px-8 h-10 shadow-sm">
                        <Save className="w-4 h-4 mr-2" /> {t('salvar', language)}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'system' && (
                <Card className="shadow-sm border-border bg-card">
                  <CardHeader className="border-b border-border pb-4 flex flex-row items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><Monitor className="h-5 w-5 text-primary" /></div>
                    <CardTitle className="text-xl text-primary">Informações do Sistema</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
                    <div><p className="text-muted-foreground mb-1">Versão</p><p className="font-bold text-foreground">3.1.0</p></div>
                    <div><p className="text-muted-foreground mb-1">Ambiente</p><p className="font-bold text-foreground">Produção</p></div>
                    <div><p className="text-muted-foreground mb-1">Última Atualização</p><p className="font-bold text-foreground">{new Date().toLocaleDateString()}</p></div>
                    <div><p className="text-muted-foreground mb-1">Usuário Logado</p><p className="font-bold text-foreground truncate">{currentUser?.email}</p></div>
                    <div><p className="text-muted-foreground mb-1">Total de Usuários</p><p className="font-bold text-foreground">{stats.users}</p></div>
                    <div><p className="text-muted-foreground mb-1">Total de Registros Base</p><p className="font-bold text-foreground">{stats.items}</p></div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'servicos' && ehAdmin(currentUser) && <CatalogoServicos />}

              {activeTab === 'security' && (
                <>
                  <Card className="shadow-sm border-border bg-card mb-8">
                    <CardHeader className="border-b border-border pb-4 flex flex-row items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg"><Lock className="h-5 w-5 text-primary" /></div>
                      <div>
                        <CardTitle className="text-xl text-primary">{t('alterarSenha', language)}</CardTitle>
                        <CardDescription>Atualize sua senha de acesso periodicamente</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <Button onClick={() => setShowPasswordModal(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                        <Lock className="w-4 h-4 mr-2" /> {t('alterarSenha', language)}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border bg-card">
                    <CardHeader className="border-b border-border pb-4 flex flex-row items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg"><Shield className="h-5 w-5 text-primary" /></div>
                      <div>
                        <CardTitle className="text-xl text-primary">Histórico de Segurança</CardTitle>
                        <CardDescription>Últimas 10 atividades de segurança neste perfil</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {loadingLogs ? (
                        <div className="text-center py-8 text-muted-foreground">Carregando histórico...</div>
                      ) : auditLogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Nenhuma atividade registrada no histórico local de segurança</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="font-bold">{t('dataHora', language)}</TableHead>
                                <TableHead className="font-bold">{t('usuario', language)}</TableHead>
                                <TableHead className="font-bold">{t('acao', language)}</TableHead>
                                <TableHead className="font-bold">{t('detalhes', language)}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {auditLogs.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="font-medium">
                                    {new Date(log.created).toLocaleString('pt-BR')}
                                  </TableCell>
                                  <TableCell>{log.usuario || '-'}</TableCell>
                                  <TableCell>{log.acao}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {log.detalhes || '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}


            </div>
          </div>
        </div>
      </main>
      
      {/* Settings Modal triggers change password */}
      <PasswordRecoveryModal 
        open={showPasswordModal} 
        onClose={() => setShowPasswordModal(false)}
        mode="change"
      />
    </>
  );
};

export default SettingsPage;