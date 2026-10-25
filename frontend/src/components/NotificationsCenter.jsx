import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Bell, Check, Trash2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const NotificationsCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      // Subscribe to real-time updates
      const pararP = pb.collection('notificacoes').subscribe('*', (e) => {
        if (e.record.usuarioId === currentUser.id) {
          fetchNotifications();
        }
      });
      return () => {
        // Desliga só esta escuta (unsubscribe('*') derrubaria a de outras telas na mesma tabela).
        pararP.then((parar) => parar()).catch(() => {});
      };
    }
  }, [currentUser]);

  const fetchNotifications = async () => {
    try {
      const records = await pb.collection('notificacoes').getList(1, 10, {
        filter: `usuarioId = "${currentUser.id}"`,
        sort: '-created',
        $autoCancel: false
      });
      setNotifications(records.items);
      const unread = await pb.collection('notificacoes').getList(1, 1, {
        filter: `usuarioId = "${currentUser.id}" && lida = false`,
        $autoCancel: false
      });
      setUnreadCount(unread.totalItems);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await pb.collection('notificacoes').update(id, { lida: true }, { $autoCancel: false });
      fetchNotifications();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await pb.collection('notificacoes').delete(id, { $autoCancel: false });
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-white/10 hover:text-accent transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-white border-0 text-[10px]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-lg border-border">
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <h4 className="font-semibold text-foreground">Notificações</h4>
          <span className="text-xs text-muted-foreground">{unreadCount} não lidas</span>
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notif) => (
                <div key={notif.id} className={`flex items-start gap-3 p-4 border-b last:border-0 transition-colors hover:bg-muted/50 ${!notif.lida ? 'bg-primary/5' : ''}`}>
                  <div className="flex-1 space-y-1">
                    <p className={`text-sm ${!notif.lida ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {notif.mensagem}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notif.created), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {!notif.lida && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10" onClick={() => markAsRead(notif.id)} title="Marcar como lida">
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteNotification(notif.id)} title="Excluir">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t bg-card">
          <Button variant="ghost" className="w-full text-xs text-primary hover:text-primary hover:bg-primary/10 justify-center" onClick={() => { setIsOpen(false); navigate('/notificacoes'); }}>
            Ver todas as notificações <ArrowRight className="w-3 h-3 ml-2" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsCenter;