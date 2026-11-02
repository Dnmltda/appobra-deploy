// Entrada no estoque com a obra escolhida (02/11/2026): na tela Estoque,
// "Registrar Entrada" com "Estoque da obra" manda o material direto para o
// estoque daquela obra (aparece em Estoque por Obra) e o estoque geral não
// muda; sem obra, continua indo para o geral.
import { abrir, api, apiLogin, check, escolher, preencher, toast, garantirMaterial, FRONT, OUT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const mat = await garantirMaterial(token, cid, "Areia grossa");
await api("POST", "/api/collections/obras/records", token, { nome: "Residencial Ipê", status: "Em Andamento", company_id: cid });
const geral = async () => (await api("GET", "/api/collections/materiais/records/" + mat.id, token)).data.quantity_in_stock || 0;

const { browser, page, erros } = await abrir();
const entrada = async (qtd, obra) => {
  await page.goto(FRONT + "/estoque"); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Registrar Entrada", exact: true }).click();
  const d = page.getByRole("dialog");
  await escolher(page, "Material *", "Areia grossa", d);
  await preencher(page, "Quantidade *", qtd, d);
  if (obra) await escolher(page, "Estoque da obra (opcional)", obra, d);
  await d.locator('button[type="submit"]').click();
  const m = await toast(page);
  await page.waitForTimeout(1200);
  return m;
};
const g0 = await geral();
let m = await entrada(10);
check("Entrada sem obra: vai para o estoque geral (como antes)", (await geral()) === g0 + 10, `${m} | geral ${await geral()}`);
m = await entrada(6, "Residencial Ipê");
check("Entrada com obra: aviso diz a obra", /no estoque da obra Residencial Ipê/.test(m), m.slice(0, 120));
check("Entrada com obra: o estoque geral não muda", (await geral()) === g0 + 10, String(await geral()));
await page.goto(FRONT + "/estoque-obras"); await page.waitForTimeout(2500);
const txt = await page.locator("body").innerText();
check("Aparece em Estoque por Obra para o Residencial Ipê", /Residencial Ipê/.test(txt) && /Areia grossa/.test(txt), txt.replace(/\n/g, " ").slice(0, 200));
await page.screenshot({ path: OUT + "entrada-obra.png", fullPage: true });
check("Menu mostra \"Estoque por Obra\"", (await page.getByRole("link", { name: "Estoque por Obra" }).count()) > 0);
check("Sem erro na tela", !erros.some((e) => /PAGEERROR/.test(e)), erros.filter((e) => /PAGEERROR/.test(e)).join(" | "));
await browser.close();
