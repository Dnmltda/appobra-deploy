import React from 'react';
import { cn } from '@/lib/utils';

// Símbolo do APP OBRA (capacete com a coroa) girando em 3D no eixo vertical.
const SimboloGirando = ({ className }) => (
  <span className={cn('inline-block', className)} style={{ perspective: '400px' }}>
    <img src="/app-obra-simbolo.svg" alt="" className="giro-coroa block w-full h-auto" draggable="false" />
  </span>
);

export default SimboloGirando;
