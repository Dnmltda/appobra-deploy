import React from 'react';
import { Helmet } from 'react-helmet';
import Header from '@/components/Header.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

const EscalasPage = () => {
  return (
    <>
      <Helmet><title>Escalas - RH</title></Helmet>
      <Header />
      <main className="py-8 bg-muted/30 min-h-screen">
        <div className="app-container">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary">Escalas de Trabalho</h1>
            <p className="text-muted-foreground">Planejamento e alocação</p>
          </div>

          <Card className="shadow-sm py-16 text-center">
            <CardContent className="flex flex-col items-center justify-center">
              <Calendar className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
              <h2 className="text-xl font-bold text-primary mb-2">Módulo em Desenvolvimento</h2>
              <p className="text-muted-foreground max-w-md">O gerenciamento visual de escalas e turnos estará disponível na próxima atualização do sistema.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default EscalasPage;