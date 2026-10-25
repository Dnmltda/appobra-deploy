import Pocketbase from 'pocketbase';

// Backend em host separado (Fly.io) desde a migração de arquitetura de
// outubro/2026 — o frontend estático na Hostinger não tem mais o PocketBase
// no mesmo domínio, então a URL precisa ser absoluta, não mais relativa
// ('/hcgi/platform' só funcionava quando os dois ficavam juntos).
// VITE_POCKETBASE_URL só é usado em testes locais; em produção vale o Fly.io.
const POCKETBASE_API_URL = import.meta.env.VITE_POCKETBASE_URL || 'https://appobra-backend.fly.dev';

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

// Arquivos protegidos (auditoria de 24/10/2026, item A6): o servidor só
// entrega arquivo com um passe temporário de quem está logado (vale 1 hora,
// pb_hooks/arquivos-protegidos.pb.js). O passe é renovado a cada 30 minutos e
// entra sozinho em todo link de arquivo (getURL), sem mexer em cada tela.
let tokenArquivos = '';
const getURLOriginal = pocketbaseClient.files.getURL.bind(pocketbaseClient.files);
pocketbaseClient.files.getURL = (record, filename, query = {}) =>
  getURLOriginal(record, filename, tokenArquivos && !query?.token ? { ...query, token: tokenArquivos } : query);

export async function renovarTokenArquivos() {
  if (!pocketbaseClient.authStore.isValid) { tokenArquivos = ''; return; }
  try {
    tokenArquivos = await pocketbaseClient.files.getToken({ $autoCancel: false });
  } catch (_) { /* sem rede: tenta de novo na próxima renovação */ }
}
setInterval(renovarTokenArquivos, 30 * 60 * 1000);
pocketbaseClient.authStore.onChange(() => { renovarTokenArquivos(); });

export default pocketbaseClient;

export { pocketbaseClient };
