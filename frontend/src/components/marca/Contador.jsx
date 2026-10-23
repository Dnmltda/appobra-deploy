import React, { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

// Número que conta de 0 até o valor real. Só anima números; o resto aparece como veio.
const Contador = ({ valor, duracao = 0.9 }) => {
  const reduzir = useReducedMotion();
  const numero = typeof valor === 'number' && Number.isFinite(valor);
  const [atual, setAtual] = useState(numero && !reduzir ? 0 : valor);
  const anterior = useRef(0);

  useEffect(() => {
    if (!numero || reduzir) { setAtual(valor); return undefined; }
    const ctrl = animate(anterior.current, valor, {
      duration: duracao,
      ease: 'easeOut',
      onUpdate: (v) => setAtual(Number.isInteger(valor) ? Math.round(v) : v),
    });
    anterior.current = valor;
    return () => ctrl.stop();
  }, [valor, numero, reduzir, duracao]);

  if (!numero) return <>{valor}</>;
  return <>{Number(atual).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</>;
};

export default Contador;
