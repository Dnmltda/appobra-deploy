import React from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Inclina o cartão em 3D seguindo o mouse ou o dedo (no máximo 7 graus).
const Cartao3D = ({ children, className }) => {
  const reduzir = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [7, -7]), { stiffness: 220, damping: 18 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-7, 7]), { stiffness: 220, damping: 18 });
  if (reduzir) return <div className={className}>{children}</div>;

  const mover = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    x.set((ev.clientX - r.left) / r.width - 0.5);
    y.set((ev.clientY - r.top) / r.height - 0.5);
  };
  const soltar = () => { x.set(0); y.set(0); };

  return (
    <div className={cn('[perspective:800px]', className)}>
      <motion.div
        className="h-full"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        onPointerMove={mover}
        onPointerDown={mover}
        onPointerLeave={soltar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default Cartao3D;
