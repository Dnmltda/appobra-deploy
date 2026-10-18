// Ocorrências (Etapa 4.4): pedreiro registra com foto, chefia é avisada e resolve.
import { abrir, api, apiLogin, escolher, check, toast, OUT, FRONT, fs } from "./lib.mjs";
const SINK = process.env.SINK;
const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" });
await api("PATCH", "/api/settings", su.data.token, { smtp: { enabled: true, host: "127.0.0.1", port: 2525, tls: false, username: "", password: "" } });
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
await api("POST", "/api/collections/obras/records", token, { nome: "Obra Jardim", company_id: cid });
await api("POST", "/api/collections/users/records", token, { email: "pedreiro@teste.local", username: "pedreiro", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Pedreiro", role: "Pedreiro", status: "Ativo", name: "José Pedreiro" });
// foto de teste (PNG 1x1)
const foto = OUT + "foto-teste.png";
fs.writeFileSync(foto, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const antes = new Set(fs.readdirSync(SINK));

// 1. Pedreiro registra
let s = await abrir("pedreiro@teste.local");
let page = s.page;
await page.waitForTimeout(2000);
const menu = (await page.locator("aside, nav").first().innerText()).replace(/\s+/g, " ");
check("Pedreiro vê 'Ocorrências' no menu", menu.includes("Ocorrências"), menu.slice(0, 160));
await page.goto(FRONT + "/ocorrencias"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Registrar ocorrência/ }).click();
const d = page.getByRole("dialog");
await escolher(page, "O que aconteceu? *", "Quase acidente", d);
await d.getByRole("button", { name: "Alta" }).click();
await d.locator("#oc_desc").fill("Tábua do andaime soltou e caiu perto de um servente");
await escolher(page, "Obra", "Obra Jardim", d);
await d.locator("#oc_local").fill("Andaime do 2º andar");
await d.locator("#oc_fotos").setInputFiles(foto);
await page.screenshot({ path: OUT + "oco-1-registrar.png" });
await d.getByRole("button", { name: "Registrar", exact: true }).click();
const t1 = await toast(page);
await page.waitForTimeout(1500);
check("Registrar: ocorrência OCO-0001 criada e a gestão avisada", /OCO-0001/.test(t1) && /avisada/.test(t1), t1);
const card = page.getByTestId("ocorrencia").first();
check("Pedreiro vê a ocorrência com foto e sem botões de resolver", (await card.locator("img").count()) === 1
  && !(await card.getByRole("button", { name: /resolvida/ }).count()));
await s.browser.close();

let eml = "";
for (let i = 0; i < 20 && !eml; i++) {
  const novos = fs.readdirSync(SINK).filter((f) => !antes.has(f));
  const achou = novos.map((f) => fs.readFileSync(SINK + "/" + f, "utf8")).find((x) => /Ocorr/.test(x));
  if (achou) eml = achou; else await new Promise((r) => setTimeout(r, 300));
}
check("Gravidade alta: e-mail chega para o administrador", /a@teste\.local/.test(eml) && /OCO-0001/.test(eml), (eml.match(/^Subject:.*$/mi) || ["nenhum"])[0]);

// 2. Administrador trata
s = await abrir();
page = s.page;
await page.goto(FRONT + "/ocorrencias"); await page.waitForTimeout(1500);
const c2 = page.getByTestId("ocorrencia").first();
check("Administrador vê a ocorrência do pedreiro", /José Pedreiro/.test(await c2.innerText()) && /Andaime do 2º andar/.test(await c2.innerText()));
await c2.getByRole("button", { name: "Começar a resolver" }).click();
await page.waitForTimeout(1200);
check("Começar a resolver: fica 'Em andamento'", /Em andamento/.test(await page.getByTestId("ocorrencia").first().innerText()));
await page.getByTestId("ocorrencia").first().getByRole("button", { name: "Marcar como resolvida" }).click();
const d2 = page.getByRole("dialog");
check("Resolver: Confirmar fica travado até dizer o que foi feito", await d2.getByRole("button", { name: "Confirmar" }).isDisabled());
await d2.locator("#oc_prov").fill("Andaime refeito e tábuas presas com arame");
await d2.getByRole("button", { name: "Confirmar" }).click();
await page.waitForTimeout(1500);
check("Resolvida some da lista 'Em aberto'", !(await page.getByTestId("ocorrencia").count()));
await page.getByRole("button", { name: "Resolvidas" }).click(); await page.waitForTimeout(1200);
const c3 = page.getByTestId("ocorrencia").first();
check("Em 'Resolvidas' aparece o que foi feito e quem resolveu", /Andaime refeito/.test(await c3.innerText()) && /Admin A/.test(await c3.innerText()));
await page.screenshot({ path: OUT + "oco-2-resolvida.png", fullPage: true });
check("Sem erro de consulta na tela", !s.erros.some((e) => /400|404|500/.test(e)), s.erros.slice(0, 2).join(" | "));
await s.browser.close();
