// Cadastro de material escolhendo em lista: categoria e cor (fio nas cores da
// norma), código gerado quando fica vazio, o mesmo fio em duas cores.
import { abrir, api, apiLogin, escolher, toast, check, OUT, FRONT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const { browser, page, erros } = await abrir();
const buscar = async (nome) => (await api("GET", "/api/collections/materiais/records?filter=" +
  encodeURIComponent(`company_id="${cid}" && name="${nome}"`), token)).data.items?.[0];

async function cadastrarFio(cor) {
  await page.goto(FRONT + "/materiais"); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Adicionar Material|Novo Material/ }).first().click();
  const d = page.getByRole("dialog");
  await d.locator("#mat_nome").fill("Fio 2,5 mm");
  await escolher(page, "Categoria *", "Elétrica", d);
  await escolher(page, "Cor", cor, d);
  await d.locator("#mat_preco").fill("10");
  await escolher(page, "Unidade de Medida *", "rl", d);
  const previa = await d.getByText(/Vai aparecer como/).innerText().catch(() => "");
  await d.locator('button[type="submit"]').click();
  return { msg: await toast(page), previa, d };
}

await page.goto(FRONT + "/materiais"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Adicionar Material|Novo Material/ }).first().click();
let d = page.getByRole("dialog");
check("Categoria é escolhida numa lista (não digita)", (await d.locator('#mat_categoria[role="combobox"]').count()) === 1);
await d.locator("#mat_nome").fill("Fio 2,5 mm");
await escolher(page, "Categoria *", "Elétrica", d);
await d.locator("#mat_cor").click();
const opcoes = await page.getByRole("option").allInnerTexts();
check("Fio mostra as cores da norma (azul claro = neutro, verde-amarelo = terra)",
  opcoes.some((o) => /Azul claro[\s\S]*neutro/.test(o)) && opcoes.some((o) => /Verde-amarelo[\s\S]*terra/.test(o)) && opcoes.length >= 13, opcoes.length);
await page.screenshot({ path: OUT + "material-cores.png" });
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");

let r = await cadastrarFio("Azul claro");
check("Prévia mostra o nome com a cor", /Fio 2,5 mm Azul claro/.test(r.previa), r.previa);
const azul = await buscar("Fio 2,5 mm Azul claro");
check("Fio azul claro salvo com cor e código gerado (sem digitar código)", azul?.cor === "Azul claro" && /^MAT-.+-AZUL-CLARO$/.test(azul?.code || ""),
  `${r.msg} | ${azul?.code}`);
r = await cadastrarFio("Vermelho");
const vermelho = await buscar("Fio 2,5 mm Vermelho");
check("O mesmo fio em outra cor vira outro material (sem 'já existe')", !!vermelho && vermelho.code !== azul?.code, `${r.msg} | ${vermelho?.code}`);

// Trocar a cor na edição não repete a cor no nome
await page.goto(FRONT + "/materiais"); await page.waitForTimeout(2000);
await page.locator("tr", { hasText: "Fio 2,5 mm Azul claro" }).getByRole("button").first().click().catch(() => {});
await page.waitForTimeout(800);
d = page.getByRole("dialog");
const nomeEdit = await d.locator("#mat_nome").inputValue().catch(() => "");
check("Na edição o nome aparece sem a cor (a cor fica no campo Cor)", nomeEdit === "Fio 2,5 mm", nomeEdit);
if (nomeEdit === "Fio 2,5 mm") {
  await escolher(page, "Cor", "Verde", d);
  await d.locator('button[type="submit"]').click();
  await toast(page);
  const editado = (await api("GET", "/api/collections/materiais/records/" + azul.id, token)).data;
  check("Trocar para verde: nome vira 'Fio 2,5 mm Verde'", editado.name === "Fio 2,5 mm Verde" && editado.cor === "Verde", editado.name);
}
check("Sem erro de consulta na tela", !erros.some((e) => /400|404|500/.test(e)), erros.slice(0, 2).join(" | "));
await browser.close();
