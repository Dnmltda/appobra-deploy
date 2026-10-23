import React from 'react';
import Coroa from './Coroa.jsx';

// Tela de "carregando" com a coroa girando em 3D (parada para quem pediu menos movimento).
const CarregandoCoroa = ({ texto = 'Carregando…' }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background" role="status" aria-live="polite">
    <Coroa girando className="w-20 h-20" alt="" />
    <p className="text-sm font-medium text-marinho/80 tracking-wide">{texto}</p>
  </div>
);

export default CarregandoCoroa;
