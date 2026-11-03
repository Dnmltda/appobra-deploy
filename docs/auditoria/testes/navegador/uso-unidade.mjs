// "Usos na obra" mostra o andar/unidade real (03/11/2026): no "Registrar uso"
// o seletor de andar/unidade grava unidade_id; o histórico do funcionário e
// Materiais por Obra mostram "1º andar · Apto 101" (e não só o texto digitado).
// Obra sem estrutura: continua o texto digitado.
import { abrir, api, apiLogin, check, escolher, preencher, toast, garantirMaterial, FRONT, OUT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const suporte = (await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" })).data.token;
const mat = await garantirMaterial(token, cid, "Fio 2,5mm");
const predio = (await api("POST", "/api/collections/obras/records", token, { nome: "Edifício Cedro", status: "Em Andamento", company_id: cid })).data;
await api("POST", "/api/custom/estrutura/gerar", token, { obra_id: predio.id, tipo: "Prédio", andares: 1 });
const andar = (await api("GET", "/api/collections/obras_andares/records?filter=" + encodeURIComponent(`obra_id="${predio.id}"`), token)).data.items[0];
await api("POST", "/api/custom/estrutura/dividir", token, { andar_id: andar.id, modo: "dividido", aptos: 1, comuns: [] });
const simples = (await api("POST", "/api/collections/obras/records", token, { nome: "Reforma Avulsa", status: "Em Andamento", company_id: cid })).data;
const cargo = (await api("GET", "/api/collections/cargos/records?perPage=50", token)).data.items.find((c) => c.nome === "Eletricista");
const f = (await api("POST", "/api/collections/funcionarios/records", token, { matricula: "M-FIO", nome: "Elias Eletricista", nome_completo: "Elias Eletricista",
  cargoId: cargo?.id, company_id: cid })).data;
await api("POST", "/api/collections/saldo_funcionario/records", suporte, { company_id: cid, funcionario_id: f.id, material_id: mat.id, tipo_operacao: "Retirada",
  quantidade: 20, data_operacao: "2026-11-03 12:00:00.000Z" });

const { browser, page, erros } = await abrir();
const usar = async (qtd, obra, unidade, local) => {
  await page.goto(FRONT + "/saldo-funcionario"); await page.waitForTimeout(2500);
  await page.locator("tr", { hasText: "Elias Eletricista" }).getByTitle("Registrar uso na obra").click();
  const d = page.getByRole("dialog"); await d.waitFor();
  await escolher(page, "Material *", "Fio 2,5mm", d);
  await preencher(page, "Quantidade usada *", qtd, d);
  await escolher(page, "Obra *", obra, d);
  await page.waitForTimeout(1500);
  if (unidade) await escolher(page, "Andar/unidade (opcional)", unidade, d);
  await d.locator("#uso_local").fill(local);
  await d.locator('button[type="submit"]').click();
  return toast(page);
};
let m = await usar(2, "Edifício Cedro", "Apto 101", "Inteiro");
check("Uso registrado na obra com estrutura, escolhendo a unidade", /Uso registrado/.test(m), m.slice(0, 100));
m = await usar(1, "Reforma Avulsa", null, "Banheiro do fundo");
check("Uso registrado na obra sem estrutura (texto digitado)", /Uso registrado/.test(m), m.slice(0, 100));

await page.goto(FRONT + "/saldo-funcionario"); await page.waitForTimeout(2500);
await page.locator("tr", { hasText: "Elias Eletricista" }).getByTitle("Ver histórico").click();
await page.getByRole("tab", { name: "Usos na obra" }).click(); await page.waitForTimeout(800);
const hist = await page.getByRole("dialog").innerText();
check("Histórico mostra o andar/unidade real (1º andar · Apto 101)", /Local: 1º andar · Apto 101/.test(hist), hist.replace(/\n/g, " ").slice(0, 220));
check("Obra sem estrutura continua com o texto digitado", /Local: Banheiro do fundo/.test(hist));
await page.screenshot({ path: OUT + "uso-unidade-historico.png", fullPage: true });

await page.goto(FRONT + "/materiais-por-obra"); await page.waitForTimeout(2500);
check("Materiais por Obra também mostra a unidade real", /1º andar · Apto 101/.test(await page.locator("body").innerText()));
check("Sem erro na tela", !erros.some((e) => /PAGEERROR/.test(e)), erros.filter((e) => /PAGEERROR/.test(e)).join(" | "));
await browser.close();
