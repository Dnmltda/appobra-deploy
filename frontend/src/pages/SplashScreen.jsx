import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { motion } from 'framer-motion';
const SplashScreen = () => {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    initialLoading
  } = useAuth();
  useEffect(() => {
    if (initialLoading) return;
    const timer = setTimeout(() => {
      navigate(isAuthenticated ? '/dashboard' : '/login');
    }, 3000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, initialLoading, navigate]);
  return <div className="min-h-screen bg-white flex flex-col items-center justify-center relative overflow-hidden">
      {/* Subtle dark blue pattern background */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#0F2744_1px,transparent_1px)] [background-size:24px_24px]"></div>
      
      <motion.div initial={{
      opacity: 0,
      scale: 0.95,
      y: 20
    }} animate={{
      opacity: 1,
      scale: 1,
      y: 0
    }} transition={{
      duration: 0.8,
      ease: "easeOut"
    }} className="z-10 flex flex-col items-center text-center">
        <img src="https://horizons-cdn.hostinger.com/3cd53c25-c948-4ae2-89ce-121b834cf36a/logotipo-app-obra-2-3DFTJ.png" alt="DNM&LTDA OBRAS Logo" className="w-40 h-40 object-contain mb-8 drop-shadow-md" />
        <h1 className="text-4xl md:text-5xl font-bold text-[#0F2744] tracking-tight mb-3">
          DNM&LTDA OBRAS
        </h1>
        <h2 className="text-2xl md:text-3xl font-semibold text-[#C9A227] tracking-wide mb-12">
          APP OBRA
        </h2>
        
        <div className="mt-16">
          <div className="w-12 h-1 bg-[#C9A227] mx-auto rounded-full mb-4 animate-pulse"></div>
          <p className="text-sm font-medium text-gray-500 tracking-widest uppercase">
            Versão 3.1
          </p>
        </div>
      </motion.div>
    </div>;
};
export default SplashScreen;