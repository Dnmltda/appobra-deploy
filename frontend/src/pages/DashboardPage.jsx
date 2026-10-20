import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { podeAcessar } from '@/lib/permissoes.js';
import Header from '@/components/Header.jsx';
import { Button } from '@/components/ui/button';
import GestaoPainel from '@/components/dashboard/GestaoPainel.jsx';
import ObraPainel from '@/components/dashboard/ObraPainel.jsx';

// Painel inicial (pedido do Diego, 19/10/2026): um "mapa" simples da empresa,
// com números e gráficos SEMPRE vindos do banco (nada de exemplo). Cada bloco
// só aparece para quem tem acesso ao módulo e leva para a página dele.
//  - Quem gere (escritório, engenharia, almoxarifado...): GestaoPainel.
//  - Quem trabalha na obra (Pedreiro, Servente...): ObraPainel, bem simples.

// Se o cargo não abre nenhum destes módulos, é equipe de obra.
const MODULOS_GESTAO = [
  'obras', 'materiais', 'estoque', 'estoque_obras', 'movimentacoes', 'materiais_obra',
  'funcionarios', 'compras', 'financeiro', 'rh',
];

const saudacao = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const companyId = currentUser?.company_id;
  const equipeObra = !!currentUser && !MODULOS_GESTAO.some((m) => podeAcessar(currentUser, m));
  const nome = (currentUser?.nome_completo || currentUser?.name || '').trim().split(' ')[0];
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
      <Helmet><title>Painel - Gestão</title></Helmet>
      <Header />
      <main className="py-4 sm:py-8 bg-muted/20 min-h-screen overflow-x-hidden">
        <div className="app-container">
          <div className="mb-4 sm:mb-6 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary leading-tight">
                {saudacao()}{nome ? `, ${nome}` : ''}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 first-letter:uppercase">
                {hoje} · {equipeObra ? 'Seu resumo do dia' : 'Resumo da empresa'}
              </p>
            </div>
            {companyId && (
              <Button
                variant="outline" size="icon" className="h-11 w-11 shrink-0"
                onClick={() => setRefreshKey((k) => k + 1)} title="Atualizar" aria-label="Atualizar painel"
              >
                <RefreshCw className="w-5 h-5" aria-hidden="true" />
              </Button>
            )}
          </div>

          {!currentUser ? null : !companyId ? (
            <div className="text-center py-12 text-muted-foreground">
              Seu usuário não está ligado a nenhuma empresa. Fale com o administrador.
            </div>
          ) : equipeObra ? (
            <ObraPainel user={currentUser} refreshKey={refreshKey} />
          ) : (
            <GestaoPainel user={currentUser} refreshKey={refreshKey} />
          )}
        </div>
      </main>
    </>
  );
};

export default DashboardPage;
