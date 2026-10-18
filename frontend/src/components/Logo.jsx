import React from 'react';
const Logo = ({
  size = 'md',
  variant = 'dark'
}) => {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl'
  };
  const variantClasses = {
    dark: 'text-[#1a3a52]',
    light: 'text-white'
  };
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20'
  };
  return <div className="flex items-center gap-3">
      <img src="https://horizons-cdn.hostinger.com/3cd53c25-c948-4ae2-89ce-121b834cf36a/logotipo-app-obra-2-pGaoY.png" alt="DNM&LTDA Logo" className={`object-contain ${iconSizes[size]}`} />
      <div className="flex flex-col">
        <span className={`font-bold tracking-tight leading-tight ${sizeClasses[size]} ${variantClasses[variant]}`}>
          DNM&LTDA
        </span>
        <span className={`text-[#d4af37] font-semibold uppercase ${size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm'}`}>
          APP OBRA
        </span>
      </div>
    </div>;
};
export default Logo;