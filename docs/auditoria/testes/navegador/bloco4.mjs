// Bloco 4 (26/10/2026): login por telefone, página 404, aviso de versão nova,
// "Convidado por", Contas a Pagar (nova conta e baixa), Configurações sem o
// backup simulado e Cliente vendo só a obra dele.
import { createRequire } from "module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/")("playwright");
import { abrir, api, apiLogin, check, FRONT, OUT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;

// Preparação: uma pessoa com telefone e um cliente com uma obra só dele.
const cr = await api("POST", "/api/collections/users/records", token, { email: "tel@teste.local", username: "teltel", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Almoxarife", role: "Almoxarife", status: "Ativo", name: "Tereza Telefone", telefone: "(21) 96666-5555" });
const cli = await api("POST", "/api/collections/users/records", token, { email: "cli@teste.local", username: "clicli", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Cliente", role: "Cliente", status: "Ativo", name: "Carlos Cliente" });
await api("POST", "/api/collections/obras/records", token, { nome: "Residencial do Carlos", status: "Em Andamento", company_id: cid, clientes_acesso: [cli.data.id] });
await api("POST", "/api/collections/obras/records", token, { nome: "Galpão de outro cliente", status: "Em Andamento", company_id: cid });

// 1. Login pela aba Telefone
{
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  await page.goto(FRONT + "/login");
  await page.getByRole("tab", { name: "Telefone" }).click();
  await page.locator("#lf-telefone").fill("21966665555");
  await page.locator('input[type="password"]').first().fill("Senha12345");
  await page.locator('button[type="submit"]').first().click();
  let entrou = true;
  try { await page.waitForURL(/dashboard/, { timeout: 15000 }); } catch (_) { entrou = false; }
  check("1. Entra pela aba Telefone", entrou);
  await page.screenshot({ path: OUT + "bloco4-login-telefone.png" });
  await browser.close();
}

const { browser, page, erros } = await abrir();
// 3. Página 404
await page.goto(FRONT + "/endereco-que-nao-existe"); await page.waitForTimeout(1500);
const p404 = await page.locator("body").innerText();
check("3. Endereço errado mostra \"Página não encontrada\"", /Página não encontrada/.test(p404) && /Voltar ao início/.test(p404));
await page.screenshot({ path: OUT + "bloco4-404.png" });
// 5. Telas "em desenvolvimento" escondidas
await page.goto(FRONT + "/frota/quilometragem"); await page.waitForTimeout(1200);
check("5. Tela em desenvolvimento (Quilometragem) não abre mais", /Página não encontrada/.test(await page.locator("body").innerText()));
await page.goto(FRONT + "/auditoria"); await page.waitForTimeout(1500);
check("5. Auditoria sem o botão Exportar que não funcionava", (await page.getByRole("button", { name: /Exportar/ }).count()) === 0);

// 2. Aviso de versão nova (simula a publicação de outra versão)
await page.goto(FRONT + "/dashboard"); await page.waitForTimeout(1500);
await page.route(/\/index\.html\?v=/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: '<script type="module" src="/assets/index-VersaoNova123.js"></script>' }));
await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await page.waitForTimeout(2000);
const aviso = (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" | ");
check("2. Aviso \"Versão nova\" com o botão Atualizar", /Versão nova/.test(aviso) && /Atualizar/.test(aviso), aviso.slice(0, 120));
await page.unroute(/\/index\.html\?v=/);

// 4. Convidado por
await page.goto(FRONT + "/usuarios/" + cr.data.id); await page.waitForTimeout(2500);
check("4. Detalhe do acesso mostra \"Convidado por\" com quem criou", /Convidado por:\s*Admin A/.test(await page.locator("body").innerText()));

// 6. Configurações sem a aba Backup simulada
await page.goto(FRONT + "/settings"); await page.waitForTimeout(2000);
check("6. Configurações sem o backup simulado", !/Backup e Restauração|Importar Dados/.test(await page.locator("body").innerText())
  && (await page.getByRole("button", { name: /^Backup$/ }).count()) === 0);

// 7a. Contas a pagar: nova conta e baixa
await page.goto(FRONT + "/financeiro/contas-pagar"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Nova conta" }).click();
const d = page.getByRole("dialog"); await d.waitFor();
await d.locator("#cp_descricao").fill("Aluguel da betoneira");
await d.locator("#cp_valor").fill("450");
await d.locator("#cp_vencimento").fill("2026-11-30");
await d.getByRole("button", { name: "Cadastrar" }).click();
await page.waitForTimeout(2000);
check("7. Nova conta a pagar aparece na lista", /Aluguel da betoneira/.test(await page.locator("body").innerText()));
page.once("dialog", (dl) => dl.accept());
await page.getByRole("button", { name: /Dar baixa/ }).first().click();
await page.waitForTimeout(2000);
const lista = await page.locator("body").innerText();
check("7. Dar baixa marca como paga e tira os botões", /Paga em/.test(lista) && (await page.getByRole("button", { name: /Dar baixa/ }).count()) === 0);
await page.screenshot({ path: OUT + "bloco4-contas-pagar.png", fullPage: true });
await browser.close();

// 7b. Cliente vê só a obra dele
const c = await abrir("cli@teste.local");
await c.page.goto(FRONT + "/projects"); await c.page.waitForTimeout(2500);
const obras = await c.page.locator("body").innerText();
check("7. Cliente vê a obra dele", /Residencial do Carlos/.test(obras));
check("7. Cliente não vê a obra de outro cliente", !/Galpão de outro cliente/.test(obras));
await c.page.screenshot({ path: OUT + "bloco4-cliente-obras.png", fullPage: true });
check("Sem erro na tela", !erros.concat(c.erros).some((e) => /PAGEERROR/.test(e)), erros.concat(c.erros).filter((e) => /PAGEERROR/.test(e)).join(" | "));
await c.browser.close();
