import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { t } from '@/lib/translations.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Check, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';

const PaginaNotificacoes = () => {
  const { language } = useLanguage();
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    }
  }, [currentUser]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const records = await pb.collection('notificacoes').getFullList({
        filter: `usuarioId = "${currentUser.id}"`,
        sort: '-created',
        $autoCancel: false
      });
      setNotifications(records);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error(t('errorLoading', language));
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id, currentStatus) => {
    try {
      await pb.collection('notificacoes').update(id, { lida: !currentStatus }, { $autoCancel: false });
      fetchNotifications();
    } catch (error) {
      toast.error(t('errorSaving', language));
    }
  };

  const deleteNotification = async (id) => {
    try {
      await pb.collection('notificacoes').delete(id, { $autoCancel: false });
      toast.success(t('deleteSuccess', language));
      fetchNotifications();
    } catch (error) {
      toast.error(t('errorSaving', language));
    }
  };

  const clearAll = async () => {
    if (!window.confirm(t('confirmDelete', language))) return;
    try {
      const batch = notifications.map(n => pb.collection('notificacoes').delete(n.id, { $autoCancel: false }));
      await Promise.all(batch);
      toast.success(t('deleteSuccess', language));
      fetchNotifications();
    } catch (error) {
      toast.error(t('errorSaving', language));
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filterType !== 'all' && n.tipo !== filterType) return false;
    if (filterStatus === 'read' && !n.lida) return false;
    if (filterStatus === 'unread' && n.lida) return false;
    return true;
  });

  return (
    <>
      <Helmet>
        <title>{t('notifications', language)} - DNM&LTDA</title>
      </Helmet>
      <Header />
      <main className="py-8">
        <div className="app-container">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-primary">{t('notifications', language)}</h1>
              <p className="text-muted-foreground">Central de alertas e avisos do sistema</p>
            </div>
            {notifications.length > 0 && (
              <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive hover:text-white" onClick={clearAll}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t('clearAll', language)}
              </Button>
            )}
          </div>

          <Card className="mb-6 bg-card border-border shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4">
              <div className="space-y-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">{t('type', language)}</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="estoque">Estoque</SelectItem>
                    <SelectItem value="epi">EPI / Treinamento</SelectItem>
                    <SelectItem value="compra">Compras</SelectItem>
                    <SelectItem value="solicitacao">Solicitações</SelectItem>
                    <SelectItem value="conta">Financeiro</SelectItem>
                    <SelectItem value="projeto">Projetos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-sm font-medium text-foreground">{t('status', language)}</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="unread">Não lidas</SelectItem>
                    <SelectItem value="read">Lidas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[100px]">{t('type', language)}</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead className="w-[150px]">{t('date', language)}</TableHead>
                      <TableHead className="w-[100px]">{t('status', language)}</TableHead>
                      <TableHead className="w-[100px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredNotifications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                          <BellRing className="w-8 h-8 mx-auto mb-2 opacity-20" />
                          Nenhuma notificação encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredNotifications.map((notif) => (
                        <TableRow key={notif.id} className={notif.lida ? 'opacity-70' : 'bg-primary/5 font-medium'}>
                          <TableCell className="capitalize">{notif.tipo || 'Sistema'}</TableCell>
                          <TableCell>{notif.mensagem}</TableCell>
                          <TableCell>
                            {new Date(notif.created).toLocaleDateString()}<br/>
                            <span className="text-xs text-muted-foreground">{new Date(notif.created).toLocaleTimeString()}</span>
                          </TableCell>
                          <TableCell>
                            {notif.lida ? (
                              <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">Lida</span>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-accent text-accent-foreground rounded-full">Nova</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => markAsRead(notif.id, notif.lida)} title={notif.lida ? "Marcar como não lida" : "Marcar como lida"}>
                                <Check className={`w-4 h-4 ${notif.lida ? 'text-muted-foreground' : 'text-primary'}`} />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => deleteNotification(notif.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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

export default PaginaNotificacoes;