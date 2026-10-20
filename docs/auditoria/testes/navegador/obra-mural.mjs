// Página da obra: foto, mural da equipe (só quem está na obra vê e escreve),
// aviso no sininho, tirar e colocar funcionário na obra.
import { abrir, api, apiLogin, check, OUT, FRONT, fs } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const obraA = (await api("POST", "/api/collections/obras/records", token, { nome: "Residencial Jardim", status: "Em Andamento", company_id: cid })).data;
const obraB = (await api("POST", "/api/collections/obras/records", token, { nome: "Galpão Norte", status: "Em Andamento", company_id: cid })).data;
const cargo = ((await api("GET", "/api/collections/cargos/records?perPage=1", token)).data.items || [{}])[0].id || "";
async function pessoa(nome, login, obraId) {
  const f = (await api("POST", "/api/collections/funcionarios/records", token, { nome, nome_completo: nome, cargoId: cargo,
    email: `${login}@teste.local`, company_id: cid, obraId })).data;
  await api("POST", "/api/collections/users/records", token, { email: `${login}@teste.local`, username: login, password: "Senha12345",
    passwordConfirm: "Senha12345", company_id: cid, cargo: "Pedreiro", role: "Pedreiro", status: "Ativo", name: nome, funcionario_id: f.id });
  return { f, ...(await apiLogin(`${login}@teste.local`)) };
}
const p1 = await pessoa("João Pedreiro", "joao", obraA.id);
const p2 = await pessoa("Pedro Pedreiro", "pedro", obraA.id);
const sv = await pessoa("Sérgio Servente", "sergio", obraB.id);
const recados = async (tok) => (await api("GET", "/api/collections/obra_mensagens/records?filter=" + encodeURIComponent(`obra_id="${obraA.id}"`), tok)).data;

// 1. João escreve no mural pela "Minha Obra"
let s = await abrir("joao@teste.local");
let page = s.page;
await page.getByRole("link", { name: /Minha Obra/ }).first().waitFor({ timeout: 10000 }).catch(() => {});
check("Menu do pedreiro tem 'Minha Obra'", (await page.getByRole("link", { name: /Minha Obra/ }).count()) > 0);
await page.goto(FRONT + "/minha-obra"); await page.waitForTimeout(2000);
check("Minha Obra abre a obra dele (Residencial Jardim)", (await page.getByRole("heading", { name: "Residencial Jardim" }).count()) === 1);
await page.getByLabel("Assunto").click(); await page.getByRole("option", { name: "Achei um objeto" }).click();
await page.getByLabel("Onde").click(); await page.getByRole("option", { name: "7º andar", exact: true }).click();
await page.getByLabel("Recado").fill("Achei um alicate na escada");
await page.getByRole("button", { name: /Publicar no mural/ }).click();
await page.waitForTimeout(2000);
check("O recado aparece no mural", (await page.locator("text=Achei um alicate na escada").count()) > 0);
await page.screenshot({ path: OUT + "obra-mural.png", fullPage: true });
await s.browser.close();

// 2. Quem é da obra vê e é avisado; quem é de outra obra não vê nem escreve
const doPedro = await recados(p2.token);
check("Colega da mesma obra vê o recado (com assunto e local)", doPedro.totalItems === 1 && doPedro.items[0].tipo === "Achei um objeto" && doPedro.items[0].local === "7º andar");
const avisos = (await api("GET", "/api/collections/notificacoes/records?filter=" + encodeURIComponent(`referencia="obra:${obraA.id}"`), p2.token)).data;
check("Colega da obra é avisado no sininho", avisos.totalItems >= 1, `${avisos.totalItems}`);
check("Servente de outra obra não vê o mural", (await recados(sv.token)).totalItems === 0);
const intruso = await api("POST", "/api/collections/obra_mensagens/records", sv.token, { obra_id: obraA.id, texto: "oi" });
check("Servente de outra obra não escreve no mural", intruso.status >= 400, `status ${intruso.status}`);
const vazio = await api("POST", "/api/collections/obra_mensagens/records", p2.token, { obra_id: obraA.id, texto: "  " });
check("Recado vazio é recusado", vazio.status >= 400, `status ${vazio.status}`);

// 3. Gestão: foto da obra, tira e coloca funcionário
s = await abrir();
page = s.page;
await page.goto(FRONT + "/projects"); await page.waitForTimeout(1500);
check("Lista de obras em português, com 'Abrir obra'", (await page.getByRole("link", { name: /Abrir obra: fotos e mural/ }).count()) >= 2
  && !(await page.locator("text=Allocate").count()));
await page.locator("div.rounded-lg, div.rounded-xl", { hasText: "Residencial Jardim" }).getByRole("button", { name: /Ver Equipe/ }).first().click();
await page.waitForTimeout(1000);
check("'Ver Equipe' tem o botão de tirar da obra", (await page.getByRole("dialog").getByTitle("Tirar da obra").count()) === 2);
await page.keyboard.press("Escape");
await page.goto(FRONT + "/obras/" + obraA.id); await page.waitForTimeout(2000);
check("Gestão vê o recado na página da obra", (await page.locator("text=Achei um alicate na escada").count()) > 0);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
fs.writeFileSync("/tmp/obra-foto.png", png);
await page.getByLabel("Foto da obra").setInputFiles("/tmp/obra-foto.png");
await page.waitForTimeout(2000);
const obraComFoto = (await api("GET", "/api/collections/obras/records/" + obraA.id, token)).data;
check("Gestão adiciona a foto da obra", (obraComFoto.fotos || []).length === 1 && (await page.locator('img[alt="Foto da obra Residencial Jardim"]').count()) === 1);
await page.locator("div.rounded-lg", { hasText: "Pedro Pedreiro" }).getByTitle("Tirar da obra").click();
await page.waitForTimeout(1500);
const pedro = (await api("GET", "/api/collections/funcionarios/records/" + p2.f.id, token)).data;
check("Tirar da obra: Pedro fica sem obra", pedro.obraId === "", pedro.obraId);
check("Quem saiu da obra deixa de ver o mural", (await recados(p2.token)).totalItems === 0);
await page.getByLabel("Colocar funcionário nesta obra").click();
await page.getByRole("option", { name: /Sérgio Servente/ }).click();
await page.getByRole("button", { name: /Colocar na obra/ }).click();
await page.waitForTimeout(1500);
check("Colocar Sérgio na obra: agora ele vê o mural", (await recados(sv.token)).totalItems === 1);
await page.screenshot({ path: OUT + "obra-pagina.png", fullPage: true });
check("Sem erro de consulta na tela", !s.erros.some((e) => /400|404|500/.test(e)), s.erros.slice(0, 2).join(" | "));
await s.browser.close();
