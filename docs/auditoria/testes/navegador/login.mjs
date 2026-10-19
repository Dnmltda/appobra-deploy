import { createRequire } from "module";
import { api, apiLogin, check, OUT, FRONT, fs } from "./lib.mjs";
const require = createRequire(process.env.PLAYWRIGHT_DIR || "/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const SINK = process.env.SINK;

const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" });
const r = await api("PATCH", "/api/settings", su.data.token, { smtp: { enabled: true, host: "127.0.0.1", port: 2525, tls: false, username: "", password: "" },
  meta: { appURL: FRONT, senderAddress: "dnmltda@hotmail.com", senderName: "DNM&LTDA" } });
check("(preparo) SMTP de teste configurado", r.status === 200, JSON.stringify(r.data).slice(0, 120));

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const novaPagina = async () => browser.newPage({ viewport: { width: 1366, height: 860 } });

async function tentar(aba, ident, senha) {
  const page = await novaPagina();
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

let t = await tentar("Email", "a@teste.local", "Senha12345");
check("Login pela aba Email", t.ok);
t = await tentar("Usuário", "admina", "Senha12345");
check("Login pela aba Usuário (antes não funcionava)", t.ok, t.texto);
const { user } = await apiLogin("a@teste.local");
t = await tentar("ID", user.id_unico, "Senha12345");
check("Aba ID com ID e senha iguais em duas empresas orienta a usar e-mail", !t.ok && /mais de uma empresa/.test(t.texto), t.texto);
const bLogin = await apiLogin("b@teste.local");
await api("PATCH", "/api/collections/users/records/" + bLogin.user.id, su.data.token, { password: "SenhaB12345", passwordConfirm: "SenhaB12345" });
t = await tentar("ID", user.id_unico, "Senha12345");
check(`Login pela aba ID (${user.id_unico}, repetido na Empresa B) entra na conta certa`, t.ok, t.texto);
t = await tentar("Email", "a@teste.local", "errada123");
check("Senha errada mostra mensagem clara", !t.ok && /incorret|inválid/i.test(t.texto), t.texto);

// ---- status da conta
const adm = await apiLogin("a@teste.local");
const mk = async (email, extra) => api("POST", "/api/collections/users/records", adm.token, { email, username: email.split("@")[0],
  password: "Senha12345", passwordConfirm: "Senha12345", company_id: adm.user.company_id, cargo: "Funcionário", role: "Funcionário",
  id_unico: String(Math.floor(Math.random() * 900) + 100), ...extra });
await mk("ativo.semflag@teste.local", { status: "Ativo", is_active: false });
await mk("inativo@teste.local", { status: "Inativo", is_active: true });
t = await tentar("Email", "ativo.semflag@teste.local", "Senha12345");
check("Conta 'Ativo' entra mesmo com is_active falso (contas antigas)", t.ok, t.texto);
{
  const page = await novaPagina();
  await page.goto(FRONT + "/login");
  await page.locator('[role="tabpanel"] input').first().fill("inativo@teste.local");
  await page.locator('input[type="password"]').first().fill("Senha12345");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  const txt = await page.locator("body").innerText();
  check("Conta 'Inativo' é barrada com mensagem clara", !/dashboard/.test(page.url()) && /inativ|não está ativa/i.test(txt));
  await page.close();
}

// ---- Esqueci minha senha (e-mail capturado pelo SMTP de teste)
const antes = new Set(fs.readdirSync(SINK));
let page = await novaPagina();
await page.goto(FRONT + "/login");
await page.getByText(/Esqueci|Esqueceu/i).first().click();
const dlg = page.getByRole("dialog");
await dlg.locator("input").first().fill("a@teste.local");
await dlg.getByRole("button", { name: /Enviar|Recuperar/i }).first().click();
await page.waitForTimeout(2500);
const novos = fs.readdirSync(SINK).filter((f) => !antes.has(f));
const eml = novos.length ? fs.readFileSync(SINK + "/" + novos[0], "utf8").replace(/=\r?\n/g, "").replace(/=3D/g, "=") : "";
const link = eml.match(/https?:\/\/[^"\s<]+\/reset-password\?token=[A-Za-z0-9._-]+/)?.[0];
check("Esqueci minha senha: e-mail enviado com link para /reset-password", !!link, novos.length ? (eml.match(/Subject:.*$/m) || [""])[0] : "nenhum e-mail");
check("Esqueci minha senha: e-mail mostra o botão 'Criar nova senha', sem o endereço comprido", /Criar nova senha/.test(eml) && !/>\s*https?:\/\/[^<]*reset-password/.test(eml));
await page.screenshot({ path: OUT + "esqueci-enviado.png" });
await page.close();

if (link) {
  page = await novaPagina();
  await page.goto(link.replace(/^https?:\/\/[^/]+/, FRONT));
  const senhas = page.locator('input[type="password"]');
  await senhas.nth(0).fill("NovaSenha@2026");
  await senhas.nth(1).fill("NovaSenha@2026");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + "reset-feito.png" });
  await page.close();
  t = await tentar("Email", "a@teste.local", "NovaSenha@2026");
  check("Entra com a senha nova criada pelo link", t.ok, t.texto);
  const reuso = await api("POST", "/api/collections/users/confirm-password-reset", null,
    { token: link.split("token=")[1], password: "Outra@2026x", passwordConfirm: "Outra@2026x" });
  check("Link de recuperação não serve duas vezes", reuso.status >= 400, `status ${reuso.status}`);
}

const nada = await api("POST", "/api/custom/esqueci-senha", null, { identificador: "naoexiste@teste.local" });
check("Conta inexistente recebe a mesma resposta (não revela quem tem conta)", nada.status === 200);
await browser.close();
