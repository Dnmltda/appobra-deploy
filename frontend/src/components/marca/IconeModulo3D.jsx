import React from 'react';
import { cn } from '@/lib/utils';

// Ícone de módulo em selo dourado com relevo (Obras, Materiais, Ferramentas, EPIs, Compras...).
const TAMANHOS = { sm: ['w-9 h-9 rounded-lg', 'w-[18px] h-[18px]'], md: ['w-11 h-11 rounded-xl', 'w-6 h-6'], lg: ['w-14 h-14 rounded-2xl', 'w-7 h-7'] };

const IconeModulo3D = ({ icon: Icon, size = 'md', className }) => {
  const [caixa, icone] = TAMANHOS[size] || TAMANHOS.md;
  return (
    <span className={cn('icone-3d inline-flex items-center justify-center shrink-0', caixa, className)} aria-hidden="true">
      <Icon className={cn(icone, 'drop-shadow-[0_1px_0_rgba(255,255,255,0.45)]')} strokeWidth={2.25} />
    </span>
  );
};

export default IconeModulo3D;
