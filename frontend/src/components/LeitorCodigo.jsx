import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats as F } from 'html5-qrcode';
import { ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Leitor de código de barras / QR pela câmera do aparelho (pedido do Diego,
// 21/10/2026): aponta para a embalagem do material e devolve o código lido.
// Lê os códigos de embalagem (EAN-13, EAN-8, UPC, Code 128, Code 39, ITF) e QR.
const FORMATOS = [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.ITF, F.QR_CODE];

export const BotaoLerCodigo = ({ onLer, rotulo = 'Ler código de barras', variant = 'outline', size = 'sm' }) => {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setAberto(true)}>
        <ScanBarcode className="w-4 h-4 mr-1" />{rotulo}
      </Button>
      <LeitorCodigo aberto={aberto} onFechar={() => setAberto(false)} onLer={(c) => { setAberto(false); onLer(c); }} />
    </>
  );
};

const LeitorCodigo = ({ aberto, onFechar, onLer }) => {
  const leitorRef = useRef(null);
  const [erro, setErro] = useState('');
  const id = 'leitor-codigo';

  useEffect(() => {
    if (!aberto) return undefined;
    setErro('');
    let parado = false;
    const t = setTimeout(async () => {
      try {
        const leitor = new Html5Qrcode(id, { formatsToSupport: FORMATOS, verbose: false });
        leitorRef.current = leitor;
        await leitor.start({ facingMode: 'environment' }, { fps: 10, qrbox: (w, h) => ({ width: Math.max(200, Math.floor(w * 0.9)), height: Math.max(120, Math.floor(h * 0.5)) }) }, (texto) => {
          if (parado) return;
          parado = true;
          leitor.stop().catch(() => {}).finally(() => onLer(String(texto).trim()));
        }, () => {});
      } catch (_) {
        setErro('Não foi possível abrir a câmera. Libere a câmera para o app.');
      }
    }, 250);
    return () => {
      clearTimeout(t);
      parado = true;
      const l = leitorRef.current;
      leitorRef.current = null;
      if (l?.isScanning) l.stop().catch(() => {});
    };
  }, [aberto]);

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader><DialogTitle>Aponte a câmera para o código</DialogTitle></DialogHeader>
        <div id={id} className="w-full rounded-md overflow-hidden bg-black min-h-[220px]" />
        {erro ? <p className="text-sm text-red-700">{erro}</p>
          : <p className="text-xs text-muted-foreground">Segure o código de barras da embalagem dentro do quadro, sem reflexo.</p>}
        <div className="flex justify-end"><Button variant="outline" onClick={onFechar}>Cancelar</Button></div>
      </DialogContent>
    </Dialog>
  );
};

export default LeitorCodigo;
