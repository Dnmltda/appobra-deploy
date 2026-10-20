import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Shield, Edit, Lock, Unlock, UserX, UserCheck, Search } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import EditUserModal from '@/components/EditUserModal.jsx';

const AdminSecurityPanel = () => {
  const { currentUser, isAdmin, blockUser, unblockUser, deactivateUser, activateUser, resetUserPassword } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    if (!isAdmin) {
      toast.error('Acesso negado. Apenas administradores podem acessar esta página.');
      navigate('/dashboard');
      return;
    }
    if (currentUser?.company_id) {
      refreshUsersList();
    }
  }, [isAdmin, navigate, currentUser]);

  useEffect(() => {
    const handleUsersUpdated = (event) => {
      setUsers(event.detail);
    };
    window.addEventListener('usersUpdated', handleUsersUpdated);
    return () => {
      window.removeEventListener('usersUpdated', handleUsersUpdated);
    };
  }, []);

  const refreshUsersList = async () => {
    if (!currentUser || !currentUser.company_id) return;
    setLoading(true);
    try {
      const records = await pb.collection('users').getFullList({ 
        filter: `company_id="${currentUser.company_id}"`,
        sort: '-created', 
        expand: 'company_id', 
        $autoCancel: false 
      });
      setUsers(records);
    } catch (error) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const isPrincipalAdmin = (user) => {
    if (!user) return false;
    return user.dono_sistema === true;
  };

  const handleBlock = async (userId, targetUser) => {
    if (isPrincipalAdmin(targetUser)) {
      toast.error('O Administrador Principal não pode ser bloqueado.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja bloquear este usuário?')) return;
    try {
      await blockUser(userId);
      toast.success('Usuário bloqueado com sucesso');
      refreshUsersList();
    } catch (error) {
      toast.error('Erro ao bloquear usuário');
    }
  };

  const handleUnblock = async (userId) => {
    try {
      await unblockUser(userId);
      toast.success('Usuário desbloqueado com sucesso');
      refreshUsersList();
    } catch (error) {
      toast.error('Erro ao desbloquear usuário');
    }
  };

  const handleDeactivate = async (userId, targetUser) => {
    if (isPrincipalAdmin(targetUser)) {
      toast.error('O Administrador Principal não pode ser desativado.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja desativar este usuário?')) return;
    try {
      await deactivateUser(userId);
      toast.success('Usuário desativado com sucesso');
      refreshUsersList();
    } catch (error) {
      toast.error('Erro ao desativar usuário');
    }
  };

  const handleActivate = async (userId) => {
    try {
      await activateUser(userId);
      toast.success('Usuário ativado com sucesso');
      refreshUsersList();
    } catch (error) {
      toast.error('Erro ao ativar usuário');
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = window.prompt('Digite a nova senha temporária (mínimo 8 caracteres):');
    if (!newPassword) return;
    if (newPassword.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres');
      return;
    }
    
    try {
      await resetUserPassword(userId, newPassword);
      toast.success('Senha redefinida com sucesso');
    } catch (error) {
      toast.error('Erro ao redefinir senha');
    }
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.id_unico?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'Ativo': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'Inativo': return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
      case 'Bloqueado': return 'bg-red-500/10 text-red-700 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  return (
    <>
      <Helmet><title>Painel de Segurança - Empresa</title></Helmet>
      <Header />
      <main className="py-8">
        <div className="app-container">
          <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 text-primary flex items-center gap-2">
                <Shield className="w-8 h-8" />
                Painel de Segurança
              </h1>
              <p className="text-muted-foreground">Gerenciamento de usuários e permissões da sua empresa</p>
              <p className="text-xs text-muted-foreground mt-1">Para adicionar uma nova pessoa, use a página Funcionários.</p>
            </div>
          </div>

          <Card className="shadow-sm border-border bg-card">
            <CardHeader className="border-b border-border pb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-xl text-primary">Usuários do Sistema</CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar usuários..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-background"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando usuários...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum usuário encontrado</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-bold">ID</TableHead>
                        <TableHead className="font-bold">Nome</TableHead>
                        <TableHead className="font-bold">Username</TableHead>
                        <TableHead className="font-bold">Email</TableHead>
                        <TableHead className="font-bold">Cargo</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.id_unico || user.id.substring(0, 8)}</TableCell>
                          <TableCell>{user.name || '-'}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{user.cargo || user.role || '-'}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(user.status)} font-semibold`}>
                              {user.status || 'Ativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2 flex-wrap">
                              <Button size="sm" variant="outline" onClick={() => { setSelectedUser(user); setShowEditModal(true); }}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              
                              {user.status === 'Bloqueado' ? (
                                <Button size="sm" variant="outline" onClick={() => handleUnblock(user.id)}><Unlock className="w-3 h-3" /></Button>
                              ) : (
                                <Button size="sm" variant="outline" disabled={isPrincipalAdmin(user)} title={isPrincipalAdmin(user) ? 'Administrador Principal não pode ser bloqueado' : undefined} onClick={() => handleBlock(user.id, user)}><Lock className="w-3 h-3" /></Button>
                              )}
                              
                              {user.status === 'Inativo' ? (
                                <Button size="sm" variant="outline" onClick={() => handleActivate(user.id)}><UserCheck className="w-3 h-3" /></Button>
                              ) : (
                                <Button size="sm" variant="outline" disabled={isPrincipalAdmin(user)} title={isPrincipalAdmin(user) ? 'Administrador Principal não pode ser desativado' : undefined} onClick={() => handleDeactivate(user.id, user)}><UserX className="w-3 h-3" /></Button>
                              )}
                              
                              <Button size="sm" variant="outline" onClick={() => handleResetPassword(user.id)}>Resetar Senha</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {showEditModal && (
        <EditUserModal 
          open={showEditModal} 
          onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
          user={selectedUser}
          onSuccess={refreshUsersList}
        />
      )}
    </>
  );
};

export default AdminSecurityPanel;
