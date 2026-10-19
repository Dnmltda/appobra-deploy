// Convite de funcionário por e-mail: remetente com nome, botão com frase,
// link para o endereço certo, ativação da conta e primeiro login.
import { createRequire } from "module";
import { api, apiLogin, check, FRONT, fs } from "./lib.mjs";
const require = createRequire(process.env.PLAYWRIGHT_DIR || "/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const SINK = process.env.SINK;

const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" });
await api("PATCH", "/api/settings", su.data.token, { smtp: { enabled: true, host: "127.0.0.1", port: 2525, tls: false, username: "", password: "" } });

const lerEmail = (antes) => {
  for (let i = 0; i < 20; i++) {
    const novos = fs.readdirSync(SINK).filter((f) => !antes.has(f));
    if (novos.length) return fs.readFileSync(SINK + "/" + novos[0], "utf8");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  return "";
};
// Decodifica quoted-printable e separa a parte HTML.
const qp = (s) => s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const parteHtml = (eml) => {
  const m = eml.match(/Content-Type: text\/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(\r?\n--|$)/i);
  if (!m) return "";
  const corpo = m[1];
  return /Content-Transfer-Encoding: base64/i.test(eml.slice(m.index, m.index + 300))
    ? Buffer.from(corpo.replace(/\s/g, ""), "base64").toString("utf8") : Buffer.from(qp(corpo), "latin1").toString("utf8");
};

// O administrador convida (o mesmo que a tela Funcionários faz).
const adm = await apiLogin("a@teste.local");
const token = crypto.randomUUID();
const exp = new Date(Date.now() + 7 * 864e5).toISOString();
const antes = new Set(fs.readdirSync(SINK));
const cr = await api("POST", "/api/collections/users/records", adm.token, {
  email: "novo.pedreiro@teste.local", username: "novopedreiro", name: "Novo Pedreiro", password: "Descartavel123!", passwordConfirm: "Descartavel123!",
  company_id: adm.user.company_id, cargo: "Pedreiro", role: "Pedreiro", status: "Inativo",
  password_reset_token: token, password_reset_expires: exp,
});
check("(preparo) convite criado", cr.status === 200, JSON.stringify(cr.data).slice(0, 160));

const eml = lerEmail(antes);
const html = parteHtml(eml);
const de = (eml.match(/^From:.*$/mi) || [""])[0];
check("Convite: e-mail chegou", !!eml, (eml.match(/^Subject:.*$/mi) || ["nenhum"])[0]);
check("Convite: remetente aparece com o nome DNM&LTDA OBRAS", /DNM&LTDA OBRAS|DNM=26LTDA_OBRAS|DNM&LTDA_OBRAS/i.test(de) || /=\?utf-8\?/i.test(de), de);
const visivel = html.replace(/<[^>]+>/g, " ");
check("Convite: botão com a frase 'Criar minha senha'", /Criar minha senha/.test(visivel));
check("Convite: o endereço comprido não aparece no texto do e-mail", !/token=/.test(visivel) && !/https?:\/\//.test(visivel));
const link = (html.match(/href="([^"]+ativar-conta\?token=[^"]+)"/) || [])[1] || "";
check("Convite: link não vai mais para o endereço antigo da Hostinger", !!link && !/hostingersite/.test(link), link.replace(/token=.*/, "token=…"));

// A pessoa abre o botão, confirma os dados, cria a senha e entra.
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
await page.goto(link.replace(/^https?:\/\/[^/]+/, FRONT));
await page.getByRole("button", { name: /Dados corretos/ }).click({ timeout: 15000 });
await page.locator("#ac-password").fill("MinhaSenha@123");
await page.locator("#ac-confirm").fill("MinhaSenha@123");
await page.locator('button[type="submit"]').first().click();
await page.waitForTimeout(2500);
const txt = await page.locator("body").innerText();
check("Convite: pessoa cria a própria senha pela tela", /sucesso|ativad|login/i.test(txt), txt.slice(0, 120).replace(/\n/g, " | "));
await page.goto(FRONT + "/login");
await page.locator('[role="tabpanel"] input').first().fill("novo.pedreiro@teste.local");
await page.locator('input[type="password"]').first().fill("MinhaSenha@123");
await page.locator('button[type="submit"]').first().click();
const entrou = await page.waitForURL(/dashboard/, { timeout: 10000 }).then(() => true).catch(() => false);
check("Convite: entra no app com a senha criada", entrou);
await browser.close();
