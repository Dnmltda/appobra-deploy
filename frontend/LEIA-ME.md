# APP OBRA — telas (frontend)

Código-fonte das telas (React + Vite), exportado do Hostinger Horizons. Original no notebook do Diego:
`C:\Users\Diego\Documents\appobra-app\apps\web`. Enviado em 18/10/2026.

Conferido: gera exatamente a versão publicada (mesmas rotas, tabelas e textos; CSS idêntico,
`index-V_Lakd0R.css`). `package-lock.json` foi gerado no recebimento para fixar as versões.

O app conversa com `https://appobra-backend.fly.dev` (`src/lib/pocketbaseClient.js`).

## Gerar o app

```bash
cd frontend
npm ci
npx vite build --outDir dist
```

O resultado (`dist/`) é o que vai em `pb_public/` dentro do `appobra_deploy_final.zip` e/ou na
hospedagem estática da Hostinger.

**Regra:** a partir de agora as telas são alteradas **aqui** (GitHub), não mais no Horizons — senão as
duas cópias se separam.
