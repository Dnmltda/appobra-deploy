// Estrutura da obra (31/10/2026): cadastro com tipo de estrutura, andares,
// "andar inteiro" x dividido, checklist de serviços com status, % de
// progresso, catálogo nas Configurações, quem só vê, campo opcional no pedido
// de material e tradução.
import { abrir, api, apiLogin, check, escolher, FRONT, OUT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
await api("POST", "/api/collections/users/records", token, { email: "almox.est@teste.local", username: "almoxest", password: "Senha12345",
  passwordConfirm: "Senha12345", company_id: cid, cargo: "Almoxarife", role: "Almoxarife", status: "Ativo", name: "Ana Almoxarife" });

const { browser, page, erros } = await abrir();
// 1. Obra nova do tipo Prédio com 3 andares, pela tela
await page.goto(FRONT + "/projects"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Nova Obra" }).click();
const d = page.getByRole("dialog"); await d.waitFor();
await d.locator("#nome").fill("Edifício Aurora");
await escolher(page, "Tipo de estrutura", "Prédio", d);
await d.locator("#est_andares_form").fill("3");
await d.getByRole("button", { name: /Criar Obra/ }).click();
await page.waitForTimeout(2500);
const obra = (await api("GET", "/api/collections/obras/records?filter=" + encodeURIComponent('nome="Edifício Aurora"'), token)).data.items[0];
check("1. Obra criada como Prédio", obra?.tipo_estrutura === "Prédio", obra?.tipo_estrutura);
await page.goto(FRONT + `/obras/${obra.id}/andamento`); await page.waitForTimeout(2500);
check("1. Andamento mostra os 3 andares", (await page.locator('[data-testid="andar"]').count()) === 3);
await page.screenshot({ path: OUT + "estrutura-1-andares.png", fullPage: true });

// 2. 1º andar como "Andar inteiro" e checklist de serviços
await page.locator('[data-testid="andar"]').first().click(); await page.waitForTimeout(800);
await page.getByRole("button", { name: "Andar inteiro" }).click(); await page.waitForTimeout(2500);
check("2. Andar inteiro cria uma unidade", (await page.locator('[data-testid="unidade"]').count()) === 1);
await page.locator('[data-testid="unidade"]').first().click(); await page.waitForTimeout(800);
const servs = page.locator('[data-testid="servicos"] button:not([title])');
check("2. A unidade já vem com os serviços do catálogo", (await servs.count()) >= 6, String(await servs.count()));
const hidr = page.locator('[data-testid="servicos"] button', { hasText: "Hidráulica" }).first();
await hidr.click(); await page.waitForTimeout(1800);
check("2. Tocar muda para Em andamento", /Em andamento/.test(await hidr.innerText()));
await hidr.click(); await page.waitForTimeout(1800);
check("2. Tocar de novo muda para Concluído", /Concluído/.test(await hidr.innerText()));
await page.screenshot({ path: OUT + "estrutura-2-checklist.png", fullPage: true });
const sv = (await api("GET", "/api/collections/obras_unidade_servicos/records?filter=" + encodeURIComponent(`obra_id="${obra.id}" && servico_nome="Hidráulica"`), token)).data.items[0];
check("2. Quem mudou fica gravado pelo servidor", sv?.alterado_por === user.id && !!sv?.alterado_em);

// 3. 2º andar dividido em 2 aptos + Corredor
await page.getByRole("button", { name: "Voltar" }).first().click(); await page.waitForTimeout(500);
await page.getByRole("button", { name: "Voltar" }).first().click(); await page.waitForTimeout(800);
await page.locator('[data-testid="andar"]').nth(1).click(); await page.waitForTimeout(800);
await page.getByRole("button", { name: "Dividir em unidades" }).click();
await page.locator("#est_aptos").fill("2");
await page.getByRole("button", { name: "Adicionar", exact: true }).click(); await page.waitForTimeout(2500);
const nomes = await page.locator('[data-testid="unidade"]').allInnerTexts();
check("3. 2º andar: Apto 201, Apto 202 e Corredor", nomes.some((n) => /Apto 201/.test(n)) && nomes.some((n) => /Apto 202/.test(n)) && nomes.some((n) => /Corredor/.test(n)), nomes.join(" | ").replace(/\n/g, " "));
await page.screenshot({ path: OUT + "estrutura-3-dividido.png", fullPage: true });

// 4. Progresso da obra (1 de 6+ serviços do 1º andar; 2º e 3º 0%)
const pct = (await api("GET", `/api/collections/obras/records/${obra.id}`, token)).data.progress_percentage;
check("4. Progresso da obra calculado pelo servidor", pct > 0 && pct < 10, String(pct));

// 5. Catálogo nas Configurações
await page.goto(FRONT + "/settings"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Serviços da obra" }).click(); await page.waitForTimeout(1200);
await page.getByLabel("Novo serviço").fill("Impermeabilização");
await page.getByRole("button", { name: "Adicionar" }).last().click(); await page.waitForTimeout(1500);
check("5. Administrador inclui serviço no catálogo", /Impermeabilização/.test(await page.locator('[data-testid="catalogo-servicos"]').innerText()));
await page.screenshot({ path: OUT + "estrutura-5-catalogo.png", fullPage: true });

// 6. Pedido de material: campo opcional de andar/unidade aparece para obra com estrutura
await page.goto(FRONT + "/solicitacoes"); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Nova Solicitação" }).click();
const dl = page.getByRole("dialog"); await dl.waitFor();
check("6. Sem obra: campo de unidade não aparece", (await dl.locator("#sol_unidade").count()) === 0);
await escolher(page, "Obra", "Edifício Aurora", dl); await page.waitForTimeout(1500);
check("6. Obra com estrutura: aparece \"Andar/unidade (opcional)\"", (await dl.locator("#sol_unidade").count()) === 1);
await browser.close();

// 7. Almoxarife só vê
const ax = await abrir("almox.est@teste.local");
await ax.page.goto(FRONT + `/obras/${obra.id}/andamento`); await ax.page.waitForTimeout(2500);
check("7. Almoxarife vê os andares", (await ax.page.locator('[data-testid="andar"]').count()) === 3);
check("7. Almoxarife não tem botão de adicionar andar", (await ax.page.getByRole("button", { name: "Adicionar andar" }).count()) === 0);
await ax.page.locator('[data-testid="andar"]').first().click(); await ax.page.waitForTimeout(800);
await ax.page.locator('[data-testid="unidade"]').first().click(); await ax.page.waitForTimeout(800);
check("7. Para o Almoxarife os serviços ficam travados (só leitura)", await ax.page.locator('[data-testid="servicos"] button').first().isDisabled()
  && /só a gestão da obra altera/.test(await ax.page.locator("body").innerText()));
await ax.page.screenshot({ path: OUT + "estrutura-7-almoxarife.png", fullPage: true });

// 8. Tradução (inglês)
await ax.page.evaluate(() => localStorage.setItem("appobra_language", "en-US"));
await ax.page.goto(FRONT + `/obras/${obra.id}/andamento`); await ax.page.waitForTimeout(2500);
check("8. Em inglês aparece \"Floors\"", /Floors/.test(await ax.page.locator("body").innerText()));
check("Sem erro na tela", !erros.concat(ax.erros).some((e) => /PAGEERROR/.test(e)), erros.concat(ax.erros).filter((e) => /PAGEERROR/.test(e)).join(" | "));
await ax.browser.close();
