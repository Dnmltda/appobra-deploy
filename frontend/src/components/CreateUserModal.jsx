import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

const CreateUserModal = ({ open, onClose, onSuccess }) => {
  const { createUser, currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    name: '',
    cargo: '',
    telefone: '',
    password: '',
    id_unico: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser || !currentUser.company_id) {
      toast.error('Usuário não autenticado ou sem empresa vinculada');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres');
      return;
    }
    
    setLoading(true);
    
    try {
      const userDataToSubmit = {
        ...formData,
        passwordConfirm: formData.password,
        role: formData.cargo,
        company_id: currentUser.company_id,
        status: 'Ativo',
        id_unico: formData.id_unico ? formData.id_unico : crypto.randomUUID().substring(0, 8)
      };

      await createUser(userDataToSubmit);
      toast.success('Usuário criado com sucesso');
      resetForm();
      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '', username: '', name: '', cargo: '', telefone: '', password: '', id_unico: ''
    });
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
    toast.success('Senha gerada automaticamente');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { resetForm(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <UserPlus className="w-5 h-5" />
            Criar Novo Usuário
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do novo usuário para sua empresa.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name" className="font-bold text-foreground">Nome Completo *</Label>
              <Input id="name" type="text" placeholder="João Silva" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="bg-background" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="font-bold text-foreground">Email *</Label>
              <Input id="email" type="email" placeholder="joao@empresa.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="bg-background" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username" className="font-bold text-foreground">Nome de Usuário *</Label>
              <Input id="username" type="text" placeholder="joaosilva" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required className="bg-background" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_unico" className="font-bold text-foreground">ID Único</Label>
              <Input id="id_unico" type="text" placeholder="Deixe vazio p/ auto" value={formData.id_unico} onChange={(e) => setFormData({ ...formData, id_unico: e.target.value })} className="bg-background" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cargo" className="font-bold text-foreground">Cargo *</Label>
              <Select value={formData.cargo} onValueChange={(value) => setFormData({ ...formData, cargo: value })}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione..." />
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
              <Label htmlFor="telefone" className="font-bold text-foreground">Telefone</Label>
              <Input id="telefone" type="tel" placeholder="(11) 98765-4321" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} className="bg-background" />
            </div>
            
            <div className="space-y-2 col-span-2">
              <Label htmlFor="password" className="font-bold text-foreground">Senha Inicial *</Label>
              <div className="flex gap-2">
                <Input id="password" type="text" placeholder="Mínimo 8 caracteres" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={8} className="bg-background flex-1" />
                <Button type="button" variant="outline" onClick={generatePassword}>Gerar</Button>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 font-bold">
              {loading ? 'Criando...' : 'Criar Usuário'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserModal;