import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

// QR Code e código de barras gerados no próprio aparelho (Etapa 5 da
// auditoria): antes iam para sites de fora (api.qrserver.com e
// bwipjs-api.fly.dev), que recebiam os dados do item.

// Conteúdo do QR de um item: o endereço do app que abre o item na leitura.
// Lido pela câmera do celular, abre o app; lido pela tela "QR Code", mostra o
// item direto. tipo: material | equipamento | epi.
export const linkDoItem = (tipo, id) => `${window.location.origin}/qrcode?ler=${tipo}:${id}`;

// Lê o conteúdo de um QR: { tipo, id } ou null. Aceita o link acima e o
// formato antigo ({"type":"Materiais","id":...}).
export const lerConteudo = (texto) => {
  const t = String(texto || '').trim();
  const m = t.match(/[?&]ler=(material|equipamento|epi):([a-z0-9]+)/i);
  if (m) return { tipo: m[1].toLowerCase(), id: m[2] };
  try {
    const j = JSON.parse(t);
    const tipo = /equip/i.test(j.type) ? 'equipamento' : /epi/i.test(j.type) ? 'epi' : 'material';
    if (j.item_id) return { tipo, id: j.item_id };
  } catch (_) { /* não é JSON */ }
  return null;
};

export const gerarQrDataUrl = (texto, tamanho = 320) =>
  QRCode.toDataURL(texto, { width: tamanho, margin: 1, errorCorrectionLevel: 'M' });

export const QrImagem = ({ texto, tamanho = 220, onPronto, className = '' }) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let vivo = true;
    if (!texto) { setUrl(''); return undefined; }
    gerarQrDataUrl(texto, tamanho * 2).then((u) => { if (vivo) { setUrl(u); onPronto?.(u); } }).catch(() => setUrl(''));
    return () => { vivo = false; };
  }, [texto, tamanho]);
  if (!url) return <div style={{ width: tamanho, height: tamanho }} className="bg-muted animate-pulse rounded" />;
  return <img src={url} alt="QR Code" width={tamanho} height={tamanho} className={className} />;
};

export const CodigoBarras = ({ texto, className = '' }) => {
  const ref = useRef(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!ref.current || !texto) return;
    try {
      JsBarcode(ref.current, texto, { format: 'CODE128', height: 60, displayValue: true, margin: 6 });
      setErro(false);
    } catch (_) { setErro(true); }
  }, [texto]);
  if (erro) return <p className="text-xs text-red-700">Código de barras inválido.</p>;
  return <svg ref={ref} className={className} aria-label="Código de barras" />;
};

// Página de impressão de uma etiqueta (QR + nome + código).
export const imprimirEtiqueta = (dataUrl, titulo, subtitulo) => {
  const w = window.open('', '_blank');
  if (!w) return;
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta</title></head>
<body style="text-align:center;font-family:sans-serif;margin:24px">
<img src="${dataUrl}" width="220" height="220"/><h2 style="margin:8px 0 4px">${esc(titulo)}</h2><p style="margin:0">${esc(subtitulo)}</p>
<script>window.onload=function(){window.print();setTimeout(function(){window.close()},300)}</script></body></html>`);
  w.document.close();
};
