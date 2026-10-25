// Bloco 3 (25/10/2026): menu sem grupos repetidos e terminando em
// Relatórios → Auditoria → Configurações (D2); cargo Diretoria (D1); busca com
// "\" não quebra a lista (D8); mensagem de erro em português (D6).
import { abrir, api, apiLogin, check, garantirMaterial, FRONT, OUT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
await garantirMaterial(token, cid, "Areia fina D8");

// D2: menu do administrador
const { browser, page, erros } = await abrir();
await page.waitForTimeout(1500);
const menu = await page.locator("aside, nav").first().innerText();
const linhas = menu.split("\n").map((t) => t.trim()).filter(Boolean);
const grupos = linhas.filter((t) => /^(GESTÃO|SUPRIMENTOS|FLUXO DE COMPRA|PESSOAS|EMPRESA)$/i.test(t));
check("D2: cada grupo do menu aparece uma vez só", grupos.length > 0 && new Set(grupos.map((g) => g.toUpperCase())).size === grupos.length, grupos.join(" | "));
const fim = linhas.filter((t) => ["Relatórios", "Auditoria", "Configurações"].includes(t));
check("D2: o menu termina em Relatórios → Auditoria → Configurações", fim.join(",") === "Relatórios,Auditoria,Configurações"
  && linhas.indexOf("Configurações") > linhas.indexOf("Gestão de Acessos"), fim.join(","));
await page.screenshot({ path: OUT + "bloco3-menu.png", fullPage: true });

// D8: busca terminando em "\"
await page.goto(FRONT + "/materiais"); await page.waitForTimeout(2000);
const busca = page.getByPlaceholder("Buscar por nome, código ou categoria...");
await busca.fill("areia\\"); await page.waitForTimeout(2000);
const txt = await page.locator("body").innerText();
check("D8: busca com \"\\\" no fim mostra o resultado (não quebra a lista)", /Areia fina D8/.test(txt), txt.slice(0, 120));

// D6: erro em português (fornecedor com CNPJ repetido)
await api("POST", "/api/collections/fornecedores/records", token, { nome: "Forn D6", cnpj: "11.444.777/0001-61", company_id: cid });
await page.goto(FRONT + "/suppliers"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: /Adicionar|Novo/ }).first().click();
const d = page.getByRole("dialog"); await d.waitFor();
await d.locator("#nome").fill("Forn D6 de novo");
await d.locator("#cnpj").fill("11.444.777/0001-61");
await d.getByRole("button", { name: /Adicionar Fornecedor/ }).click();
await page.waitForTimeout(2000);
const avisos = (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" | ");
check("D6: erro ao salvar fornecedor aparece em português", !!avisos && !/Fornecedor cadastrado/i.test(avisos) && !/Failed|supplier|Cannot be blank/i.test(avisos), avisos.slice(0, 160));
await browser.close();

// D1: Diretoria entra, vê o menu dela e a Auditoria com registros
await api("POST", "/api/collections/users/records", token, { email: "diretora@teste.local", username: "diretora", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Diretoria", role: "Diretoria", status: "Ativo", name: "Diretora Teste" });
const dir = await abrir("diretora@teste.local");
await dir.page.waitForTimeout(1500);
const menuDir = await dir.page.locator("aside, nav").first().innerText();
check("D1: a Diretoria entra e vê Auditoria e Relatórios no menu", /Auditoria/.test(menuDir) && /Relatórios/.test(menuDir), menuDir.replace(/\n/g, " ").slice(0, 160));
check("D1: a Diretoria não vê Solicitações (não é dela)", !/Solicitações/.test(menuDir));
await dir.page.goto(FRONT + "/auditoria"); await dir.page.waitForTimeout(2500);
const aud = await dir.page.locator("body").innerText();
check("D1: a tela Auditoria da Diretoria mostra registros", !/Nenhum registro|nenhum log/i.test(aud) && aud.length > 200, aud.slice(0, 120));
await dir.page.screenshot({ path: OUT + "bloco3-diretoria-auditoria.png", fullPage: true });
check("Sem erro na tela", !erros.concat(dir.erros).some((e) => /PAGEERROR/.test(e)), erros.concat(dir.erros).filter((e) => /PAGEERROR/.test(e)).join(" | "));
await dir.browser.close();
