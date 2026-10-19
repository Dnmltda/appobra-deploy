// Convite pendente + "Esqueci minha senha" (caso real de 19/10/2026: a pessoa
// trocou a senha pelo "Esqueci" e ficou presa em "Conta inativa").
import { createRequire } from "module";
import { api, apiLogin, check, FRONT, OUT, fs } from "./lib.mjs";
const require = createRequire(process.env.PLAYWRIGHT_DIR || "/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const SINK = process.env.SINK;
const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" });
await api("PATCH", "/api/settings", su.data.token, { smtp: { enabled: true, host: "127.0.0.1", port: 2525, tls: false, username: "", password: "" } });
const adm = await apiLogin("a@teste.local");
const EMAIL = "pessoa.convite@teste.local";
const SENHA = "MinhaSenha@123";

const novosEmails = async (antes, filtro) => {
  for (let i = 0; i < 20; i++) {
    const l = fs.readdirSync(SINK).filter((f) => !antes.has(f)).map((f) => fs.readFileSync(SINK + "/" + f, "utf8")).filter(filtro);
    if (l.length) { await new Promise((r) => setTimeout(r, 800)); return fs.readdirSync(SINK).filter((f) => !antes.has(f)).map((f) => fs.readFileSync(SINK + "/" + f, "utf8")).filter(filtro); }
    await new Promise((r) => setTimeout(r, 300));
  }
  return [];
};
const qp = (s) => s.replace(/=\r?\n/g, "").replace(/=3D/g, "=");

// 1. Administrador cria o acesso (convite)
let antes = new Set(fs.readdirSync(SINK));
const cr = await api("POST", "/api/collections/users/records", adm.token, {
  email: EMAIL, username: "pessoa.convite", name: "Pessoa Convite", password: "Descartavel123!", passwordConfirm: "Descartavel123!",
  company_id: adm.user.company_id, cargo: "Pedreiro", role: "Pedreiro", status: "Inativo", is_active: false,
  password_reset_token: crypto.randomUUID(), password_reset_expires: new Date(Date.now() + 7 * 864e5).toISOString(),
});
check("(preparo) acesso criado com convite", cr.status === 200, JSON.stringify(cr.data).slice(0, 120));
const conv1 = await novosEmails(antes, (x) => x.includes(EMAIL) && /Seu acesso ao APP OBRA/.test(x));
const link1 = (qp(conv1[0] || "").match(/https?:\/\/[^"\s<]+\/ativar-conta\?token=[A-Za-z0-9-]+/) || [""])[0];
check("Convite inicial chega", !!link1);

// 2. A pessoa usa "Esqueci minha senha" em vez do convite
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
antes = new Set(fs.readdirSync(SINK));
const r = await api("POST", "/api/custom/esqueci-senha", null, { identificador: EMAIL });
check("Esqueci minha senha responde normal", r.status === 200);
const emails = await novosEmails(antes, (x) => x.includes(EMAIL));
const conv2 = emails.filter((x) => /Seu acesso ao APP OBRA/.test(x));
const reset = emails.filter((x) => /reset-password/.test(qp(x)));
check("Convite pendente: 'Esqueci minha senha' manda o CONVITE de novo (não o e-mail de trocar senha)", conv2.length === 1 && reset.length === 0,
  `convites ${conv2.length}, trocar-senha ${reset.length}, total ${emails.length}`);
const link2 = (qp(conv2[0] || "").match(/https?:\/\/[^"\s<]+\/ativar-conta\?token=[A-Za-z0-9-]+/) || [""])[0];
const velho = await api("POST", "/api/custom/get-invite-details", null, { token: link1.split("token=")[1] || "x" });
check("Link do convite anterior deixa de valer", velho.status >= 400, `status ${velho.status}`);

// 3. Ativa pelo convite novo e entra
await page.goto(link2.replace(/^https?:\/\/[^/]+/, FRONT));
await page.getByRole("button", { name: /Dados corretos/ }).click({ timeout: 15000 });
await page.locator("#ac-password").fill(SENHA);
await page.locator("#ac-confirm").fill(SENHA);
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(2500);
check("Pelo convite reenviado a pessoa cria a senha e ativa a conta", /ativada/i.test(await page.locator("body").innerText()));
await page.goto(FRONT + "/login");
await page.locator('[role="tabpanel"] input').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(SENHA);
await page.locator('button[type="submit"]').first().click();
check("Entra no app (sem 'Conta inativa')", await page.waitForURL(/dashboard/, { timeout: 10000 }).then(() => true).catch(() => false));

// 4. Acesso EXCLUÍDO não volta pelo "Esqueci minha senha"
const cr2 = await api("POST", "/api/collections/users/records", adm.token, {
  email: "excluido.convite@teste.local", username: "excluido.convite", name: "Excluido", password: "Descartavel123!", passwordConfirm: "Descartavel123!",
  company_id: adm.user.company_id, cargo: "Pedreiro", role: "Pedreiro", status: "Inativo", is_active: false,
  password_reset_token: crypto.randomUUID(), password_reset_expires: new Date(Date.now() + 7 * 864e5).toISOString(),
});
await api("DELETE", "/api/collections/users/records/" + cr2.data.id, adm.token);
antes = new Set(fs.readdirSync(SINK));
await api("POST", "/api/custom/esqueci-senha", null, { identificador: "excluido.convite@teste.local" });
const e4 = await novosEmails(antes, (x) => x.includes("excluido.convite@teste.local") && /Seu acesso ao APP OBRA/.test(x));
check("Acesso excluído: 'Esqueci minha senha' NÃO manda convite (não reativa)", e4.length === 0);

// 5. Mensagem da tela para conta ainda não ativa (senha certa)
const cr3 = await api("POST", "/api/collections/users/records", adm.token, {
  email: "pendente@teste.local", username: "pendente", name: "Pendente", password: "Senha12345", passwordConfirm: "Senha12345",
  company_id: adm.user.company_id, cargo: "Pedreiro", role: "Pedreiro", status: "Inativo", is_active: false,
});
await page.goto(FRONT + "/login");
await page.evaluate(() => localStorage.clear());
await page.goto(FRONT + "/login");
await page.locator('[role="tabpanel"] input').first().fill("pendente@teste.local");
await page.locator('input[type="password"]').first().fill("Senha12345");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(2500);
const txt = await page.locator("body").innerText();
check("Conta não ativa: tela explica o que fazer (convite / Esqueci minha senha)", /ainda não está ativa/.test(txt) && /Criar minha senha/.test(txt), (txt.match(/Sua conta[^\n]*/) || [""])[0]);
await page.screenshot({ path: OUT + "conta-nao-ativa.png" });
await browser.close();
