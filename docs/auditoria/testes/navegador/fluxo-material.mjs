import { abrir, api, apiLogin, escolher, check, OUT, FRONT, tirarFoto } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
await api("POST", "/api/collections/obras/records", token, { nome: "Obra Jardim", company_id: cid });
const mat = (await api("POST", "/api/collections/materiais/records", token, { name: "Cimento CP II 50kg", code: "CIM-1", unit: "sc",
  quantity_in_stock: 20, unit_cost: 40, status: "active", company_id: cid, category: "Materiais de Construção" })).data;
// Pedreiro com cadastro de funcionário: o material aceito vai para o saldo dele.
const cargo = ((await api("GET", "/api/collections/cargos/records?perPage=1", token)).data.items || [{}])[0].id || "";
const func = (await api("POST", "/api/collections/funcionarios/records", token, { matricula: "M-PED", nome: "José Pedreiro",
  nome_completo: "José Pedreiro", cargoId: cargo, email: "pedreiro@teste.local", company_id: cid })).data;
await api("POST", "/api/collections/users/records", token, { email: "pedreiro@teste.local", username: "pedreiro", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Pedreiro", role: "Pedreiro", status: "Ativo", name: "José Pedreiro",
  funcionario_id: func.id });
const saldo = async () => (await api("GET", "/api/collections/materiais/records/" + mat.id, token)).data.quantity_in_stock;
const status = async (id) => (await api("GET", "/api/collections/solicitacoes/records/" + id, token)).data.status;

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
check("Pedreiro não confirma o recebimento do próprio pedido", !(await page.getByRole("button", { name: /Confirmar que recebi o pedido/ }).count()));
await page.screenshot({ path: OUT + "fluxo-1-pedido.png" });
await s.browser.close();

// 2. Estoque confirma que recebeu, separa e avisa
s = await abrir();
page = s.page;
await page.goto(FRONT + "/solicitacoes/" + solId); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Confirmar que recebi o pedido/ }).click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Começar a separar/ }).click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Material separado, avisar quem pediu/ }).click(); await page.waitForTimeout(2000);
check("Separado: fica 'Pronto para retirada' e o estoque ainda não baixa (20)",
  (await status(solId)) === "Pronto para retirada" && (await saldo()) === 20, `${await status(solId)} / saldo ${await saldo()}`);
check("O estoque não 'aceita' no lugar de quem pediu: só registra a retirada no balcão, com foto",
  !(await page.getByRole("button", { name: /Conferir e aceitar/ }).count())
  && (await page.getByRole("button", { name: /Registrar retirada no balcão/ }).count()) === 1);
await page.screenshot({ path: OUT + "fluxo-2-separado.png" });
await s.browser.close();

// 3. Pedreiro recusa (material errado), estoque separa de novo, pedreiro aceita
s = await abrir("pedreiro@teste.local");
page = s.page;
await page.goto(FRONT + "/solicitacoes/" + solId); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Material errado/ }).click();
await page.getByLabel("O que está errado?").fill("Veio CP III, eu pedi CP II");
await page.getByRole("button", { name: /Recusar e devolver para o estoque/ }).click(); await page.waitForTimeout(2000);
check("Pedreiro recusa o material errado: volta para separação", (await status(solId)) === "Em separação", await status(solId));
await s.browser.close();

s = await abrir();
page = s.page;
await page.goto(FRONT + "/solicitacoes/" + solId); await page.waitForTimeout(2000);
check("O estoque vê o motivo da recusa", (await page.locator("text=Veio CP III").count()) > 0);
await page.getByRole("button", { name: /Material separado, avisar quem pediu/ }).click(); await page.waitForTimeout(1500);
await s.browser.close();

s = await abrir("pedreiro@teste.local");
page = s.page;
await page.goto(FRONT + "/solicitacoes/" + solId); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Conferir e aceitar o material/ }).click();
check("Sem a foto o botão de aceitar fica travado", await page.getByRole("button", { name: /Sim, aceitar/ }).isDisabled());
await tirarFoto(page);
await page.getByRole("button", { name: /Sim, aceitar/ }).click(); await page.waitForTimeout(2500);
check("Depois do aceite aparece a foto da retirada", (await page.getByAltText("Foto da retirada").count()) === 1
  && await page.getByAltText("Foto da retirada").evaluate((i) => i.complete && i.naturalWidth > 0));
check("Pedreiro aceita na retirada: Concluída e o estoque cai de 20 para 12",
  (await status(solId)) === "Concluída" && (await saldo()) === 12, `${await status(solId)} / saldo ${await saldo()}`);
await page.screenshot({ path: OUT + "fluxo-3-aceito.png" });

// 4. Pedreiro diz onde usou (Saldo por Funcionário → Registrar uso)
await page.goto(FRONT + "/saldo-funcionario"); await page.waitForTimeout(2500);
check("O cimento aparece no saldo do pedreiro", (await page.locator("text=Cimento CP II 50kg · 8 sc").count()) > 0);
await page.getByTitle("Registrar uso na obra").first().click();
d = page.getByRole("dialog");
await escolher(page, "Material *", "Cimento CP II", d);
await d.getByLabel("Quantidade usada *").fill("5");
await escolher(page, "Obra *", "Obra Jardim", d);
await d.getByLabel("Onde foi usado *").fill("Laje do 2º andar");
await page.screenshot({ path: OUT + "fluxo-4-registrar-uso.png" });
await d.getByRole("button", { name: /Confirmar uso/ }).click(); await page.waitForTimeout(2000);
const usos = (await api("GET", "/api/collections/saldo_funcionario/records?filter=" + encodeURIComponent('tipo_operacao="Utilização"'), token)).data;
check("Uso registrado: 5 sacos na laje do 2º andar, R$ 200, estoque continua 12",
  usos.totalItems === 1 && usos.items[0].valor_total === 200 && usos.items[0].local_uso === "Laje do 2º andar" && (await saldo()) === 12,
  JSON.stringify(usos.items?.[0] ? { v: usos.items[0].valor_total, l: usos.items[0].local_uso } : usos));
check("Sobram 3 sacos com o pedreiro", (await page.locator("text=Cimento CP II 50kg · 3 sc").count()) > 0);
await s.browser.close();

// 5. Gestão vê o gasto da obra
s = await abrir();
page = s.page;
await page.goto(FRONT + "/materiais-por-obra"); await page.waitForTimeout(2500);
check("Menu tem 'Materiais por Obra'", (await page.getByRole("link", { name: /Materiais por Obra/ }).count()) > 0);
check("Materiais por Obra mostra o cimento usado e R$ 200,00", (await page.locator("text=Laje do 2º andar").count()) > 0
  && (await page.locator("text=R$ 200,00").count()) > 0);
await page.screenshot({ path: OUT + "fluxo-5-materiais-por-obra.png", fullPage: true });
check("Sem erro de consulta na tela", !s.erros.some((e) => /400|404|500/.test(e)), s.erros.slice(0, 2).join(" | "));
await s.browser.close();
