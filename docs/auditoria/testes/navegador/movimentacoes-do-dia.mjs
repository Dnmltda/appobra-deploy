// "Movimentações do dia" (regra "nada se apaga", parte 2): o cadastro e a
// tentativa barrada de hoje aparecem na tela, o sino avisa o responsável da
// empresa e o PDF da semana baixa.
import { abrir, api, apiLogin, check, garantirMaterial, FRONT, OUT, fs } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
await garantirMaterial(token, cid, "Cimento do resumo");
const tent = await api("DELETE", "/api/collections/historico_alteracoes/records/qualquer", token);
check("Apagar pela API é recusado", tent.status === 403, String(tent.status));

const { browser, page, erros } = await abrir();
await page.waitForTimeout(2000);
check("Menu tem a entrada 'Movimentações do dia'", (await page.getByRole("link", { name: "Movimentações do dia" }).count()) > 0);
await page.goto(FRONT + "/minhas-movimentacoes"); await page.waitForTimeout(2500);
const corpo = await page.locator("main").innerText();
check("Mostra as quatro partes", ["O que eu movimentei", "O que eu cadastrei", "O que mandaram para mim", "Tentativas barradas"].every((t) => corpo.includes(t)));
check("O cadastro de hoje aparece", corpo.includes("Cimento do resumo"));
check("A tentativa barrada de hoje aparece, com o nome da tabela em português", /Tentou apagar um registro de Histórico de alterações/.test(corpo));
check("O cadastro aparece com o nome em português", /Materiais · Cimento do resumo/.test(corpo));
await page.screenshot({ path: OUT + "movimentacoes-1-hoje.png", fullPage: true });

await page.getByRole("button", { name: "Semana", exact: true }).click(); await page.waitForTimeout(2000);
check("Aba Semana abre", /Semana: /.test(await page.locator("main").innerText()));
const [down] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.getByRole("button", { name: /Baixar PDF da semana/ }).click()]);
const arq = OUT + "movimentacoes-semana.pdf"; await down.saveAs(arq);
check("PDF da semana baixa", fs.readFileSync(arq).slice(0, 4).toString() === "%PDF", down.suggestedFilename());

const sino = (await api("GET", "/api/collections/notificacoes/records?perPage=50&filter=" + encodeURIComponent(`usuarioId="${user.id}" && tipo="seguranca"`), token)).data.items || [];
check("Sino do responsável recebeu o aviso da tentativa", sino.length > 0, String(sino.length));
check("Sem erro na tela", !erros.some((e) => /PAGEERROR/.test(e)), erros.filter((e) => /PAGEERROR/.test(e)).join(" | "));
await browser.close();
