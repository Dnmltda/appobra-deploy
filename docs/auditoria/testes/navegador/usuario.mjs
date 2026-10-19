// Nome de usuário: login pela aba "Usuário" com conta antiga gravada com
// maiúscula, login pela aba "ID" digitando "1", e a pessoa trocando o
// próprio usuário no perfil (pedido do Diego, 19/10/2026).
import { createRequire } from "module";
import { abrir, api, check, OUT, FRONT } from "./lib.mjs";
const require = createRequire(process.env.PLAYWRIGHT_DIR || "/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" });
// B com outra senha: o ID 01 existe nas duas empresas.
const b = (await api("GET", "/api/collections/users/records?filter=" + encodeURIComponent('email="b@teste.local"'), su.data.token)).data.items[0];
await api("PATCH", `/api/collections/users/records/${b.id}`, su.data.token, { password: "SenhaB12345", passwordConfirm: "SenhaB12345" });

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
async function tentar(aba, ident, senha) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  await page.goto(FRONT + "/login");
  await page.getByRole("tab", { name: aba, exact: true }).click();
  await page.locator('[role="tabpanel"] input').first().fill(ident);
  await page.locator('input[type="password"]').first().fill(senha);
  await page.locator('button[type="submit"]').first().click();
  const ok = await page.waitForURL(/dashboard/, { timeout: 8000 }).then(() => true).catch(() => false);
  const texto = ok ? "" : (await page.locator("body").innerText()).match(/(incorret|inválid|não encontrado|mais de uma empresa)[^\n]*/i)?.[0] || "";
  await page.close();
  return { ok, texto };
}

let t = await tentar("ID", "1", "Senha12345");
check("Aba ID: digitar '1' entra na conta 01", t.ok, t.texto);
t = await tentar("Usuário", "AdminA", "Senha12345");
check("Aba Usuário: maiúscula/minúscula não importa", t.ok, t.texto);

// Troca o próprio usuário no perfil
const { page } = await abrir("a@teste.local");
await page.goto(FRONT + "/profile");
await page.getByRole("button", { name: /Editar Perfil/ }).click();
const campo = page.locator('input[autocomplete="username"]');
await campo.fill("Diego Escolhido");
check("Perfil: campo de usuário tira espaço e maiúscula ao digitar", (await campo.inputValue()) === "diegoescolhido", await campo.inputValue());
await campo.fill("diego.escolhido");
await page.getByRole("button", { name: /Salvar/ }).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: OUT + "perfil-usuario.png" });
check("Perfil: usuário novo aparece salvo", /diego\.escolhido/.test(await page.locator("body").innerText()));
t = await tentar("Usuário", "diego.escolhido", "Senha12345");
check("Aba Usuário: entra com o usuário escolhido no perfil", t.ok, t.texto);

// Usuário já em uso: mensagem clara
await page.getByRole("button", { name: /Editar Perfil/ }).click();
await campo.fill("adminb");
await page.getByRole("button", { name: /Salvar/ }).click();
await page.waitForTimeout(1500);
check("Perfil: usuário já em uso mostra mensagem clara", /já está em uso/.test(await page.locator("body").innerText()));
await browser.close();
