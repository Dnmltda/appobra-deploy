import React from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

const LicenciamentoFrotaPage = () => {
  return (
    <>
      <Helmet><title>Licenciamentos - Frota</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary">Licenciamento e Seguros</h1>
            <p className="text-muted-foreground">Controle de documentação da frota</p>
          </div>

          <Card className="shadow-sm py-16 text-center">
            <CardContent className="flex flex-col items-center justify-center">
              <ShieldCheck className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h2 className="text-xl font-bold text-primary mb-2">Em Desenvolvimento</h2>
              <p className="text-muted-foreground max-w-md">Controle centralizado de IPVA, Seguros e Inspeções estará disponível em breve.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default LicenciamentoFrotaPage;