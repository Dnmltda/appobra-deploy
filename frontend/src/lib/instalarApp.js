// Instalar o APP OBRA no computador ou no celular (pedido do Diego, 23/10/2026).
// O navegador avisa uma única vez, logo ao abrir, que o app pode ser instalado
// ("beforeinstallprompt"); guardamos esse aviso para o botão "Instalar app".
let aviso = null;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach((f) => f());

export const instalado = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// iPhone/iPad não têm o aviso: lá se instala por Compartilhar → Adicionar à Tela de Início.
export const ehIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const podeInstalar = () => !!aviso;

export const ouvirInstalacao = (f) => { ouvintes.add(f); return () => ouvintes.delete(f); };

export async function instalar() {
  if (!aviso) return false;
  const a = aviso;
  aviso = null;
  avisar();
  await a.prompt();
  const { outcome } = await a.userChoice;
  return outcome === 'accepted';
}

export function prepararInstalacao() {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); aviso = e; avisar(); });
  window.addEventListener('appinstalled', () => { aviso = null; avisar(); });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}
