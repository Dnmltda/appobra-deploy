import React from 'react';
import SimboloGirando from './SimboloGirando.jsx';

// Tela de "carregando" com o símbolo do APP OBRA girando em 3D (parado para quem pediu menos movimento).
const CarregandoCoroa = ({ texto = 'Carregando…' }) => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background" role="status" aria-live="polite">
    <SimboloGirando className="w-24" />
    <p className="text-sm font-medium text-marinho/80 tracking-wide">{texto}</p>
  </div>
);

export default CarregandoCoroa;
