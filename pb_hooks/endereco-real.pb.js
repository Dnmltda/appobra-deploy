/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Endereço real de quem acessa (auditoria de 24/10/2026, item A7, aprovado
// pelo Diego). O limite de logins por endereço confiava no cabeçalho
// "X-Real-IP", que o visitante pode inventar (cada tentativa com um endereço
// falso escapava do limite). No Fly o endereço real vem em "Fly-Client-IP",
// colocado pelo próprio Fly. Fora do Fly (testes locais) esse cabeçalho não
// existe e vale o endereço da conexão.
// ============================================================

onBootstrap((e) => {
  e.next();
  try {
    const s = e.app.settings();
    const atual = JSON.stringify(s.trustedProxy.headers || []);
    if (atual !== JSON.stringify(["Fly-Client-IP"])) {
      s.trustedProxy.headers = ["Fly-Client-IP"];
      s.trustedProxy.useLeftmostIP = false;
      e.app.save(s);
      console.log(`[endereco-real] endereço de quem acessa agora vem do Fly-Client-IP (antes: ${atual}).`);
    }
  } catch (err) {
    console.log("[endereco-real] Erro:", err);
  }
});
