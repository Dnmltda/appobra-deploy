import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Eye, EyeOff, Loader2, Mail, User, Hash, LogIn } from 'lucide-react';
import { useLogin } from '@/hooks/useLogin.js';
import { STORAGE_KEYS } from '@/utils/securityUtils.js';

// Formulário principal de login — usa o hook useLogin (AuthContext + PocketBase).
const LoginForm = ({ onRecovery, onCreateAccount, onContact }) => {
  const { login, loading, error, fieldErrors, clearError } = useLogin();
  const [method, setMethod] = useState('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Carrega "Lembrar acesso" do localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.REMEMBER_LOGIN);
      if (raw) {
        const decoded = JSON.parse(atob(raw));
        setMethod(decoded.method || 'email');
        setIdentifier(decoded.identifier || '');
        setRememberMe(true);
      }
    } catch (e) {
      // ignora
    }
  }, []);

  const handleMethodChange = (value) => {
    setMethod(value);
    setIdentifier('');
    clearError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login({ method, identifier, password, remember: rememberMe });
    if (result.success) {
      // O redirecionamento é tratado pela página pai via observação do authStore.
      // Dispara evento para a página reagir.
      window.dispatchEvent(new CustomEvent('appobra:login-success'));
    }
  };

  const methodIcon = {
    email: <Mail className="w-4 h-4 text-muted-foreground" />,
    id: <Hash className="w-4 h-4 text-muted-foreground" />,
    username: <User className="w-4 h-4 text-muted-foreground" />,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div
          className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1 duration-300"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <Tabs value={method} onValueChange={handleMethodChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="id">ID</TabsTrigger>
          <TabsTrigger value="username">Usuário</TabsTrigger>
        </TabsList>

        {['email', 'id', 'username'].map((m) => (
          <TabsContent key={m} value={m} className="space-y-2 mt-4">
            <Label htmlFor={`lf-${m}`} className="text-[#1a3a52] font-semibold">
              {m === 'email' ? 'Email' : m === 'id' ? 'ID do funcionário' : 'Nome de usuário'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2">{methodIcon[m]}</span>
              <Input
                id={`lf-${m}`}
                type={m === 'email' ? 'email' : 'text'}
                placeholder={
                  m === 'email'
                    ? 'seu@email.com'
                    : m === 'id'
                      ? 'USR-000001'
                      : 'usuario'
                }
                value={identifier}
                onChange={(e) => {
                  setIdentifier(m === 'id' ? e.target.value.toUpperCase() : e.target.value);
                  if (fieldErrors.identifier) clearError();
                }}
                required
                className="bg-white border-gray-200 focus-visible:ring-[#d4af37] h-11 text-foreground pl-9"
                autoComplete={m === 'email' ? 'email' : 'username'}
              />
            </div>
            {fieldErrors.identifier && (
              <p className="text-xs text-destructive">{fieldErrors.identifier}</p>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="lf-password" className="text-[#1a3a52] font-semibold">
            Senha
          </Label>
          <button
            type="button"
            onClick={onRecovery}
            className="text-sm font-medium text-[#d4af37] hover:underline"
          >
            Esqueci minha senha
          </button>
        </div>
        <div className="relative">
          <Input
            id="lf-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) clearError();
            }}
            required
            className="bg-white border-gray-200 focus-visible:ring-[#d4af37] h-11 text-foreground pr-10"
            autoComplete="current-password"
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
        {fieldErrors.password && (
          <p className="text-xs text-destructive">{fieldErrors.password}</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox id="lf-remember" checked={rememberMe} onCheckedChange={setRememberMe} />
        <Label htmlFor="lf-remember" className="text-sm font-medium text-foreground cursor-pointer">
          Lembrar acesso
        </Label>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 text-base font-bold bg-[#d4af37] text-[#1a3a52] hover:bg-[#c9a227] transition-all active:scale-[0.98] mt-2"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Entrando…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <LogIn className="w-5 h-5" /> Entrar
          </span>
        )}
      </Button>

      <div className="flex flex-col items-center gap-2 pt-1">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
          <button
            type="button"
            onClick={onCreateAccount}
            className="font-medium text-[#1a3a52] hover:text-[#d4af37] transition-colors"
          >
            Criar conta
          </button>
          <span className="text-border">·</span>
          <button
            type="button"
            onClick={onContact}
            className="font-medium text-[#1a3a52] hover:text-[#d4af37] transition-colors"
          >
            Contato
          </button>
        </div>
      </div>
    </form>
  );
};

export default LoginForm;
