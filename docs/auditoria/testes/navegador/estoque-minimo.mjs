// Alerta de estoque mínimo (Etapa 4.5): sininho, e-mail, painel e pedido de compra.
import { abrir, api, apiLogin, check, toast, OUT, FRONT, fs } from "./lib.mjs";
const SINK = process.env.SINK;
const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" });
await api("PATCH", "/api/settings", su.data.token, { smtp: { enabled: true, host: "127.0.0.1", port: 2525, tls: false, username: "", password: "" } });
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const mat = (await api("POST", "/api/collections/materiais/records", token, { name: "Cal hidratada 20kg", code: "CAL-1", unit: "sc",
  quantity_in_stock: 6, min_quantity: 5, status: "active", company_id: cid, category: "Materiais de Construção" })).data;
const antes = new Set(fs.readdirSync(SINK));

const { browser, page, erros } = await abrir();
await page.goto(FRONT + "/estoque"); await page.waitForTimeout(2000);
check("Acima do mínimo: sem aviso de 'Materiais acabando'", !(await page.getByTestId("material-acabando").count()));

// Saída que faz chegar no mínimo (pelo servidor, como faria a entrega de um pedido)
await api("POST", "/api/collections/movimentacoes/records", token, { material_id: mat.id, company_id: cid, tipo: "Saída",
  quantidade: 2, status: "Aprovado", data: "2026-10-18" });
await page.reload(); await page.waitForTimeout(2500);
const linha = page.getByTestId("material-acabando");
check("Chegou no mínimo: aparece em 'Materiais acabando' com o que resta e a sugestão", (await linha.count()) === 1
  && /restam 4 sc/.test(await linha.innerText()) && /sugestão: comprar 6 sc/.test(await linha.innerText()), (await linha.innerText().catch(() => "")).slice(0, 120));
const sino = page.locator("header button:has(svg.lucide-bell)").first();
check("Sininho mostra 1 aviso novo", (await sino.innerText()).trim() === "1", await sino.innerText());
await sino.click(); await page.waitForTimeout(800);
check("Aviso no sininho diz o material e quanto resta", (await page.getByText(/Estoque baixo: Cal hidratada 20kg — restam 4 sc \(mínimo 5 sc\)/).count()) > 0);
await page.keyboard.press("Escape");

let eml = "";
for (let i = 0; i < 20 && !eml; i++) {
  const novos = fs.readdirSync(SINK).filter((f) => !antes.has(f));
  const achou = novos.map((f) => fs.readFileSync(SINK + "/" + f, "utf8")).find((x) => /Estoque baixo/i.test(x) || /Estoque_baixo/.test(x));
  if (achou) eml = achou; else await new Promise((r) => setTimeout(r, 300));
}
check("E-mail 'Estoque baixo' chega para o administrador", /a@teste\.local/.test(eml), (eml.match(/^Subject:.*$/mi) || ["nenhum"])[0]);

// Pedir compra
await linha.getByRole("button", { name: "Pedir compra" }).click();
const t = await toast(page);
await page.waitForTimeout(1500);
check("Pedir compra: cria a solicitação de compra", /Pedido de compra de Cal hidratada/.test(t), t);
check("Botão vira 'Pedido de compra já feito' (não pede duas vezes)", (await linha.getByRole("button", { name: /já feito/ }).count()) === 1);
const sol = (await api("GET", "/api/collections/solicitacoes/records?filter=" + encodeURIComponent(`company_id="${cid}" && tipo="Compra"`), token)).data;
check("Solicitação de compra com prioridade Alta e a sugestão na descrição", sol.totalItems === 1 && sol.items[0].prioridade === "Alta"
  && /Comprar Cal hidratada 20kg: sugestão 6 sc/.test(sol.items[0].descricao), sol.items[0]?.descricao);
await page.screenshot({ path: OUT + "min-1-acabando.png" });
check("Sem erro de consulta na tela", !erros.some((e) => /400|404|500/.test(e)), erros.slice(0, 2).join(" | "));
await browser.close();
