import React from 'react';
import { cn } from '@/lib/utils';

// Coroa recortada do logotipo oficial da DNM&LTDA (sem redesenhar), num selo creme.
//  - brilho: reflexo dourado passando de tempos em tempos (login).
//  - girando: giro 3D no eixo vertical (carregando).
const Coroa = ({ className, brilho = false, girando = false, alt = 'DNM&LTDA' }) => (
  <span
    className={cn(
      'inline-flex items-center justify-center rounded-xl bg-creme ring-1 ring-ouro-escuro/30 shadow-sm',
      brilho && 'brilho-ouro',
      className,
    )}
    style={girando ? { perspective: '400px' } : undefined}
  >
    <img
      src="/coroa-dnm.webp"
      alt={alt}
      className={cn('w-[78%] h-[78%] object-contain', girando && 'giro-coroa')}
      draggable="false"
    />
  </span>
);

export default Coroa;
