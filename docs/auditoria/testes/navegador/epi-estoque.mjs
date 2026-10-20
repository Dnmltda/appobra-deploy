// Estoque de EPI pelo servidor (pb_hooks/estoque-epi.pb.js): a entrega pela tela
// baixa o estoque, a tela mostra o saldo novo e entrega maior que o estoque é recusada.
import { abrir, api, apiLogin, escolher, check, FRONT, tirarFoto } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const cargo = (await api("GET", "/api/collections/cargos/records?perPage=1", token)).data.items?.[0]?.id || "";
await api("POST", "/api/collections/funcionarios/records", token, { matricula: "M-EPI", nome: "José Pedreiro", nome_completo: "José Pedreiro", cargoId: cargo, company_id: cid });
const epi = (await api("POST", "/api/collections/epis/records", token, { nome: "Luva de raspa", tipo: "Luva", id_unico: "EPI-T1",
  quantidade_estoque: 5, estoque_minimo: 1, company_id: cid })).data;
const saldo = async () => (await api("GET", "/api/collections/epis/records/" + epi.id, token)).data.quantidade_estoque;
const linha = (page) => page.locator("tr", { hasText: "Luva de raspa" }).first();

const { browser, page } = await abrir();
const abrirLista = async () => {
  await page.goto(FRONT + "/rh/epis"); await page.waitForTimeout(2500);
  await page.getByRole("tab", { name: "EPIs", exact: true }).click(); await page.waitForTimeout(800);
};
await abrirLista();
async function entregar(qtd) {
  await linha(page).getByTitle("Entregar").click();
  const d = page.getByRole("dialog");
  await escolher(page, "Funcionário *", "José Pedreiro", d);
  await d.locator('input[type="number"]').first().fill(String(qtd));
  await tirarFoto(page, d);
  await d.getByRole("button", { name: /Registrar Entrega/ }).click();
  await page.waitForTimeout(2000);
  return (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" | ");
}
let t = await entregar(2);
check("Entrega de 2 pela tela: o servidor baixa o estoque (5 -> 3)", (await saldo()) === 3, t);
await page.keyboard.press("Escape");
check("A tela mostra o saldo novo sem recarregar", /\b3\b/.test(await linha(page).innerText()), (await linha(page).innerText()).replace(/\s+/g, " ").slice(0, 120));
await abrirLista();
await api("PATCH", "/api/collections/epis/records/" + epi.id, token, { quantidade_estoque: 3 }); // garante o saldo
t = await entregar(10);
check("Entrega maior que o estoque: aviso claro e nada muda", /Estoque insuficiente/.test(t) && (await saldo()) === 3, t.slice(0, 140));
await browser.close();
