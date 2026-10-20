// Limite de tentativas de login: 5 senhas erradas travam a conta por 15 minutos
// e a tela diz o que aconteceu (pb_hooks/login-limite.pb.js).
import { createRequire } from "module";
import { api, apiLogin, check, FRONT } from "./lib.mjs";
const require = createRequire(process.env.PLAYWRIGHT_DIR || "/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

const adm = await apiLogin("a@teste.local");
await api("POST", "/api/collections/users/records", adm.token, { email: "trava@teste.local", username: "travateste", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: adm.user.company_id, cargo: "Pedreiro", role: "Pedreiro", status: "Ativo", name: "Trava Teste" });

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
async function tentar(senha) {
  await page.goto(FRONT + "/login");
  await page.locator('[role="tabpanel"] input').first().fill("trava@teste.local");
  await page.locator('input[type="password"]').first().fill(senha);
  await page.locator('button[type="submit"]').first().click();
  const entrou = await page.waitForURL(/dashboard/, { timeout: 5000 }).then(() => true).catch(() => false);
  return { entrou, txt: await page.locator("body").innerText() };
}
for (let i = 0; i < 5; i++) await tentar("errada" + i);
const t = await tentar("Senha12345");
check("Depois de 5 senhas erradas, nem a senha certa entra", !t.entrou);
check("A tela explica: muitas tentativas, tempo de espera e 'Esqueci minha senha'",
  /Muitas tentativas/.test(t.txt) && /minuto/.test(t.txt) && /Esqueci minha senha/.test(t.txt), (t.txt.match(/Muitas[^\n]*/) || [""])[0]);
await browser.close();
