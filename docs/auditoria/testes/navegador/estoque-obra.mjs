// Estoque geral + estoque por obra: transferir, consumir e devolver pela tela,
// e pedido de material separado do estoque da obra.
import { abrir, api, apiLogin, escolher, preencher, check, OUT, FRONT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const obra = (await api("POST", "/api/collections/obras/records", token, { nome: "Obra Jardim", company_id: cid })).data;
const mat = (await api("POST", "/api/collections/materiais/records", token, { name: "Tijolo 8 furos", code: "TIJ-1", unit: "un",
  quantity_in_stock: 100, unit_cost: 2, status: "active", company_id: cid, category: "Materiais de Construção" })).data;
await api("POST", "/api/collections/users/records", token, { email: "pedreiro@teste.local", username: "pedreiro", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Pedreiro", role: "Pedreiro", status: "Ativo", name: "José Pedreiro" });
const geral = async () => (await api("GET", "/api/collections/materiais/records/" + mat.id, token)).data.quantity_in_stock;
const naObra = async () => ((await api("GET", "/api/collections/estoque_obra/records?filter=" +
  encodeURIComponent(`obra_id="${obra.id}" && material_id="${mat.id}"`), token)).data.items[0] || {}).quantidade || 0;
const espera = async (fn, alvo) => { for (let i = 0; i < 12 && (await fn()) !== alvo; i++) await new Promise((r) => setTimeout(r, 400)); };

let s = await abrir();
let page = s.page;
await page.goto(FRONT + "/estoque"); await page.waitForTimeout(1500);
check("Menu tem 'Estoque por Obra'", (await page.getByRole("link", { name: /Estoque por Obra/ }).count()) > 0);
await page.goto(FRONT + "/estoque-obras"); await page.waitForTimeout(2000);

// 1. Transferir 40 do geral para a obra
await page.getByRole("button", { name: /Transferir do estoque geral/ }).click();
let d = page.getByRole("dialog");
await escolher(page, "Material *", "Tijolo 8 furos", d);
await d.getByText(/No estoque geral/).waitFor({ timeout: 5000 }).catch(() => {});
const dica = await d.getByText(/No estoque geral/).innerText().catch(() => "");
check("Diálogo mostra quanto tem no estoque geral", /100/.test(dica), dica);
await preencher(page, "Quantidade *", 40, d);
await d.getByRole("button", { name: "Transferir" }).click();
await espera(naObra, 40);
check("Transferir 40: geral 100 -> 60, obra 0 -> 40", (await geral()) === 60 && (await naObra()) === 40, `geral ${await geral()} obra ${await naObra()}`);
await page.waitForTimeout(1200);
check("A tabela da obra mostra 40 un", (await page.locator("td", { hasText: "40 un" }).count()) > 0);
await page.screenshot({ path: OUT + "estoque-obra-1.png", fullPage: true });

// 2. Consumo na obra (15) e devolução ao geral (5)
await page.getByTitle("Registrar consumo na obra").first().click();
d = page.getByRole("dialog");
await preencher(page, "Quantidade *", 15, d);
await d.locator("textarea").fill("Parede do térreo");
await d.getByRole("button", { name: "Registrar consumo" }).click();
await espera(naObra, 25);
check("Consumo de 15 sai do estoque da obra (40 -> 25); geral fica 60", (await naObra()) === 25 && (await geral()) === 60, `geral ${await geral()} obra ${await naObra()}`);
await page.waitForTimeout(1200);
await page.getByTitle("Devolver ao estoque geral").first().click();
d = page.getByRole("dialog");
await preencher(page, "Quantidade *", 50, d);
await d.getByRole("button", { name: "Devolver" }).click();
await page.waitForTimeout(800);
check("Devolver mais do que a obra tem: a tela avisa e nada muda", (await naObra()) === 25 && (await page.locator("text=maior do que a disponível").count()) > 0);
await preencher(page, "Quantidade *", 5, d);
await d.getByRole("button", { name: "Devolver" }).click();
await espera(naObra, 20);
check("Devolver 5: obra 25 -> 20, geral 60 -> 65", (await naObra()) === 20 && (await geral()) === 65, `geral ${await geral()} obra ${await naObra()}`);

// 3. Pedido de material da obra: quem separa tira do estoque da obra
const tp = (await apiLogin("pedreiro@teste.local")).token;
const sol = (await api("POST", "/api/collections/solicitacoes/records", tp, { company_id: cid, numero_solicitacao: "SOL-EOB", tipo: "Material",
  solicitante_id: (await apiLogin("pedreiro@teste.local")).user.id, descricao: "tijolo", status: "Aberta", obra_id: obra.id })).data;
await api("POST", "/api/collections/solicitacoes_itens/records", tp, { solicitacao_id: sol.id, material_id: mat.id, quantidade: 10 });
for (const st of ["Aprovada", "Em separação"]) await api("PATCH", "/api/collections/solicitacoes/records/" + sol.id, token, { status: st });
await page.goto(FRONT + "/solicitacoes/" + sol.id); await page.waitForTimeout(2500);
check("Ao separar, já vem escolhido o estoque da obra (tem tudo lá)",
  /Estoque da obra Obra Jardim/.test(await page.getByLabel("Separar de qual estoque").innerText()));
await page.screenshot({ path: OUT + "estoque-obra-2-separar.png" });
await page.getByRole("button", { name: /Material separado, avisar quem pediu/ }).click(); await page.waitForTimeout(2000);
const solDepois = (await api("GET", "/api/collections/solicitacoes/records/" + sol.id, token)).data;
check("Pedido marcado para sair do estoque da obra", solDepois.status === "Pronto para retirada" && solDepois.estoque_obra_id === obra.id,
  `${solDepois.status} / ${solDepois.estoque_obra_id}`);
await api("PATCH", "/api/collections/solicitacoes/records/" + sol.id, tp, { status: "Concluída" });
check("No aceite sai da obra (20 -> 10) e o geral fica 65", (await naObra()) === 10 && (await geral()) === 65, `geral ${await geral()} obra ${await naObra()}`);

// 4. Gasto da obra
await page.goto(FRONT + "/materiais-por-obra"); await page.waitForTimeout(2500);
check("Materiais por Obra conta o consumo do estoque da obra (15 + 10 tijolos = R$ 50,00)", (await page.locator("text=R$ 50,00").count()) > 0);
check("Sem erro de consulta na tela", !s.erros.some((e) => /400|404|500/.test(e)), s.erros.slice(0, 2).join(" | "));
await s.browser.close();
