import React from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

const QuiloMetragemPage = () => {
  return (
    <>
      <Helmet><title>Quilometragem - Frota</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary">Controle de Quilometragem</h1>
            <p className="text-muted-foreground">Registros diários e histórico de rotas</p>
          </div>

          <Card className="shadow-sm py-16 text-center">
            <CardContent className="flex flex-col items-center justify-center">
              <TrendingUp className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h2 className="text-xl font-bold text-primary mb-2">Em Desenvolvimento</h2>
              <p className="text-muted-foreground max-w-md">Em breve será possível registrar origens, destinos, e cálculo de KM rodado por obra.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default QuiloMetragemPage;