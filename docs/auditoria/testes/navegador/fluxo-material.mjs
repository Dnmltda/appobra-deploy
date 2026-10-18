import { abrir, api, apiLogin, escolher, check, OUT, FRONT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
await api("POST", "/api/collections/obras/records", token, { nome: "Obra Jardim", company_id: cid });
const mat = (await api("POST", "/api/collections/materiais/records", token, { name: "Cimento CP II 50kg", code: "CIM-1", unit: "sc",
  quantity_in_stock: 20, status: "active", company_id: cid, category: "Materiais de Construção" })).data;
await api("POST", "/api/collections/users/records", token, { email: "pedreiro@teste.local", username: "pedreiro", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Pedreiro", role: "Pedreiro", status: "Ativo", name: "José Pedreiro" });
const saldo = async () => (await api("GET", "/api/collections/materiais/records/" + mat.id, token)).data.quantity_in_stock;

// 1. Pedreiro faz o pedido
let s = await abrir("pedreiro@teste.local");
let page = s.page;
await page.goto(FRONT + "/solicitacoes"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Nova Solicitação/ }).click();
let d = page.getByRole("dialog");
check("Pedreiro vê o botão Nova Solicitação e não vê o campo Status", !(await d.locator('label:text-is("Status")').count()));
await escolher(page, "Tipo *", "Material", d);
await escolher(page, "Obra", "Obra Jardim", d).catch(() => {});
await d.locator("textarea").first().fill("Cimento para a laje do 2º andar");
await d.locator('button[type="submit"]').click();
await page.waitForURL(/\/solicitacoes\/[a-z0-9]+$/, { timeout: 10000 }).catch(() => {});
check("Depois de criar, vai direto para o pedido incluir os materiais", /\/solicitacoes\/[a-z0-9]{10,}$/.test(page.url()), page.url());
const solId = page.url().split("/").pop();
await escolher(page, "Material", "Cimento CP II", page.locator("form", { has: page.getByRole("button", { name: "Incluir" }) })).catch(async () => {
  await page.getByLabel("Material").click(); await page.getByRole("option", { name: /Cimento CP II/ }).click(); });
await page.getByLabel("Quantidade").fill("8");
await page.getByRole("button", { name: "Incluir" }).click();
await page.waitForTimeout(1200);
check("Pedreiro inclui 8 sacos de cimento", (await page.locator("text=8 sc").count()) > 0);
check("Pedreiro não tem botão de aprovar", !(await page.getByRole("button", { name: /Aprovar pedido/ }).count()));
await page.screenshot({ path: OUT + "fluxo-1-pedido.png" });
await s.browser.close();

// 2. Gestão aprova, separa e entrega
s = await abrir();
page = s.page;
await page.goto(FRONT + "/solicitacoes/" + solId); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Aprovar pedido/ }).click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Começar a separar/ }).click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /^Entregar$/ }).click();
await page.getByRole("button", { name: /Sim, entregar/ }).click(); await page.waitForTimeout(2000);
check("Ao entregar, o estoque cai de 20 para 12", (await saldo()) === 12, `saldo ${await saldo()}`);
await page.screenshot({ path: OUT + "fluxo-2-entregue.png" });
await s.browser.close();

// 3. Pedreiro confirma que recebeu
s = await abrir("pedreiro@teste.local");
page = s.page;
await page.goto(FRONT + "/solicitacoes/" + solId); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Confirmar que recebi/ }).click(); await page.waitForTimeout(1500);
const st = (await api("GET", "/api/collections/solicitacoes/records/" + solId, token)).data.status;
check("Pedreiro confirma o recebimento e o pedido fica Concluído", st === "Concluída", st);
await page.screenshot({ path: OUT + "fluxo-3-recebido.png" });
await s.browser.close();
