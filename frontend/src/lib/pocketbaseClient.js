import Pocketbase from 'pocketbase';

// Backend em host separado (Fly.io) desde a migração de arquitetura de
// outubro/2026 — o frontend estático na Hostinger não tem mais o PocketBase
// no mesmo domínio, então a URL precisa ser absoluta, não mais relativa
// ('/hcgi/platform' só funcionava quando os dois ficavam juntos).
// VITE_POCKETBASE_URL só é usado em testes locais; em produção vale o Fly.io.
const POCKETBASE_API_URL = import.meta.env.VITE_POCKETBASE_URL || 'https://appobra-backend.fly.dev';

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
