import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useLanguage } from '@/contexts/LanguageContext.jsx';
import { auditLog } from '@/lib/auditLogger.js';
import { t } from '@/lib/translations.js';
import { toast } from 'sonner';

const PasswordRecoveryModal = ({ open, onClose, mode = 'forgot' }) => {
  const { requestPasswordReset, changePassword } = useAuth();
  const { language } = useLanguage();
  
  // Forgot Password State
  const [recoveryMethod, setRecoveryMethod] = useState('email');
  const [identifier, setIdentifier] = useState('');
  
  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);

  const resetStateAndClose = () => {
    setIdentifier('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await requestPasswordReset(identifier, recoveryMethod);
      toast.success(t('emailRecuperacaoEnviado', language));
      resetStateAndClose();
    } catch (error) {
      toast.error(error.message || t('erro', language));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t('senhaMinimo', language));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('senhasNaoConferem', language));
      return;
    }

    setLoading(true);
    try {
      // Valida a senha atual e já atualiza a senha (feito dentro de changePassword)
      await changePassword(currentPassword, newPassword);

      await auditLog('password_changed', 'settings', 'Usuário alterou a senha com sucesso', 'success');
      toast.success(t('senhaAlteradaSucesso', language));
      resetStateAndClose();
    } catch (error) {
      toast.error(error.message || t('senhaAtualIncorreta', language));
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'change') {
    return (
      <Dialog open={open} onOpenChange={resetStateAndClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-marinho">{t('alterarSenha', language)}</DialogTitle>
            <DialogDescription>
              Atualize sua senha de acesso. A nova senha deve ter no mínimo 8 caracteres.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePasswordSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('senhaAtual', language)}</Label>
              <Input 
                id="current-password" 
                type="password" 
                required 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                className="bg-white text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('novaSenha', language)}</Label>
              <Input 
                id="new-password" 
                type="password" 
                required 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                className="bg-white text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('confirmarNovaSenha', language)}</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                required 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                className="bg-white text-foreground"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={resetStateAndClose} className="flex-1">
                {t('cancelar', language)}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 bg-marinho text-white hover:bg-marinho/90 font-bold">
                {loading ? 'Salvando...' : t('salvar', language)}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  // mode === 'forgot'
  return (
    <Dialog open={open} onOpenChange={resetStateAndClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-marinho">{t('recuperarSenha', language)}</DialogTitle>
          <DialogDescription>
            Informe seu email, ID ou nome de usuário para receber instruções de recuperação.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleForgotSubmit} className="space-y-4 mt-4">
          <Tabs value={recoveryMethod} onValueChange={setRecoveryMethod}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="id">ID</TabsTrigger>
              <TabsTrigger value="username">Usuário</TabsTrigger>
            </TabsList>
            
            <TabsContent value="email" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email">{t('email', language)}</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="bg-white text-foreground"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="id" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-id">{t('idUsuario', language)}</Label>
                <Input
                  id="recovery-id"
                  type="text"
                  placeholder="USR-000001"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
                  required
                  className="bg-white text-foreground"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="username" className="space-y-3 mt-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-username">{t('nomeUsuario', language)}</Label>
                <Input
                  id="recovery-username"
                  type="text"
                  placeholder="usuario"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="bg-white text-foreground"
                />
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex gap-3 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={resetStateAndClose}
              className="flex-1"
            >
              {t('cancelar', language)}
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1 bg-ouro text-marinho hover:bg-ouro-escuro font-bold"
            >
              {loading ? 'Enviando...' : t('enviar', language)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordRecoveryModal;