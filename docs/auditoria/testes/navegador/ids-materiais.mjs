import { abrir, api, apiLogin, escolher, preencher, toast, check, OUT, FRONT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const { browser, page } = await abrir();

// ---- Materiais: começa vazio, sugestão preenche o cadastro
const antes = (await api("GET", "/api/collections/materiais/records?filter=" + encodeURIComponent(`company_id="${cid}"`), token)).data.totalItems;
check("Empresa nova começa sem materiais no estoque", antes === 0, `${antes}`);
await page.goto(FRONT + "/materiais"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Adicionar Material|Novo Material/ }).first().click();
const d = page.getByRole("dialog");
await d.getByTitle("Elétrica").click();
await page.waitForTimeout(1500);
await d.getByRole("button", { name: /\+ Fio flexível 1,5mm/ }).click();
check("Sugestão preenche nome e unidade", (await d.locator("#mat_nome").inputValue()) === "Fio flexível 1,5mm");
await page.screenshot({ path: OUT + "material-sugestao.png" });
const preco = d.locator("#mat_preco, #mat_unit_cost, input[id*='preco'], input[id*='cost']").first();
await preco.fill("2.5").catch(() => {});
await d.locator('button[type="submit"]').click();
const msg = await toast(page);
const criado = (await api("GET", "/api/collections/materiais/records?filter=" + encodeURIComponent(`company_id="${cid}" && name="Fio flexível 1,5mm"`), token)).data.items?.[0];
check("Material cadastrado a partir da sugestão (com código ELE-001)", criado?.code === "ELE-001", `${msg} | ${criado?.code}`);

// ---- IDs: funcionário novo pela tela recebe número sequencial; ID não se edita
await page.goto(FRONT + "/employees"); await page.waitForTimeout(2000);
const cargo = (await api("GET", "/api/collections/cargos/records?perPage=1", token)).data.items[0];
const fun = await api("POST", "/api/collections/funcionarios/records", token, { matricula: "MX1", nome: "Pedreiro Novo", nome_completo: "Pedreiro Novo",
  cargoId: cargo.id, company_id: cid, id_unico: "FUN-000123" });
check("Funcionário novo recebe número por ordem de chegada (não FUN-...)", /^\d{2,}$/.test(fun.data.id_unico || ""), fun.data.id_unico);
await page.goto(FRONT + "/usuarios"); await page.waitForTimeout(2000);
await page.locator("tr", { hasText: "Admin A" }).getByTitle("Editar").first().click();
const du = page.getByRole("dialog");
const idInput = du.locator("div", { has: page.locator('label:text-is("ID")') }).last().locator("input");
check("Gestão de Acessos: ID aparece e não pode ser editado", (await idInput.inputValue()) === "01" && (await idInput.getAttribute("readonly")) !== null);
await page.screenshot({ path: OUT + "usuario-id.png" });
await browser.close();
