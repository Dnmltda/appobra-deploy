import React from 'react';

// Logo do APP OBRA (aprovado pelo Diego em 23/10/2026; arquivos em docs/marca/app-obra):
//  - sm/md: símbolo (capacete com a coroa) + nome, no menu e cabeçalhos.
//  - lg: versão vertical completa (login).
const Logo = ({
  size = 'md',
  variant = 'dark'
}) => {
  if (size === 'lg') {
    return <img src={variant === 'light' ? '/app-obra-vertical-escuro.svg' : '/app-obra-vertical-claro.svg'} alt="APP OBRA by DNM&LTDA" className="block w-60 sm:w-64 h-auto" draggable="false" />;
  }
  const iconSizes = {
    sm: 'w-9 h-auto',
    md: 'w-12 h-auto'
  };
  const corNome = variant === 'light' ? 'text-creme' : 'text-marinho';
  const corAssinatura = variant === 'light' ? 'text-ouro' : 'text-ouro-escuro';
  return <div className="flex items-center gap-3">
      <img src="/app-obra-simbolo.svg" alt="" className={`shrink-0 ${iconSizes[size]}`} draggable="false" />
      <div className="flex flex-col">
        <span className={`font-titulo font-black tracking-tight leading-tight ${size === 'sm' ? 'text-lg' : 'text-2xl'} ${corNome}`}>
          APP OBRA
        </span>
        <span className={`font-bold uppercase tracking-[0.2em] ${size === 'sm' ? 'text-[9px]' : 'text-[10px]'} ${corAssinatura}`}>
          by DNM&LTDA
        </span>
      </div>
    </div>;
};
export default Logo;
