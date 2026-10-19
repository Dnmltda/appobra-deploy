import { abrir, api, apiLogin, escolher, preencher, toast, check, OUT, FRONT, garantirMaterial } from "./lib.mjs";

const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const busca = async (nome) => (await api("GET", "/api/collections/materiais/records?perPage=1&filter=" +
  encodeURIComponent(`company_id="${cid}" && name~"${nome}"`), token)).data.items[0];
const saldo = async (id) => (await api("GET", "/api/collections/materiais/records/" + id, token)).data.quantity_in_stock;
await garantirMaterial(token, cid, "Cimento CP II 50kg");
const mat = await busca("Cimento");

const { browser, page, erros } = await abrir();

// ---- Entrada pela tela Estoque
await page.goto(FRONT + "/estoque");
await page.getByRole("button", { name: "Registrar Entrada", exact: true }).click();
let d = page.getByRole("dialog");
await escolher(page, "Material *", mat.name, d);
await preencher(page, "Quantidade *", 30, d);
await d.locator('button[type="submit"]').click();
let msg = await toast(page);
check("Estoque: entrada de 30 pela tela", /Entrada registrada/.test(msg) && (await saldo(mat.id)) === 30, `${msg} | saldo ${await saldo(mat.id)}`);
await page.waitForTimeout(1200);

// ---- Saída maior que o saldo: a tela avisa antes de enviar
await page.getByRole("button", { name: "Registrar Saída", exact: true }).first().click();
d = page.getByRole("dialog");
await escolher(page, "Material *", mat.name, d);
await preencher(page, "Quantidade *", 50, d);
await d.locator('button[type="submit"]').click();
await page.waitForTimeout(800);
const aviso = await d.textContent();
check("Estoque: saída maior que o saldo é barrada com aviso claro", /insuficiente/i.test(aviso) && (await saldo(mat.id)) === 30);
await preencher(page, "Quantidade *", 10, d);
await d.locator('button[type="submit"]').click();
msg = await toast(page);
for (let i = 0; i < 10 && (await saldo(mat.id)) !== 20; i++) await page.waitForTimeout(500);
check("Estoque: saída de 10 pela tela (30 -> 20)", (await saldo(mat.id)) === 20, `${msg} | saldo ${await saldo(mat.id)}`);
await page.screenshot({ path: OUT + "estoque.png" });

// ---- Movimentações: inventário pendente aprovado pela tela
const inv = await api("POST", "/api/collections/movimentacoes/records", token, {
  material_id: mat.id, company_id: cid, tipo: "Inventário", quantidade: 25, unidade: "un", status: "Pendente", motivo_divergencia: "Contagem diferente do sistema", numero_movimentacao: "MOV-INV-1",
});
const big = await api("POST", "/api/collections/movimentacoes/records", token, {
  material_id: mat.id, company_id: cid, tipo: "Saída", quantidade: 999, unidade: "un", status: "Pendente", numero_movimentacao: "MOV-BIG-1",
});
await page.goto(FRONT + "/movimentacoes");
await page.waitForTimeout(2500);
const linha = (num) => page.locator("tr", { hasText: num });
await linha("MOV-INV-1").locator('button[role="combobox"]').click();
await page.getByRole("option", { name: "Aprovado" }).click();
msg = await toast(page);
check("Movimentações: aprovar inventário de 25 deixa o saldo em 25", (await saldo(mat.id)) === 25, `${msg} | saldo ${await saldo(mat.id)}`);
await page.waitForTimeout(1500);
await linha("MOV-BIG-1").locator('button[role="combobox"]').click();
await page.getByRole("option", { name: "Aprovado" }).click();
const viu = await page.getByText(/Saldo insuficiente/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
check("Movimentações: aprovar saída sem saldo mostra a mensagem do servidor", viu && (await saldo(mat.id)) === 25, `saldo ${await saldo(mat.id)}`);
await page.screenshot({ path: OUT + "movimentacoes.png" });

// ---- Cadastro de material: saldo não editável
await page.goto(FRONT + "/materiais");
await page.waitForTimeout(2500);
await page.getByPlaceholder(/Buscar/).first().fill("Cimento");
await page.waitForTimeout(1200);
await page.locator("tr", { hasText: mat.name }).first().getByTitle("Editar").click();
d = page.getByRole("dialog");
check("Material: saldo aparece só para leitura na edição", await d.locator("#mat_estoque").isDisabled());
await page.screenshot({ path: OUT + "material-edit.png" });

console.log("erros de console:", erros.filter((e) => !/Failed to fetch|favicon/.test(e)).slice(0, 6));
await browser.close();
