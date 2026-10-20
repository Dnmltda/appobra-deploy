import React, { useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient';

// Mostra uma foto protegida do PocketBase (ex.: foto_retirada): o arquivo só
// abre com um token de quem está logado. Clique abre a foto grande.
const FotoProtegida = ({ record, campo = 'foto_retirada', alt = 'Foto da retirada', className = 'h-24 w-24' }) => {
  const [url, setUrl] = useState('');
  const nome = record?.[campo];
  useEffect(() => {
    let vivo = true;
    if (!nome) { setUrl(''); return undefined; }
    pb.files.getToken({ $autoCancel: false })
      .then((token) => { if (vivo) setUrl(pb.files.getURL(record, nome, { token })); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [record?.id, nome]);
  if (!nome) return null;
  if (!url) return <div className={`${className} rounded-md bg-muted animate-pulse`} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Abrir a foto">
      <img src={url} alt={alt} className={`${className} object-cover rounded-md border`} />
    </a>
  );
};

export default FotoProtegida;
