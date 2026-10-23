import React, { useEffect, useState } from 'react';
import { Download, CheckCircle2, Share, PlusSquare, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import IconeModulo3D from '@/components/marca/IconeModulo3D.jsx';
import { instalar, instalado, ehIOS, podeInstalar, ouvirInstalacao } from '@/lib/instalarApp.js';

// Configurações → "Instalar o APP OBRA": sempre aparece e diz o que fazer em cada aparelho.
const CartaoInstalarApp = () => {
  const [pode, setPode] = useState(podeInstalar());
  const [jaInstalado, setJaInstalado] = useState(instalado());
  useEffect(() => ouvirInstalacao(() => { setPode(podeInstalar()); setJaInstalado(instalado()); }), []);

  return (
    <Card className="cartao-creme shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center gap-3 space-y-0">
        <IconeModulo3D icon={Download} />
        <div>
          <CardTitle className="text-xl text-marinho">Instalar o APP OBRA</CardTitle>
          <CardDescription>Abre direto do computador ou da tela inicial do celular, em janela própria.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-3">
        {jaInstalado ? (
          <p className="flex items-center gap-2 font-medium text-green-700">
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> O APP OBRA já está instalado neste aparelho.
          </p>
        ) : pode ? (
          <Button type="button" className="h-11 gap-2" onClick={() => instalar()}>
            <Download className="w-4 h-4" aria-hidden="true" /> Instalar app
          </Button>
        ) : ehIOS() ? (
          <ol className="space-y-2">
            <li className="flex items-center gap-2"><Share className="w-5 h-5 text-royal shrink-0" aria-hidden="true" />1. No Safari, toque em <b>Compartilhar</b>.</li>
            <li className="flex items-center gap-2"><PlusSquare className="w-5 h-5 text-royal shrink-0" aria-hidden="true" />2. Toque em <b>Adicionar à Tela de Início</b>.</li>
          </ol>
        ) : (
          <div className="space-y-2 text-muted-foreground">
            <p>Este navegador não mostrou a opção de instalar agora. Use o <b>Google Chrome</b> ou o <b>Microsoft Edge</b>:</p>
            <p className="flex items-center gap-2">
              <MoreVertical className="w-5 h-5 text-royal shrink-0" aria-hidden="true" />
              abra o menu do navegador (⋮ ou ⋯) e escolha <b>Instalar APP OBRA</b> (no celular: <b>Adicionar à tela inicial</b>).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CartaoInstalarApp;
