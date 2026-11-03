// Funcionário confirma o material antes de entrar no saldo (02/11/2026): o
// estoque manda 22 pela tela (baixa na hora), nada entra no saldo; o
// funcionário vê "Aguardando sua confirmação" no Painel, marca "Recebi menos"
// (18), tira a foto, e só aí entram 18 no saldo dele. A gestão vê a diferença.
import { abrir, api, apiLogin, check, escolher, preencher, toast, tirarFoto, garantirMaterial, FRONT, OUT } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const mat = await garantirMaterial(token, cid, "Tijolo baiano");
await api("POST", "/api/collections/movimentacoes/records", token, { material_id: mat.id, company_id: cid, tipo: "Entrada", quantidade: 100, status: "Aprovado", data: "2026-11-02" });
const cargo = (await api("GET", "/api/collections/cargos/records?perPage=50", token)).data.items.find((c) => c.nome === "Servente");
const f = (await api("POST", "/api/collections/funcionarios/records", token, { matricula: "M-TIJ", nome: "Sérgio Servente", nome_completo: "Sérgio Servente",
  cargoId: cargo?.id, email: "sergio@teste.local", company_id: cid })).data;
await api("POST", "/api/collections/users/records", token, { email: "sergio@teste.local", username: "sergioserv", password: "Senha12345", passwordConfirm: "Senha12345",
  company_id: cid, cargo: "Servente", role: "Servente", status: "Ativo", name: "Sérgio Servente", funcionario_id: f.id });
const estoque = async () => (await api("GET", "/api/collections/materiais/records/" + mat.id, token)).data.quantity_in_stock;
const saldoFunc = async () => ((await api("GET", "/api/collections/saldo_funcionario/records?perPage=100&filter=" + encodeURIComponent(`funcionario_id="${f.id}"`), token)).data.items || [])
  .reduce((s, x) => s + (x.tipo_operacao === "Retirada" ? x.quantidade : -x.quantidade), 0);

// 1. Estoque manda 22 para o funcionário, pela tela
const { browser, page, erros } = await abrir();
await page.goto(FRONT + "/estoque"); await page.waitForTimeout(2000);
await page.getByRole("button", { name: "Registrar Saída", exact: true }).first().click();
const d = page.getByRole("dialog");
await escolher(page, "Material *", "Tijolo baiano", d);
await preencher(page, "Quantidade *", 22, d);
await escolher(page, "Motivo / Tipo *", "Retirada por Funcionário", d);
await escolher(page, "Funcionário *", "Sérgio Servente", d);
await d.locator('button[type="submit"]').click();
const msg = await toast(page);
await page.waitForTimeout(1500);
check("1. Envio registrado: avisa que entra no saldo quando ele confirmar", /quando ele confirmar/.test(msg), msg.slice(0, 120));
check("1. O estoque baixa na hora (100 -> 78)", (await estoque()) === 78, String(await estoque()));
check("1. Nada entra no saldo do funcionário ainda", (await saldoFunc()) === 0, String(await saldoFunc()));
check("1. Estoque mostra o envio aguardando o funcionário", /Aguardando o funcionário/.test(await page.locator('[data-testid="envios-funcionarios"]').innerText().catch(() => "")));
await page.screenshot({ path: OUT + "aceite-1-estoque.png", fullPage: true });

// 2. O funcionário confere: chegaram só 18
const s = await abrir("sergio@teste.local");
const caixa = s.page.locator('[data-testid="aguardando-confirmacao"]');
// Primeiro teste da bateria: as telas acabaram de ser montadas e a 1ª carga é lenta.
await caixa.waitFor({ timeout: 30000 }).catch(() => {});
check("2. Painel do funcionário mostra \"Aguardando sua confirmação\"", /22 .*Tijolo baiano/.test(await caixa.innerText().catch(() => "")));
await caixa.getByRole("button", { name: "Recebi menos" }).click();
const dl = s.page.getByRole("dialog"); await dl.waitFor({ timeout: 30000 });
await dl.locator("#aceite_qtd").fill("18");
await dl.locator("#aceite_motivo").fill("Vieram 4 quebrados no caminhão");
await tirarFoto(s.page, dl);
await dl.getByRole("button", { name: "Confirmar" }).click();
const m2 = await toast(s.page);
await s.page.waitForTimeout(1500);
check("2. Recebi menos: registrado e a gestão foi avisada", /chegou 18 de 22/.test(m2), m2.slice(0, 120));
check("2. Entram só 18 no saldo dele", (await saldoFunc()) === 18, String(await saldoFunc()));
check("2. Pendência some do Painel", (await caixa.count()) === 0);
await s.page.screenshot({ path: OUT + "aceite-2-funcionario.png", fullPage: true });

// 3. A gestão vê a diferença
await page.reload(); await page.waitForTimeout(2500);
const env = await page.locator('[data-testid="envios-funcionarios"]').innerText().catch(() => "");
check("3. Estoque mostra a diferença (chegou 18, com o motivo)", /Aceito com diferença/.test(env) && /chegou 18/.test(env) && /quebrados/.test(env), env.replace(/\n/g, " ").slice(0, 160));
check("Sem erro na tela", !erros.concat(s.erros).some((e) => /PAGEERROR/.test(e)), erros.concat(s.erros).filter((e) => /PAGEERROR/.test(e)).join(" | "));
await s.browser.close();
await browser.close();
