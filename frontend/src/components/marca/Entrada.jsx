import React from 'react';
import { motion } from 'framer-motion';

// Entrada suave de telas e listas (o MotionConfig em App.jsx respeita "reduzir movimento").
export const Entrada = ({ children, className, atraso = 0 }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, ease: 'easeOut', delay: atraso }}
  >
    {children}
  </motion.div>
);

// Lista em que cada item entra um pouco depois do anterior.
export const ListaEntrada = ({ children, className }) => (
  <motion.div
    className={className}
    initial="oculto"
    animate="visivel"
    variants={{ visivel: { transition: { staggerChildren: 0.06 } } }}
  >
    {React.Children.map(children, (c) => c && (
      <motion.div
        className="min-w-0"
        variants={{ oculto: { opacity: 0, y: 14 }, visivel: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } } }}
      >
        {c}
      </motion.div>
    ))}
  </motion.div>
);
