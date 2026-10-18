import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { validateContactForm } from '@/utils/loginValidations.js';

// Modal "Contato" — formulário de contato institucional.
// Não persiste em banco (apenas feedback visual); em produção pode ser
// conectado ao mailer do PocketBase via hook.
const ContactModal = ({ open, onClose }) => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setFormData({ name: '', email: '', message: '' });
    setErrors({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { valid, errors: validationErrors } = validateContactForm(formData);
    if (!valid) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    // Simula envio (estrutura pronta para integração com mailer PocketBase).
    await new Promise((resolve) => setTimeout(resolve, 800));
    toast.success('Mensagem enviada com sucesso! Em breve entraremos em contato.');
    setLoading(false);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#1a3a52]">Contato</DialogTitle>
          <DialogDescription>
            Fale com a equipe do APP OBRA. Respondemos em até 24 horas úteis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mb-2">
          <a
            href="mailto:dnmltda@hotmail.com"
            className="flex items-center gap-2 text-sm text-foreground hover:text-[#d4af37] transition-colors"
          >
            <Mail className="w-4 h-4 text-[#d4af37]" /> dnmltda@hotmail.com
          </a>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4 text-[#d4af37]" /> (00) 00000-0000
          </p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-[#d4af37]" /> Brasil
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="ct-name">Nome *</Label>
            <Input
              id="ct-name"
              value={formData.name}
              onChange={handleChange('name')}
              className="bg-white text-foreground"
              autoFocus
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ct-email">Email *</Label>
            <Input
              id="ct-email"
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              className="bg-white text-foreground"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ct-message">Mensagem *</Label>
            <Textarea
              id="ct-message"
              value={formData.message}
              onChange={handleChange('message')}
              rows={4}
              className="bg-white text-foreground"
              placeholder="Como podemos ajudar?"
            />
            {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#1a3a52] text-white hover:bg-[#1a3a52]/90 font-bold"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Enviando…
                </span>
              ) : (
                'Enviar mensagem'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactModal;
