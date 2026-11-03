// Devolução em duas etapas (03/11/2026): o funcionário informa pelo app
// ("Meu Material" → devolução); nada muda até o almoxarifado confirmar na
// tela Estoque ("Devoluções para confirmar"). Confirmando "chegou menos" (3 de
// 5), saem só 3 do saldo dele e voltam só 3 ao estoque.
import { abrir, api, apiLogin, check, escolher, preencher, toast, garantirMaterial, FRONT, OUT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const suporte = (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" })).data.token;
const mat = await garantirMaterial(token, cid, "Argamassa AC3");
await api("POST", "/api/collections/movimentacoes/records", token, { material_id: mat.id, company_id: cid, tipo: "Entrada", quantidade: 50, status: "Aprovado", data: "2026-11-03" });
const cargo = (await api("GET", "/api/collections/cargos/records?perPage=50", token)).data.items.find((c) => c.nome === "Servente");
const f = (await api("POST", "/api/collections/funcionarios/records", token, { matricula: "M-DEV", nome: "Davi Devolve", nome_completo: "Davi Devolve",
  cargoId: cargo?.id, email: "davi@teste.local", company_id: cid })).data;
await api("POST", "/api/collections/users/records", token, { email: "davi@teste.local", username: "davidev", password: "Senha12345", passwordConfirm: "Senha12345",
  company_id: cid, cargo: "Servente", role: "Servente", status: "Ativo", name: "Davi Devolve", funcionario_id: f.id });
// (preparo pelo suporte: 10 no saldo dele)
await api("POST", "/api/collections/saldo_funcionario/records", suporte, { company_id: cid, funcionario_id: f.id, material_id: mat.id, tipo_operacao: "Retirada",
  quantidade: 10, data_operacao: "2026-11-03 12:00:00.000Z" });
const estoque = async () => (await api("GET", "/api/collections/materiais/records/" + mat.id, token)).data.quantity_in_stock;
const saldoFunc = async () => ((await api("GET", "/api/collections/saldo_funcionario/records?perPage=100&filter=" + encodeURIComponent(`funcionario_id="${f.id}"`), token)).data.items || [])
  .reduce((s, x) => s + (x.tipo_operacao === "Retirada" ? x.quantidade : -x.quantidade), 0);
const e0 = await estoque();

// 1. Funcionário informa a devolução de 5
const d = await abrir("davi@teste.local");
await d.page.goto(FRONT + "/saldo-funcionario"); await d.page.waitForTimeout(2500);
await d.page.getByRole("button", { name: /devolução/i }).first().click();
const dl = d.page.getByRole("dialog"); await dl.waitFor();
await escolher(d.page, "Material *", "Argamassa AC3", dl);
await preencher(d.page, "Quantidade *", 5, dl);
await dl.locator('button[type="submit"]').click();
const m1 = await toast(d.page);
await d.page.waitForTimeout(1500);
check("1. Funcionário informa a devolução pelo app", /Devolução informada/.test(m1), m1.slice(0, 120));
check("1. Nada muda ainda (saldo 10, estoque igual)", (await saldoFunc()) === 10 && (await estoque()) === e0, `${await saldoFunc()} ${await estoque()}`);
check("1. Ele vê \"Devoluções aguardando o almoxarifado\"", /Argamassa AC3/.test(await d.page.locator('[data-testid="minhas-devolucoes"]').innerText().catch(() => "")));
await d.page.screenshot({ path: OUT + "devolucao-1-funcionario.png", fullPage: true });

// 2. Almoxarifado confirma: chegaram só 3
const { browser, page, erros } = await abrir();
await page.goto(FRONT + "/estoque"); await page.waitForTimeout(2500);
const card = page.locator('[data-testid="devolucoes-confirmar"]');
check("2. Estoque mostra \"Devoluções para confirmar\"", /Davi Devolve/.test(await card.innerText().catch(() => "")));
await card.getByRole("button", { name: "Chegou menos" }).click();
const c = page.getByRole("dialog"); await c.waitFor();
await c.locator("#dev_conf_qtd").fill("3");
await c.locator("#dev_conf_motivo").fill("Dois sacos rasgados");
await c.getByRole("button", { name: "Confirmar" }).click();
const m2 = await toast(page);
await page.waitForTimeout(1500);
check("2. Confirmação registrada", /Devolução confirmada: 3/.test(m2), m2.slice(0, 120));
check("2. Saem só 3 do saldo dele (10 -> 7) e voltam só 3 ao estoque", (await saldoFunc()) === 7 && (await estoque()) === e0 + 3, `${await saldoFunc()} ${await estoque()}`);
check("2. Some da lista de confirmação", (await card.count()) === 0);
await page.screenshot({ path: OUT + "devolucao-2-estoque.png", fullPage: true });
check("Sem erro na tela", !erros.concat(d.erros).some((e) => /PAGEERROR/.test(e)), erros.concat(d.erros).filter((e) => /PAGEERROR/.test(e)).join(" | "));
await d.browser.close();
await browser.close();
