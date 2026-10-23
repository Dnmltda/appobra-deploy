import React from 'react';
import Coroa from '@/components/marca/Coroa.jsx';

// Logotipo oficial da DNM&LTDA (arquivos em public/, recortados sem redesenhar):
//  - sm/md: só a coroa, num selo, ao lado do nome do app (menu e cabeçalhos).
//  - lg: coroa + nome, com brilho dourado (login).
const Logo = ({
  size = 'md',
  variant = 'dark'
}) => {
  if (size === 'lg') {
    return <span className="brilho-ouro inline-block rounded-2xl ring-1 ring-ouro-escuro/30 shadow-md">
        <img src="/marca-dnm.webp" alt="DNM&LTDA" className="block w-56 sm:w-64 h-auto rounded-2xl" draggable="false" />
      </span>;
  }
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl'
  };
  const variantClasses = {
    dark: 'text-marinho',
    light: 'text-white'
  };
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11'
  };
  return <div className="flex items-center gap-3">
      <Coroa className={iconSizes[size]} />
      <div className="flex flex-col">
        <span className={`font-titulo font-bold tracking-tight leading-tight ${sizeClasses[size]} ${variantClasses[variant]}`}>
          DNM&LTDA
        </span>
        <span className={`text-ouro font-semibold uppercase tracking-widest ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>
          APP OBRA
        </span>
      </div>
    </div>;
};
export default Logo;
