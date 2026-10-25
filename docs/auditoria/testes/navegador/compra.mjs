import { abrir, api, apiLogin, escolher, preencher, toast, check, OUT, FRONT, garantirMaterial } from "./lib.mjs";

const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
await api("POST", "/api/collections/fornecedores/records", token, { nome: "Depósito São João", cnpj: "12345678000199", company_id: cid });
await api("POST", "/api/collections/obras/records", token, { nome: "Residencial Jardim", status: "Em Andamento", company_id: cid });

const { browser, page, erros } = await abrir();
await page.goto(FRONT + "/compras");
await page.getByRole("button", { name: "Nova Compra" }).click();
const dlg = page.getByRole("dialog");
await dlg.waitFor();
await escolher(page, "Fornecedor *", "Depósito São João", dlg);
await escolher(page, "Obra", "Residencial Jardim", dlg);
await escolher(page, "Solicitante *", "Admin A", dlg);
await escolher(page, "Categoria *", "Materiais", dlg);
await preencher(page, "Valor Previsto (R$)", 1500, dlg);
await page.screenshot({ path: OUT + "compra-form.png" });
await dlg.getByRole("button", { name: /Salvar|Cadastrar|Criar/ }).last().click();
const msg = await toast(page);
check("Compra criada pela tela", /sucesso/i.test(msg), msg);
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + "compra-lista.png" });
const r = await api("GET", "/api/collections/compras/records?filter=" + encodeURIComponent(`company_id="${cid}"`), token);
check("Compra gravada no servidor com fornecedor", r.data.items?.some((c) => c.fornecedor_id && c.valor_previsto === 1500), `${r.data.totalItems} compra(s)`);

// ---- item + recebimento -> estoque
const compra = r.data.items.find((c) => c.valor_previsto === 1500);
const mat = await garantirMaterial(token, cid, "Areia média lavada", { unit: "m3" });
const saldoAntes = mat.quantity_in_stock || 0;
await page.goto(FRONT + "/compras/" + compra.id);
await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Adicionar" }).first().click();
let d = page.getByRole("dialog");
await escolher(page, "Material *", mat.name, d);
await preencher(page, "Quantidade *", 12, d);
await preencher(page, "Preço Unit. *", 95, d);
await page.screenshot({ path: OUT + "compra-item.png" });
await d.getByRole("button", { name: /Adicionar|Salvar/ }).last().click();
check("Item adicionado com o material escolhido", /sucesso|adicionad/i.test(await toast(page)));
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Recebimento" }).first().click();
d = page.getByRole("dialog");
await escolher(page, "Responsável *", "Admin A", d);
await preencher(page, "Qtd Recebida *", 12, d);
await preencher(page, "Qtd Prevista *", 12, d);
await escolher(page, "Status", "Completo", d).catch(() => {});
await d.getByRole("button", { name: "Registrar" }).last().click();
const m2 = await toast(page);
await page.waitForTimeout(2000);
const depois = (await api("GET", "/api/collections/materiais/records/" + mat.id, token)).data.quantity_in_stock;
check("Recebimento completo pela tela coloca o material no estoque (+12)", depois === saldoAntes + 12, `${m2} | saldo ${saldoAntes} -> ${depois}`);
await page.screenshot({ path: OUT + "compra-recebida.png" });
console.log("erros de console:", erros.filter((e) => !/favicon/.test(e)).slice(0, 5));
await browser.close();

// ---- M3 (25/10/2026): Financeiro edita a compra, mas não vê "Recebimento"
// (receber dá entrada no estoque; só quem lança movimentação).
const forn = (await api("GET", "/api/collections/fornecedores/records?perPage=1&filter=" + encodeURIComponent(`company_id="${cid}"`), token)).data.items[0];
const c2 = (await api("POST", "/api/collections/compras/records", token, { numero_compra: "CMP-FIN-1", descricao: "Compra do financeiro",
  status: "Aprovado", fornecedor_id: forn.id, company_id: cid })).data;
await api("POST", "/api/collections/users/records", token, { email: "fabio.fin@teste.local", username: "fabiofin", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Financeiro", role: "Financeiro", status: "Ativo", name: "Fábio Financeiro" });
const fin = await abrir("fabio.fin@teste.local");
await fin.page.goto(FRONT + "/compras/" + c2.id); await fin.page.waitForTimeout(2500);
check("Financeiro abre a compra", /Compra do financeiro|CMP-FIN-1/.test(await fin.page.locator("main").innerText()));
check("Financeiro não vê o botão Recebimento", (await fin.page.getByRole("button", { name: "Recebimento" }).count()) === 0);
await fin.page.screenshot({ path: OUT + "compra-financeiro.png" });
await fin.browser.close();
