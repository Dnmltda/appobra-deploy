import { createRequire } from "module";
import { abrir, api, apiLogin, check, OUT, FRONT, fs } from "./lib.mjs";
const require = createRequire(process.env.PLAYWRIGHT_DIR || "/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
const SINK = process.env.SINK;
const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" });
await api("PATCH", "/api/settings", su.data.token, { smtp: { enabled: true, host: "127.0.0.1", port: 2525, tls: false, username: "", password: "" },
  meta: { appURL: FRONT, senderAddress: "dnmltda@hotmail.com", senderName: "DNM&LTDA" } });

// ---- Fale conosco
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const antes = new Set(fs.readdirSync(SINK));
await page.goto(FRONT + "/login");
await page.getByText(/Contato|Fale conosco/i).first().click();
const d = page.getByRole("dialog");
const campos = d.locator("input, textarea");
await campos.nth(0).fill("Carlos Construtor");
await campos.nth(1).fill("carlos@cliente.com");
await d.locator("textarea").first().fill("Quero conhecer o APP OBRA para minha construtora.");
await d.locator('button[type="submit"]').click();
await page.waitForTimeout(2500);
const novos = fs.readdirSync(SINK).filter((f) => !antes.has(f));
const eml = novos.length ? fs.readFileSync(SINK + "/" + novos[0], "utf8") : "";
check("Fale conosco envia e-mail de verdade para dnmltda@hotmail.com com resposta para o cliente",
  /To:.*dnmltda@hotmail.com/i.test(eml) && /Reply-To:.*carlos@cliente.com/i.test(eml), novos.length ? "" : "nenhum e-mail");
await browser.close();

// ---- Alerta de documentos e fornecedor excluído pela tela
const { token, user } = await apiLogin("a@teste.local");
const em5 = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) + " 12:00:00.000Z";
await api("POST", "/api/collections/documentos_central/records", token, { nome: "Alvará da Obra Jardim", data_vencimento: em5 });
await api("POST", "/api/collections/fornecedores/records", token, { nome: "Fornecedor Teste Excluir", cnpj: "55555555000155", company_id: user.company_id });
const s = await abrir();
page = s.page;
await page.goto(FRONT + "/documentos");
await page.waitForTimeout(2500);
const alerta = await page.locator("body").innerText();
check("Documentos: alerta mostra o documento real que vence", /Alvará da Obra Jardim \(vence em [456] dia/.test(alerta) && !/Licença Ambiental - Obra Centro/.test(alerta));
await page.screenshot({ path: OUT + "documentos-alerta.png" });
await page.goto(FRONT + "/suppliers");
await page.waitForTimeout(2000);
page.once("dialog", (dl) => dl.accept());
const linha = page.locator("tr", { hasText: "Fornecedor Teste Excluir" });
await linha.getByRole("button").last().click();
await page.waitForTimeout(800);
const conf = page.getByRole("alertdialog");
if (await conf.isVisible().catch(() => false)) await conf.getByRole("button", { name: /Excluir|Confirmar|Sim/ }).last().click();
await page.waitForTimeout(2000);
const some = !(await page.locator("tr", { hasText: "Fornecedor Teste Excluir" }).count());
const todos = await api("GET", "/api/collections/fornecedores/records?filter=" + encodeURIComponent('nome="Fornecedor Teste Excluir"'), su.data.token);
check("Fornecedores: excluir pela tela tira da lista e guarda arquivado", some && todos.data.items?.[0]?.deleted_at, `some=${some} arquivado=${todos.data.items?.[0]?.deleted_at}`);
const txt = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
check("Mensagens em português", !txt.some((t) => /successfully|Failed/.test(t)), txt.join(" | "));
await s.browser.close();
