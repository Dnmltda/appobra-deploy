import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, KeyRound, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { auditLogUnauthenticated, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/auditLogger.js';
import { isValidEmail } from '@/utils/loginValidations.js';

// Modal "Esqueci minha senha" — fluxo único por email: a pessoa informa o
// email, o sistema gera o token de recuperação (AuthContext.requestPasswordReset)
// e o hook pb_hooks/send-password-reset.pb.js envia um email real com um link
// para /reset-password?token=... onde a senha é trocada de fato.
const PasswordRecoveryModal = ({ open, onClose }) => {
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const reset = () => {
    setEmail('');
    setLoading(false);
    setError('');
    setSent(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) {
      setError('Informe um email válido.');
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase(), 'email');
      await auditLogUnauthenticated(
        AUDIT_ACTIONS.PASSWORD_RESET_REQUEST,
        AUDIT_MODULES.AUTH,
        email,
        'success',
        `Solicitação de recuperação via email: ${email}`,
      );
      setSent(true);
    } catch (err) {
      // Mensagem genérica por segurança (não revela se o email existe ou não)
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-ouro" />
            <DialogTitle className="text-marinho">Esqueci minha senha</DialogTitle>
          </div>
          <DialogDescription>
            Informe seu email. Se houver uma conta associada, enviaremos um link para você criar uma nova senha.
          </DialogDescription>
        </DialogHeader>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="pr-email">Email</Label>
              <Input
                id="pr-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className="bg-white text-foreground"
                autoFocus
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-ouro text-marinho hover:bg-ouro-escuro font-bold"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando…
                  </span>
                ) : (
                  'Enviar link de recuperação'
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="flex justify-center">
              <MailCheck className="w-14 h-14 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              Se houver uma conta associada a <strong>{email}</strong>, um email com o link de redefinição foi enviado.
              Verifique também a caixa de spam.
            </p>
            <Button onClick={handleClose} className="bg-marinho text-white hover:bg-marinho/90 font-bold">
              Entendi
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PasswordRecoveryModal;

