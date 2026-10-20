// Quem vê o estoque: servente e cargos de obra veem só o próprio material;
// almoxarife e administração veem tudo. Material pronto no cadastro (computador).
import { abrir, api, apiLogin, check } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const cargo = ((await api("GET", "/api/collections/cargos/records?perPage=1", token)).data.items || [{}])[0].id || "";
const obra = (await api("POST", "/api/collections/obras/records", token, { nome: "Obra Centro", status: "Em Andamento", company_id: cid })).data;
const mat = (await api("POST", "/api/collections/materiais/records", token, { name: "Areia média", category: "Materiais de Construção",
  unit: "m3", unit_cost: 120, quantity_in_stock: 10, min_quantity: 2, status: "active", company_id: cid })).data;
async function pessoa(nome, login, cargoNome) {
  const f = (await api("POST", "/api/collections/funcionarios/records", token, { nome, nome_completo: nome, cargoId: cargo,
    email: `${login}@teste.local`, company_id: cid, obraId: obra.id })).data;
  await api("POST", "/api/collections/users/records", token, { email: `${login}@teste.local`, username: login, password: "Senha12345",
    passwordConfirm: "Senha12345", company_id: cid, cargo: cargoNome, role: cargoNome, status: "Ativo", name: nome, funcionario_id: f.id });
  return { f, ...(await apiLogin(`${login}@teste.local`)) };
}
const sv = await pessoa("Sílvio Servente", "silvio", "Servente");
const pd = await pessoa("Paulo Pedreiro", "paulo", "Pedreiro");
const ax = await pessoa("Alice Almoxarife", "alice", "Almoxarife");
for (const p of [sv, pd]) {
  const r = await api("POST", "/api/collections/saldo_funcionario/records", token, { company_id: cid, funcionario_id: p.f.id,
    material_id: mat.id, tipo_operacao: "Retirada", quantidade: 1, obra_id: obra.id, data_operacao: new Date().toISOString().replace("T", " ") });
}

// 1. Servidor
const mats = (await api("GET", "/api/collections/materiais/records", sv.token)).data.items || [];
check("Servente vê a lista de materiais (para pedir), sem quantidade nem mínimo",
  mats.length === 1 && !("quantity_in_stock" in mats[0]) && !("min_quantity" in mats[0]), JSON.stringify(mats[0] || {}).slice(0, 120));
const novo = await api("POST", "/api/collections/materiais/records", sv.token, { name: "Teste", category: "Outros", unit: "un", unit_cost: 1, company_id: cid });
check("Servente não cadastra material", novo.status >= 400, `status ${novo.status}`);
const alt = await api("PATCH", "/api/collections/materiais/records/" + mat.id, sv.token, { name: "Mudei" });
check("Servente não altera material", alt.status >= 400, `status ${alt.status}`);
check("Servente não vê movimentações do estoque", ((await api("GET", "/api/collections/movimentacoes/records", sv.token)).data.totalItems || 0) === 0);
const movSv = await api("POST", "/api/collections/movimentacoes/records", sv.token, { company_id: cid, material_id: mat.id, tipo: "Entrada", quantidade: 5 });
check("Servente não lança movimentação", movSv.status >= 400, `status ${movSv.status}`);
check("Servente não vê o estoque das obras", ((await api("GET", "/api/collections/estoque_obra/records", sv.token)).data.totalItems || 0) === 0);
const saldoSv = (await api("GET", "/api/collections/saldo_funcionario/records", sv.token)).data;
check("Servente vê só o próprio saldo", saldoSv.totalItems === 1 && saldoSv.items[0].funcionario_id === sv.f.id, `${saldoSv.totalItems}`);
const matsAx = (await api("GET", "/api/collections/materiais/records", ax.token)).data.items || [];
check("Almoxarife vê a quantidade em estoque", matsAx.length === 1 && matsAx[0].quantity_in_stock === 10, JSON.stringify(matsAx[0] || {}).slice(0, 120));
check("Almoxarife vê o saldo de todos", ((await api("GET", "/api/collections/saldo_funcionario/records", ax.token)).data.totalItems || 0) === 2);
check("Almoxarife vê as movimentações", ((await api("GET", "/api/collections/movimentacoes/records", ax.token)).data.totalItems || 0) >= 1);

// 2. Tela do servente
let s = await abrir("silvio@teste.local");
let page = s.page;
await page.getByRole("link", { name: /Meu Material/ }).first().waitFor({ timeout: 10000 }).catch(() => {});
check("Menu do servente mostra 'Meu Material' e não mostra Estoque",
  (await page.getByRole("link", { name: /Meu Material/ }).count()) === 1 && (await page.getByRole("link", { name: /^Estoque/ }).count()) === 0);
await page.getByRole("link", { name: /Meu Material/ }).first().click();
await page.waitForTimeout(2500);
check("'Meu Material' mostra só o servente", (await page.locator("text=Sílvio Servente").count()) > 0 && (await page.locator("text=Paulo Pedreiro").count()) === 0);
check("Sem erro de consulta na tela do servente", !s.erros.some((e) => /400|403|404|500/.test(e)), s.erros.slice(0, 2).join(" | "));
await s.browser.close();

// 3. Material pronto no cadastro (computador)
s = await abrir();
page = s.page;
await page.goto(process.env.FRONT + "/materiais"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Adicionar Material/ }).first().click();
await page.waitForTimeout(1500);
check("Cadastro mostra materiais prontos sem precisar escolher categoria",
  (await page.getByLabel("Escolha um material pronto").count()) === 1 && (await page.getByRole("dialog").locator("button.rounded-full").count()) >= 10);
await page.getByLabel("Escolha um material pronto").fill("cimento");
await page.waitForTimeout(500);
await page.getByRole("dialog").locator("button.rounded-full", { hasText: /Cimento/ }).first().click();
const nome = await page.locator("#mat_nome").inputValue();
check("Tocar no material pronto preenche o nome", /Cimento/i.test(nome), nome);
await page.screenshot({ path: "/tmp/claude-0/material-pronto.png" });
await s.browser.close();
