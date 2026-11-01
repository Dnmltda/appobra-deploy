// "Reenviar convite" na Gestão de Acessos (01/11/2026): o e-mail sai de
// verdade (antes não havia como reenviar por ali), com link novo; o link
// antigo deixa de valer; e sai um e-mail só (sem duplicar).
import { abrir, api, apiLogin, check, FRONT, OUT, fs } from "./lib.mjs";
const SINK = process.env.SINK;
const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" });
await api("PATCH", "/api/settings", su.data.token, { smtp: { enabled: true, host: "127.0.0.1", port: 2525, tls: false, username: "", password: "" } });
const { token, user } = await apiLogin("a@teste.local");
const EMAIL = "reenvio.nav@teste.local";
const jaTinha = new Set(fs.readdirSync(SINK)); // e-mails de rodadas anteriores não contam
const emails = () => fs.readdirSync(SINK).filter((f) => !jaTinha.has(f)).sort().map((f) => fs.readFileSync(SINK + "/" + f, "utf8")).filter((x) => x.includes(EMAIL) && /Seu acesso ao APP OBRA/.test(x));
const link = (eml) => ((eml || "").replace(/=\r?\n/g, "").replace(/=3D/g, "=").match(/ativar-conta\?token=([A-Za-z0-9]+)/) || [])[1] || "";
const esperar = async (n) => { for (let i = 0; i < 30 && emails().length < n; i++) await new Promise((r) => setTimeout(r, 300)); return emails(); };

const cr = await api("POST", "/api/collections/users/records", token, { email: EMAIL, username: "reenvionav", name: "Rui Reenvio", password: "Descartavel123!",
  passwordConfirm: "Descartavel123!", company_id: user.company_id, cargo: "Pedreiro", role: "Pedreiro", status: "Inativo",
  password_reset_token: crypto.randomUUID(), password_reset_expires: new Date(Date.now() + 7 * 864e5).toISOString() });
const primeiro = (await esperar(1))[0];
check("(preparo) convite inicial chegou", cr.status === 200 && !!primeiro);

const { browser, page, erros } = await abrir();
await page.goto(FRONT + "/usuarios/" + cr.data.id); await page.waitForTimeout(2500);
const botao = page.getByRole("button", { name: /Reenviar convite/ });
check("Detalhe do acesso com convite pendente mostra \"Reenviar convite\"", (await botao.count()) === 1);
await botao.click();
const aviso = await page.locator("[data-sonner-toast]").first().innerText({ timeout: 10000 }).catch(() => "");
check("Aviso de convite reenviado (com lembrete do spam)", /Convite reenviado/.test(aviso) && /spam/.test(aviso), aviso.slice(0, 120));
const lista = await esperar(2);
await new Promise((r) => setTimeout(r, 1500));
check("O e-mail do reenvio chega (um só, sem duplicar)", emails().length === 2, String(emails().length));
const novo = link(lista[1]), velho = link(primeiro);
check("O link novo é diferente do antigo", !!novo && novo !== velho);
const vNovo = await api("POST", "/api/custom/get-invite-details", null, { token: novo });
const vVelho = await api("POST", "/api/custom/get-invite-details", null, { token: velho });
check("Link novo abre; o antigo deixa de valer", vNovo.status === 200 && vVelho.status >= 400, `${vNovo.status} ${vVelho.status}`);
await page.screenshot({ path: OUT + "reenviar-convite.png", fullPage: true });

// Quem já está ativo não mostra o botão
await page.goto(FRONT + "/usuarios/" + user.id); await page.waitForTimeout(2000);
check("Acesso ativo não mostra \"Reenviar convite\"", (await page.getByRole("button", { name: /Reenviar convite/ }).count()) === 0);
check("Sem erro na tela", !erros.some((e) => /PAGEERROR/.test(e)), erros.filter((e) => /PAGEERROR/.test(e)).join(" | "));
await browser.close();
