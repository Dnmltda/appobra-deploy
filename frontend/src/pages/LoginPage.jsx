import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, HardHat, BarChart3, ClipboardList, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useCompany } from '@/contexts/CompanyContext.jsx';
import { useSessionManager } from '@/hooks/useSessionManager.js';

import LoginHeader from '@/components/Login/LoginHeader.jsx';
import LoginFooter from '@/components/Login/LoginFooter.jsx';
import LoginForm from '@/components/Login/LoginForm.jsx';
import SocialLoginButtons from '@/components/Login/SocialLoginButtons.jsx';
import PasswordRecoveryModal from '@/components/Login/PasswordRecoveryModal.jsx';
import CreateAccountModal from '@/components/Login/CreateAccountModal.jsx';
import ContactModal from '@/components/Login/ContactModal.jsx';

import Logo from '@/components/Logo.jsx';
import Coroa from '@/components/marca/Coroa.jsx';
import BotaoInstalar from '@/components/marca/BotaoInstalar.jsx';

const INSTITUTIONAL_IMAGE =
  'https://images.hostinger.com/737561dd-cbc6-443f-adeb-dd0a499eeb70.png';

const FEATURES = [
  { icon: HardHat, title: 'Gestão de Obras', desc: 'Controle completo de obras, equipes e cronogramas.' },
  { icon: ClipboardList, title: 'Materiais & EPIs', desc: 'Estoque, movimentações e entregas de EPI em tempo real.' },
  { icon: BarChart3, title: 'Financeiro & Relatórios', desc: 'Dashboards, contas e indicadores em um só lugar.' },
  { icon: ShieldCheck, title: 'Seguro & Multitenant', desc: 'Isolamento por empresa com auditoria completa.' },
];

const LoginPage = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { currentCompany } = useCompany();
  const { theme, setTheme } = useTheme();
  const session = useSessionManager({ enabled: false });

  const [showRecovery, setShowRecovery] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Redireciona ao detectar login bem-sucedido (evento do LoginForm) ou
  // quando o currentUser passa a existir (AuthContext).
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const handler = () => {
      // pequeno atraso para o AuthContext estabilizar o currentUser
      setTimeout(() => navigate('/dashboard', { replace: true }), 200);
    };
    window.addEventListener('appobra:login-success', handler);
    return () => window.removeEventListener('appobra:login-success', handler);
  }, [navigate]);

  const companyName = currentCompany?.name || '';

  const welcomeMessage = currentUser
    ? `Bem-vindo de volta!`
    : `Acesse sua conta para gerenciar suas obras com eficiência.`;

  return (
    <>
      <Helmet>
        <title>Portal de Acesso - APP OBRA | DNM&LTDA</title>
        <meta
          name="description"
          content="Portal de acesso seguro ao APP OBRA — Sistema Integrado de Gestão para Construção Civil. Login com email, ID ou usuário."
        />
      </Helmet>

      <div className="min-h-screen w-full flex bg-white relative overflow-hidden">
        {/* Painel institucional (esquerda) — oculto em mobile */}
        <aside className="hidden lg:flex lg:w-1/2 relative">
          <div className="absolute inset-0">
            <img
              src={INSTITUTIONAL_IMAGE}
              alt="Obra de construção civil gerenciada pelo APP OBRA"
              className="w-full h-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-marinho/90 via-marinho/70 to-marinho/40" />
          </div>

          <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
            <div className="flex items-center gap-3">
              <Coroa brilho className="w-12 h-12" />
              <div className="flex flex-col">
                <span className="font-titulo font-bold text-xl tracking-tight">DNM&LTDA</span>
                <span className="text-ouro font-semibold uppercase text-xs tracking-wide">
                  APP OBRA
                </span>
              </div>
            </div>

            <div className="space-y-6 max-w-md">
              <h2 className="text-4xl font-bold leading-tight text-white">
                Gestão completa para sua obra, em um só lugar.
              </h2>
              <p className="text-white/80 text-lg">
                Controle obras, materiais, EPIs, frota e financeiro com dados em tempo real e
                segurança de nível empresarial.
              </p>
              <ul className="space-y-4">
                {FEATURES.map((f) => (
                  <li key={f.title} className="flex items-start gap-3">
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-ouro/20 border border-ouro/30 shrink-0">
                      <f.icon className="w-5 h-5 text-ouro" />
                    </span>
                    <div>
                      <p className="font-semibold text-white">{f.title}</p>
                      <p className="text-sm text-white/70">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-white/50 text-xs">
              © {new Date().getFullYear()} DNM&LTDA. Todos os direitos reservados.
            </p>
          </div>
        </aside>

        {/* Painel de login (direita) */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-12 relative">
          {/* Fundo decorativo */}
          <div className="absolute inset-0 opacity-[0.02] bg-[radial-gradient(#0A1F4D_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

          {/* Toggle de tema (estrutura preparada para dark mode) */}
          <div className="absolute top-4 right-4 z-20">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
              className="rounded-full text-marinho hover:bg-ouro/10"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>

          <Card className="w-full max-w-md z-10 shadow-xl border-border/50 bg-[#F8F9FB] animate-in fade-in slide-in-from-bottom-2 duration-500">
            <CardContent className="pt-8 pb-6 px-6 sm:px-8">
              <LoginHeader companyName={companyName} onAbout={() => setShowAbout(true)} />

              <p className="text-center text-sm text-muted-foreground mt-4 mb-6">
                {welcomeMessage}
              </p>

              <LoginForm
                onRecovery={() => setShowRecovery(true)}
                onCreateAccount={() => setShowCreateAccount(true)}
                onContact={() => setShowContact(true)}
              />

              <div className="mt-6">
                <SocialLoginButtons />
              </div>

              <div className="mt-4 flex justify-center">
                <BotaoInstalar className="w-full h-11" />
              </div>

              <LoginFooter
                serverStatus={session.serverStatus}
                latency={session.latency}
                isOnline={session.isOnline}
              />
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Modais */}
      <PasswordRecoveryModal open={showRecovery} onClose={() => setShowRecovery(false)} />
      <CreateAccountModal open={showCreateAccount} onClose={() => setShowCreateAccount(false)} />
      <ContactModal open={showContact} onClose={() => setShowContact(false)} />

      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <Logo size="md" variant="dark" />
            </div>
            <DialogTitle className="text-center text-marinho">DNM&LTDA</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-center -mt-2 mb-2">
            Empresa de tecnologia especializada em soluções digitais para negócios de todos os portes.
          </p>
          <div className="mb-2">
            <h2 className="text-sm font-bold text-marinho uppercase tracking-wide mb-3 text-center">
              Serviços Oferecidos
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'Criação de sites',
                'Aplicativos (apps)',
                'Produção de vídeos',
                'Criação de imagens',
                'Cabeamento de redes',
                'Configuração de roteadores',
              ].map((servico) => (
                <li
                  key={servico}
                  className="flex items-center gap-2 text-sm text-foreground bg-white rounded-lg px-3 py-2 border border-border/50"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-ouro shrink-0"></span>
                  {servico}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-center">
            <h2 className="text-sm font-bold text-marinho uppercase tracking-wide mb-2">Contato</h2>
            <a
              href="mailto:dnmltda@hotmail.com"
              className="text-sm text-marinho hover:text-ouro hover:underline transition-colors"
            >
              dnmltda@hotmail.com
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoginPage;
