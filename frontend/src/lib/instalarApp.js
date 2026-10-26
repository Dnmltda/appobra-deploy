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

// Aviso de versão nova (Bloco 4, aprovado pelo Diego em 26/10/2026). O app
// aberto há dias continua com o código antigo; de tempos em tempos (e quando a
// pessoa volta para o app) conferimos se a página publicada aponta para outro
// arquivo principal (/assets/index-XXXX.js muda de nome a cada versão).
const arquivoPrincipal = (html) => (String(html).match(/\/assets\/index-[\w-]+\.js/) || [])[0] || '';

export function vigiarVersaoNova(aoAchar) {
  if (!import.meta.env.PROD) return () => {};
  const atual = arquivoPrincipal(document.documentElement.innerHTML);
  if (!atual) return () => {};
  let avisado = false;
  const conferir = async () => {
    if (avisado || document.visibilityState === 'hidden') return;
    try {
      const r = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
      const publicado = arquivoPrincipal(await r.text());
      if (publicado && publicado !== atual) { avisado = true; aoAchar(); }
    } catch (_) { /* sem internet: tenta na próxima */ }
  };
  const t = setInterval(conferir, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', conferir);
  return () => { clearInterval(t); document.removeEventListener('visibilitychange', conferir); };
}
