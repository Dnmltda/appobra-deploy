import React from 'react';
import { Button } from '@/components/ui/button';
import { KeyRound } from 'lucide-react';

// Estrutura preparada para logins sociais (Google, Microsoft, Apple) e SSO.
// NÃO implementados neste momento — apenas placeholders visuais desabilitados,
// conforme regras do Portal de Acesso. A estrutura fica pronta para ativação futura.

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
    <path fill="#F25022" d="M3 3h8v8H3z" />
    <path fill="#7FBA00" d="M13 3h8v8h-8z" />
    <path fill="#00A4EF" d="M3 13h8v8H3z" />
    <path fill="#FFB900" d="M13 13h8v8h-8z" />
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
    <path d="M16.36 12.78c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.11 1.67 2.35 2.86 2.31 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 3 .72 1.24-.02 2.02-1.13 2.78-2.24.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.42-.93-2.44-3.69zM14.2 5.62c.63-.77 1.06-1.83.94-2.89-.91.04-2.01.61-2.66 1.37-.58.68-1.09 1.76-.96 2.8 1.02.08 2.05-.52 2.68-1.28z" />
  </svg>
);

const PROVIDERS = [
  { id: 'google', label: 'Google', icon: <GoogleIcon />, enabled: false },
  { id: 'microsoft', label: 'Microsoft', icon: <MicrosoftIcon />, enabled: false },
  { id: 'apple', label: 'Apple', icon: <AppleIcon />, enabled: false },
  { id: 'sso', label: 'SSO', icon: <KeyRound className="w-4 h-4" />, enabled: false },
];

const SocialLoginButtons = ({ onSelect }) => {
  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#F8F9FB] px-3 text-muted-foreground font-semibold tracking-wide">
            Acesso social
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {PROVIDERS.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            disabled
            title={p.enabled ? `Entrar com ${p.label}` : `${p.label} — em breve`}
            onClick={() => p.enabled && onSelect && onSelect(p.id)}
            className="h-10 bg-white/70 border-border/60 text-foreground hover:bg-white"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {p.icon}
              {p.label}
            </span>
          </Button>
        ))}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Logins sociais estarão disponíveis em breve.
      </p>
    </div>
  );
};

export default SocialLoginButtons;
