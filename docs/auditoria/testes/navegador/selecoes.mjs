import { abrir, api, apiLogin, escolher, check, OUT, FRONT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const f = encodeURIComponent(`company_id="${cid}" && name~"Areia"`);
const mat = (await api("GET", "/api/collections/materiais/records?perPage=1&filter=" + f, token)).data.items[0];
await api("POST", "/api/collections/obras/records", token, { nome: "Obra Centro", company_id: cid });
await api("POST", "/api/collections/clientes/records", token, { nome: "Construtora Alfa", email: "alfa@cliente.com", company_id: cid });
await api("POST", "/api/collections/movimentacoes/records", token, { material_id: mat.id, company_id: cid, tipo: "Entrada", quantidade: 4,
  unidade: mat.unit, status: "Pendente", numero_movimentacao: "MOV-SEL-1" });

const { browser, page } = await abrir();
// Movimentações (edição de pendente)
await page.goto(FRONT + "/movimentacoes"); await page.waitForTimeout(2000);
await page.locator("tr", { hasText: "MOV-SEL-1" }).getByTitle("Editar").click();
let d = page.getByRole("dialog");
check("Movimentação: categoria, código e unidade travados (vêm do material)",
  (await d.locator("#mov_categoria").getAttribute("readonly")) !== null && (await d.locator("#mov_unidade").getAttribute("readonly")) !== null);
check("Movimentação: origem e destino são listas", (await d.locator("#mov_origem").getAttribute("role")) === "combobox" && (await d.locator("#mov_destino").getAttribute("role")) === "combobox");
await d.locator("#mov_origem").click(); await page.getByRole("option", { name: "Fornecedor", exact: true }).click();
await page.screenshot({ path: OUT + "mov-form.png" });
await page.keyboard.press("Escape");

// Perdas e ganhos
await page.goto(FRONT + "/perdas-ganhos"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Novo Registro/ }).click();
d = page.getByRole("dialog");
await escolher(page, "Item", mat.name, d);
await escolher(page, "Localização", "Obra Centro", d);
await d.getByRole("button", { name: "Salvar" }).click();
await page.waitForTimeout(1500);
const pg = (await api("GET", "/api/collections/perdas_ganhos/records?filter=" + encodeURIComponent(`company_id="${cid}"`), token)).data.items[0];
check("Perdas e ganhos: item escolhido da lista fica ligado ao material", pg?.item_id === mat.id && pg?.localizacao === "Obra Centro", JSON.stringify({ item: pg?.item_nome, loc: pg?.localizacao }));

// Contas a receber
await page.goto(FRONT + "/financeiro/contas-receber"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Nova Conta a Receber/ }).click();
d = page.getByRole("dialog");
check("Contas a receber: cliente é uma lista dos clientes cadastrados", (await d.locator("#cr_cliente").getAttribute("role")) === "combobox");
await d.locator("#cr_cliente").click();
check("Contas a receber: lista mostra 'Construtora Alfa'", await page.getByRole("option", { name: "Construtora Alfa" }).isVisible());
await page.keyboard.press("Escape"); await page.keyboard.press("Escape");

// Equipamentos
await page.goto(FRONT + "/equipamentos"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Novo Equipamento/ }).click();
d = page.getByRole("dialog");
await d.locator("#eq_local").click();
check("Equipamentos: local é lista com almoxarifado e obras", await page.getByRole("option", { name: "Obra Centro" }).isVisible()
  && await page.getByRole("option", { name: "Almoxarifado" }).isVisible());
await page.screenshot({ path: OUT + "equip-local.png" });
await browser.close();
