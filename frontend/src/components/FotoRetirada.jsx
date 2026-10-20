import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, SwitchCamera, ImageUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Foto de quem retira (material, EPI, equipamento). Pedido do Diego,
// 20/10/2026: na hora da retirada a câmera do aparelho tira a foto da pessoa
// levando o material, para não ficar a dúvida "retirou ou não retirou".
// Abre a câmera, conta 3 segundos e tira sozinha; dá para tirar de novo ou
// trocar a câmera (frente/trás). Sem câmera (ou sem permissão), escolhe uma
// foto do aparelho. O servidor exige a foto (pb_hooks/foto-retirada.pb.js).
// onFoto recebe um File (JPEG) ou null.
const LARGURA_MAX = 1280;
const CONTAGEM = 3;

const FotoRetirada = ({ onFoto, rotulo = 'Foto de quem está retirando' }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ligada, setLigada] = useState(false);
  const [frente, setFrente] = useState(false);
  const [contando, setContando] = useState(0);
  const [previa, setPrevia] = useState('');
  const [erro, setErro] = useState('');

  const parar = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLigada(false);
    setContando(0);
  };

  useEffect(() => () => {
    parar();
  }, []);
  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa); }, [previa]);

  const usar = (arquivo) => {
    setPrevia(arquivo ? URL.createObjectURL(arquivo) : '');
    onFoto(arquivo);
  };

  const ligar = async (usarFrente = frente) => {
    setErro('');
    usar(null);
    parar();
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro('Este aparelho não deixa abrir a câmera aqui. Use "Escolher foto".');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: usarFrente ? 'user' : 'environment', width: { ideal: 1280 } }, audio: false,
      });
      streamRef.current = stream;
      setLigada(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
      setContando(CONTAGEM);
    } catch (_) {
      setErro('Não foi possível abrir a câmera. Libere a câmera para o app ou use "Escolher foto".');
    }
  };

  // Contagem: 3, 2, 1... e tira sozinha.
  useEffect(() => {
    if (!ligada || contando <= 0) return undefined;
    const t = setTimeout(() => {
      if (contando === 1) capturar();
      else setContando(contando - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [ligada, contando]);

  const capturar = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { setContando(CONTAGEM); return; }
    const escala = Math.min(1, LARGURA_MAX / v.videoWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * escala);
    c.height = Math.round(v.videoHeight * escala);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      parar();
      if (blob) usar(new File([blob], `retirada-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.85);
  };

  const escolher = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErro('Escolha uma imagem.'); return; }
    parar();
    setErro('');
    usar(f);
  };

  return (
    <div className="space-y-2 rounded-lg border p-3 bg-white">
      <p className="text-sm font-semibold flex items-center gap-2"><Camera className="w-4 h-4" />{rotulo} *</p>
      {ligada && (
        <div className="relative overflow-hidden rounded-md bg-black">
          <video ref={videoRef} playsInline muted className="w-full max-h-72 object-contain" aria-label="Câmera" />
          {contando > 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-white drop-shadow">{contando}</span>
          )}
        </div>
      )}
      {!ligada && previa && <img src={previa} alt="Foto tirada" className="w-full max-h-72 object-contain rounded-md border" />}
      {erro && <p className="text-xs text-red-700">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        {!ligada && (
          <Button type="button" size="sm" variant={previa ? 'outline' : 'default'} onClick={() => ligar()}>
            {previa ? <><RefreshCw className="w-4 h-4 mr-1" />Tirar outra</> : <><Camera className="w-4 h-4 mr-1" />Abrir câmera</>}
          </Button>
        )}
        {ligada && (
          <>
            <Button type="button" size="sm" onClick={capturar}><Camera className="w-4 h-4 mr-1" />Tirar agora</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { const f = !frente; setFrente(f); ligar(f); }}>
              <SwitchCamera className="w-4 h-4 mr-1" />Trocar câmera
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={parar}>Cancelar</Button>
          </>
        )}
        {!ligada && (
          <label className="inline-flex items-center gap-1 h-9 px-3 rounded-md border text-sm cursor-pointer hover:bg-muted">
            <ImageUp className="w-4 h-4" />Escolher foto
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={escolher} aria-label="Escolher foto" />
          </label>
        )}
      </div>
      {!previa && !ligada && <p className="text-xs text-muted-foreground">A câmera conta 3 segundos e tira a foto sozinha.</p>}
    </div>
  );
};

export default FotoRetirada;
