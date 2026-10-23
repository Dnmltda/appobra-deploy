import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { motion } from 'framer-motion';
import SimboloGirando from '@/components/marca/SimboloGirando.jsx';
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
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#0A1F4D_1px,transparent_1px)] [background-size:24px_24px]"></div>
      
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
        <h1 className="sr-only">APP OBRA</h1>
        <img src="/app-obra-vertical-claro.svg" alt="APP OBRA by DNM&LTDA" className="w-[min(80vw,420px)] h-auto mb-6" />
        
        <div className="mt-6">
          <SimboloGirando className="w-14 mx-auto mb-4 block" />
          <p className="text-sm font-medium text-gray-500 tracking-widest uppercase">
            Versão 3.1
          </p>
        </div>
      </motion.div>
    </div>;
};
export default SplashScreen;