// Painel do Administrador reorganizado (03/11/2026): seções com título e, no
// "Gasto de material por obra", o detalhe dos materiais que mais pesaram em
// cada obra (resumo da tela Materiais por Obra). Obra sem preço cadastrado
// mostra o aviso; quem não trabalha com valores (RH) não vê R$ em lugar nenhum.
import { abrir, api, apiLogin, check, garantirMaterial, FRONT, OUT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const comPreco = await garantirMaterial(token, cid, "Cimento CP II", { unit_cost: 40 });
const outro = await garantirMaterial(token, cid, "Areia lavada", { unit_cost: 120 });
const semPreco = await garantirMaterial(token, cid, "Prego 17x21");
const obraA = (await api("POST", "/api/collections/obras/records", token, { nome: "Torre Alfa", status: "Em Andamento", company_id: cid })).data;
const obraB = (await api("POST", "/api/collections/obras/records", token, { nome: "Casa Beta", status: "Em Andamento", company_id: cid })).data;
for (const m of [comPreco, outro, semPreco]) {
  await api("POST", "/api/collections/movimentacoes/records", token, { material_id: m.id, company_id: cid, tipo: "Entrada", quantidade: 100, status: "Aprovado", data: "2026-11-03" });
}
const consumo = (m, obra, qtd) => api("POST", "/api/collections/movimentacoes/records", token, { material_id: m.id, company_id: cid, tipo: "Consumo de Obra",
  quantidade: qtd, status: "Aprovado", data: "2026-11-03", obra_id: obra.id, valor_unitario: m.unit_cost || 0, valor_total: (m.unit_cost || 0) * qtd });
await consumo(comPreco, obraA, 10); // R$ 400
await consumo(outro, obraA, 2);     // R$ 240
await consumo(semPreco, obraB, 50); // sem preço
await api("POST", "/api/collections/users/records", token, { email: "rh.painel@teste.local", username: "rhpainel", password: "Senha12345", passwordConfirm: "Senha12345",
  company_id: cid, cargo: "RH", role: "RH", status: "Ativo", name: "Rita RH" });

const { browser, page, erros } = await abrir();
await page.goto(FRONT + "/dashboard"); await page.waitForTimeout(3000);
const corpo = await page.locator("body").innerText();
check("Painel organizado em seções (Resumo, Hoje na empresa, Material e estoque, Pedidos)",
  ["Resumo", "Hoje na empresa", "Material e estoque", "Pedidos de material"].every((t) => corpo.includes(t)));
const det = page.locator('[data-testid="gasto-detalhe"]');
let txt = await det.innerText().catch(() => "");
check("Detalhe da obra que mais gastou (Torre Alfa: Cimento R$ 400 e Areia R$ 240)", /Torre Alfa/.test(txt) && /Cimento CP II/.test(txt) && /400/.test(txt) && /Areia lavada/.test(txt) && /240/.test(txt), txt.replace(/\n/g, " | "));
check("Ordem: o material que mais pesou vem primeiro", txt.indexOf("Cimento CP II") < txt.indexOf("Areia lavada"));
await page.screenshot({ path: OUT + "painel-1-gasto.png", fullPage: true });
await page.locator('[data-testid="gasto-por-obra"]').getByRole("button", { name: "Casa Beta" }).click();
await page.waitForTimeout(500);
txt = await det.innerText();
check("Obra sem preço cadastrado mostra o aviso para cadastrar o preço", /Cadastre o preço dos materiais/.test(txt) && /Prego 17x21/.test(txt), txt.replace(/\n/g, " | "));
check("\"Ver tudo\" leva para Materiais por Obra", (await page.getByRole("link", { name: /Ver tudo em Materiais por Obra/ }).count()) === 1);
await page.screenshot({ path: OUT + "painel-2-sem-preco.png", fullPage: true });
// O mesmo total da tela Materiais por Obra
await page.goto(FRONT + "/materiais-por-obra"); await page.waitForTimeout(2500);
check("Bate com a tela Materiais por Obra (Torre Alfa: R$ 640,00)", /640,00/.test(await page.locator("body").innerText()));
await browser.close();

// RH: não trabalha com valores — nenhum R$ no painel
const rh = await abrir("rh.painel@teste.local");
await rh.page.goto(FRONT + "/dashboard"); await rh.page.waitForTimeout(3000);
check("RH não vê nenhum valor em R$ no painel", !/R\$/.test(await rh.page.locator("body").innerText()));
check("Sem erro na tela", !erros.concat(rh.erros).some((e) => /PAGEERROR/.test(e)), erros.concat(rh.erros).filter((e) => /PAGEERROR/.test(e)).join(" | "));
await rh.browser.close();
