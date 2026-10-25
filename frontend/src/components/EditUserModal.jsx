import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import pb from '@/lib/pocketbaseClient.js';
import { toast } from 'sonner';
import { UserCog } from 'lucide-react';
import { mensagemErro } from '@/lib/erros.js';

const EditUserModal = ({ open, onClose, user, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    username: '',
    cargo: '',
    telefone: '',
    status: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        username: user.username || '',
        cargo: user.cargo || '',
        telefone: user.telefone || '',
        status: user.status || 'Ativo'
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const updateData = {
        ...formData,
        role: user.role || formData.cargo,
        company_id: user.company_id,
        id_unico: user.id_unico
      };
      
      await pb.collection('users').update(user.id, updateData, { $autoCancel: false });
      toast.success('Usuário atualizado com sucesso');
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(mensagemErro(error, 'Erro ao atualizar usuário'));
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <UserCog className="w-5 h-5" />
            Editar Usuário
          </DialogTitle>
          <DialogDescription>
            ID: {user.id_unico || user.id}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-name" className="font-bold text-foreground">Nome Completo</Label>
              <Input
                id="edit-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email" className="font-bold text-foreground">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-username" className="font-bold text-foreground">Nome de Usuário</Label>
              <Input
                id="edit-username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                className="bg-background"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-cargo" className="font-bold text-foreground">Cargo</Label>
              <Select value={formData.cargo} onValueChange={(value) => setFormData({ ...formData, cargo: value })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrador">Administrador</SelectItem>
                  <SelectItem value="Funcionário">Funcionário</SelectItem>
                  <SelectItem value="Engenheiro">Engenheiro</SelectItem>
                  <SelectItem value="Almoxarife">Almoxarife</SelectItem>
                  <SelectItem value="Mestre de Obras">Mestre de Obras</SelectItem>
                  <SelectItem value="Pedreiro">Pedreiro</SelectItem>
                  <SelectItem value="Servente">Servente</SelectItem>
                  <SelectItem value="Encanador">Encanador</SelectItem>
                  <SelectItem value="Eletricista">Eletricista</SelectItem>
                  <SelectItem value="Faxina">Faxina</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-telefone" className="font-bold text-foreground">Telefone</Label>
              <Input
                id="edit-telefone"
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                className="bg-background"
              />
            </div>
            
            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-status" className="font-bold text-foreground">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-bold">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserModal;