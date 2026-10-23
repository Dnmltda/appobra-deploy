import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { instalar, instalado, ehIOS, podeInstalar, ouvirInstalacao } from '@/lib/instalarApp.js';
import { cn } from '@/lib/utils';

// Botão "Instalar app": some quando o app já está instalado ou o navegador não permite.
// No iPhone mostra o passo a passo (lá não existe o botão do navegador).
const BotaoInstalar = ({ className, variant = 'outline', compacto = false }) => {
  const [pode, setPode] = useState(podeInstalar());
  const [ajudaIOS, setAjudaIOS] = useState(false);
  useEffect(() => ouvirInstalacao(() => setPode(podeInstalar())), []);

  const ios = ehIOS();
  if (instalado() || (!pode && !ios)) return null;

  return (
    <>
      <Button
        type="button" variant={variant} className={cn('gap-2', className)}
        onClick={() => (ios && !pode ? setAjudaIOS(true) : instalar())}
        title="Instalar o APP OBRA neste aparelho"
      >
        <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
        {!compacto && <span>Instalar app</span>}
      </Button>
      <Dialog open={ajudaIOS} onOpenChange={setAjudaIOS}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-marinho">Instalar no iPhone</DialogTitle>
            <DialogDescription>No Safari, em dois toques:</DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-2"><Share className="w-5 h-5 text-royal shrink-0" aria-hidden="true" />1. Toque em <b>Compartilhar</b>.</li>
            <li className="flex items-center gap-2"><PlusSquare className="w-5 h-5 text-royal shrink-0" aria-hidden="true" />2. Toque em <b>Adicionar à Tela de Início</b>.</li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BotaoInstalar;
