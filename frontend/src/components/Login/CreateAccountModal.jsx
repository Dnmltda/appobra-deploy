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
import { UserPlus, Building2, Loader2, Eye, EyeOff, Check } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbaseClient.js';
import {
  validateCreateAccountForm,
  passwordStrengthScore,
  STRENGTH_LABELS,
} from '@/utils/loginValidations.js';

// Modal "Criar conta" — autocadastro público. Cria uma EMPRESA NOVA e o
// usuário administrador vinculado a ela, em uma única chamada atômica ao
// endpoint customizado /api/custom/self-register-company (pb_hooks). Isso
// garante que cada administrador só acessa os próprios dados, isolado de
// qualquer outra empresa já cadastrada — nunca é possível "entrar" em uma
// empresa existente por aqui.
const CreateAccountModal = ({ open, onClose }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    name: '',
    cpfCnpj: '',
    email: '',
    username: '',
    password: '',
    passwordConfirm: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const reset = () => {
    setFormData({ companyName: '', name: '', cpfCnpj: '', email: '', username: '', password: '', passwordConfirm: '' });
    setErrors({});
    setShowPassword(false);
    setShowConfirm(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // Formata progressivamente como CPF (11 dígitos) ou CNPJ (14 dígitos),
  // detectando automaticamente pela quantidade de números digitados.
  const handleCpfCnpjChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
    let formatted = digits;
    if (digits.length <= 11) {
      formatted = digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      formatted = digits
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    setFormData((prev) => ({ ...prev, cpfCnpj: formatted }));
    if (errors.cpfCnpj) setErrors((prev) => ({ ...prev, cpfCnpj: undefined }));
  };

  const score = passwordStrengthScore(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.companyName.trim()) {
      setErrors((prev) => ({ ...prev, companyName: 'Informe o nome da sua empresa.' }));
      return;
    }
    const { valid, errors: validationErrors } = validateCreateAccountForm(formData);
    if (!valid) {
      setErrors((prev) => ({ ...prev, ...validationErrors }));
      return;
    }

    setLoading(true);
    try {
      await pb.send('/api/custom/self-register-company', {
        method: 'POST',
        body: {
          companyName: formData.companyName.trim(),
          adminName: formData.name.trim(),
          cpfCnpj: formData.cpfCnpj.replace(/\D/g, ''),
          adminEmail: formData.email.trim().toLowerCase(),
          username: formData.username.trim().toLowerCase(),
          password: formData.password,
        },
      });

      toast.success('Empresa e conta criadas com sucesso! Faça login para continuar.');
      handleClose();
    } catch (err) {
      const msg = err?.response?.message || err?.message || 'Erro ao criar empresa e conta.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-ouro" />
            <DialogTitle className="text-marinho">Criar Conta</DialogTitle>
          </div>
          <DialogDescription>
            Cadastre sua empresa e sua conta de administrador. Seus dados ficam
            isolados de qualquer outra empresa no sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="ca-company">
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Nome da empresa *</span>
            </Label>
            <Input
              id="ca-company"
              value={formData.companyName}
              onChange={handleChange('companyName')}
              className="bg-white text-foreground"
              autoFocus
            />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-name">Seu nome completo *</Label>
            <Input
              id="ca-name"
              value={formData.name}
              onChange={handleChange('name')}
              className="bg-white text-foreground"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-cpfcnpj">CPF ou CNPJ (opcional)</Label>
            <Input
              id="ca-cpfcnpj"
              value={formData.cpfCnpj}
              onChange={handleCpfCnpjChange}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              className="bg-white text-foreground"
              inputMode="numeric"
            />
            {errors.cpfCnpj && <p className="text-xs text-destructive">{errors.cpfCnpj}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ca-email">Email *</Label>
              <Input
                id="ca-email"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                className="bg-white text-foreground"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ca-username">Usuário *</Label>
              <Input
                id="ca-username"
                value={formData.username}
                onChange={handleChange('username')}
                placeholder="usuario"
                className="bg-white text-foreground"
              />
              {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-password">Senha *</Label>
            <div className="relative">
              <Input
                id="ca-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange('password')}
                className="bg-white text-foreground pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {formData.password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i < score
                          ? score <= 1
                            ? 'bg-red-500'
                            : score === 2
                              ? 'bg-yellow-500'
                              : score === 3
                                ? 'bg-blue-500'
                                : 'bg-green-600'
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Força: {STRENGTH_LABELS[score]}
                </p>
              </div>
            )}
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ca-confirm">Confirmar senha *</Label>
            <div className="relative">
              <Input
                id="ca-confirm"
                type={showConfirm ? 'text' : 'password'}
                value={formData.passwordConfirm}
                onChange={handleChange('passwordConfirm')}
                className="bg-white text-foreground pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.passwordConfirm && (
              <p className="text-xs text-destructive">{errors.passwordConfirm}</p>
            )}
            {formData.passwordConfirm && formData.password === formData.passwordConfirm && (
              <p className="text-[11px] text-green-700 flex items-center gap-1">
                <Check className="w-3 h-3" /> As senhas conferem
              </p>
            )}
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
                  <Loader2 className="w-4 h-4 animate-spin" /> Criando…
                </span>
              ) : (
                'Criar empresa e conta'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAccountModal;

