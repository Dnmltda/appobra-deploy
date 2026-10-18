// Divergência de estoque: contagem com motivo e autorização (Etapa 4.3).
import { abrir, api, apiLogin, escolher, check, toast, OUT, FRONT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const mat = (await api("POST", "/api/collections/materiais/records", token, { name: "Cimento CP II 50kg", code: "CIM-1", unit: "sc",
  quantity_in_stock: 20, status: "active", company_id: cid, category: "Materiais de Construção" })).data;
await api("POST", "/api/collections/users/records", token, { email: "almox@teste.local", username: "almox", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Almoxarife", role: "Almoxarife", status: "Ativo", name: "Ana Almoxarife" });
const saldo = async () => (await api("GET", "/api/collections/materiais/records/" + mat.id, token)).data.quantity_in_stock;
const linha = (page) => page.locator("tr", { hasText: "Cimento CP II 50kg" });

// 1. Almoxarife confere e acha 3 sacos a menos
let s = await abrir("almox@teste.local");
let page = s.page;
await page.goto(FRONT + "/estoque"); await page.waitForTimeout(2500);
await linha(page).getByRole("button", { name: "Conferir" }).click();
let d = page.getByRole("dialog");
await d.locator("#conf_qtd").fill("17");
check("Conferir: mostra a diferença em palavras ('Faltam 3 sc')", /Faltam 3 sc/.test(await d.getByTestId("resultado-contagem").innerText()));
await escolher(page, "Por que deu diferença? *", "Quebra ou dano", d);
await d.locator("#conf_obs").fill("3 sacos molharam");
await page.screenshot({ path: OUT + "div-1-conferir.png" });
await d.getByRole("button", { name: "Registrar contagem" }).click();
const t1 = await toast(page);
await page.waitForTimeout(1500);
check("Almoxarife: diferença fica esperando autorização e o estoque não muda", /autoriza/i.test(t1) && (await saldo()) === 20, t1);
const pend = page.getByTestId("ajuste-pendente");
check("Aparece em 'Diferenças aguardando autorização', sem botão de autorizar para o almoxarife",
  (await pend.count()) === 1 && !(await pend.getByRole("button", { name: "Autorizar" }).count()));
await s.browser.close();

// 2. Administrador autoriza
s = await abrir();
page = s.page;
await page.goto(FRONT + "/estoque"); await page.waitForTimeout(2500);
const p2 = page.getByTestId("ajuste-pendente");
check("Administrador vê a diferença com sistema, contado, motivo e quem contou", /sistema 20 sc, contado 17 sc/.test(await p2.innerText())
  && /Quebra ou dano/.test(await p2.innerText()) && /Ana Almoxarife/.test(await p2.innerText()), (await p2.innerText()).slice(0, 160));
await page.screenshot({ path: OUT + "div-2-autorizar.png" });
await p2.getByRole("button", { name: "Autorizar" }).click();
const t2 = await toast(page);
await page.waitForTimeout(1500);
check("Autorizar: estoque passa para 17 e o aviso some", (await saldo()) === 17 && !(await page.getByTestId("ajuste-pendente").count()), t2);

// 3. Contagem que bate não pede motivo
await linha(page).getByRole("button", { name: "Conferir" }).click();
d = page.getByRole("dialog");
await d.locator("#conf_qtd").fill("17");
check("Contagem igual: 'Bate certinho' e não pede motivo", /Bate certinho/.test(await d.getByTestId("resultado-contagem").innerText())
  && !(await d.locator("#conf_motivo").count()));
await d.getByRole("button", { name: "Registrar contagem" }).click();
const t3 = await page.locator("[data-sonner-toast]", { hasText: /confere/i }).first().textContent({ timeout: 8000 }).catch(() => "");
check("Contagem igual registrada sem mexer no estoque", /confere/i.test(t3) && (await saldo()) === 17, t3);
check("Sem erro de consulta na tela", !s.erros.some((e) => /400|404|500/.test(e)), s.erros.slice(0, 2).join(" | "));
await s.browser.close();
