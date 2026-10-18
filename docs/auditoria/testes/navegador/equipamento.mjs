// Empréstimo e devolução de equipamento pela tela (Etapa 4.2).
import { abrir, api, apiLogin, escolher, check, toast, OUT, FRONT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
await api("POST", "/api/collections/obras/records", token, { nome: "Obra Jardim", company_id: cid });
const cargo = (await api("GET", "/api/collections/cargos/records?perPage=1", token)).data.items?.[0]?.id || "";
await api("POST", "/api/collections/funcionarios/records", token, { matricula: "M-1", nome: "José Pedreiro", nome_completo: "José Pedreiro", cargoId: cargo, company_id: cid });
const eq = (await api("POST", "/api/collections/equipamentos/records", token, { nome: "Martelete Bosch", codigo_interno: "MART-1",
  situacao: "Disponível", company_id: cid })).data;
const sit = async () => (await api("GET", "/api/collections/equipamentos/records/" + eq.id, token)).data.situacao;
const linha = (page) => page.locator("tr", { hasText: "Martelete Bosch" });

const { browser, page, erros } = await abrir();
await page.goto(FRONT + "/equipamentos"); await page.waitForTimeout(2500);

// Emprestar
await linha(page).getByRole("button", { name: "Emprestar" }).click();
const d = page.getByRole("dialog");
await escolher(page, "Com quem fica *", "José Pedreiro", d);
await escolher(page, "Para qual obra (opcional)", "Obra Jardim", d);
await d.locator("#emp_ate").fill("2020-01-10"); // data passada: deve aparecer "Atrasado"
await d.getByRole("button", { name: "Confirmar empréstimo" }).click();
const t1 = await toast(page);
await page.waitForTimeout(1500);
check("Emprestar pela tela: equipamento fica 'Emprestado'", (await sit()) === "Emprestado", t1);
const painel = page.locator('[data-testid="emprestimo-aberto"]', { hasText: "Martelete Bosch" });
check("Painel 'Emprestados agora' mostra com quem está e a obra", (await painel.count()) === 1 && /José Pedreiro/.test(await painel.innerText()) && /Obra Jardim/.test(await painel.innerText()));
check("Passou da data: aparece 'Atrasado'", /Atrasado/.test(await painel.innerText()));
check("Emprestado não mostra mais o botão Emprestar", !(await linha(page).getByRole("button", { name: "Emprestar" }).count()));
await page.screenshot({ path: OUT + "equip-1-emprestado.png", fullPage: true });

// Receber de volta precisando de manutenção
await painel.getByRole("button", { name: "Receber de volta" }).click();
const d2 = page.getByRole("dialog");
check("Registrar devolução fica travado até escolher o estado", await d2.getByRole("button", { name: "Registrar devolução" }).isDisabled());
await d2.getByRole("button", { name: "Precisa de manutenção" }).click();
await d2.locator("#dev_obs").fill("Ponteira gasta");
await page.screenshot({ path: OUT + "equip-2-devolucao.png" });
await d2.getByRole("button", { name: "Registrar devolução" }).click();
const t2 = await toast(page);
await page.waitForTimeout(1500);
check("Voltou precisando de manutenção: vai para 'Em Manutenção'", (await sit()) === "Em Manutenção", t2);
check("Some do painel de emprestados", !(await painel.count()));
const mm = (await api("GET", "/api/collections/equipamentos_manutencao/records?filter=" + encodeURIComponent(`equipamento_id="${eq.id}"`), token)).data;
check("Manutenção corretiva criada com o que aconteceu", mm.totalItems === 1 && /Ponteira gasta/.test(mm.items[0].descricao));
check("Sem erro de consulta na tela", !erros.some((e) => /400|404|500/.test(e)), erros.slice(0, 2).join(" | "));
await browser.close();
