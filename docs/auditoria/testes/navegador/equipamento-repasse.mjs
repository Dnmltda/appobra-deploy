// Passar o equipamento para outra pessoa na obra (pedido do Diego, 20/10/2026):
// quem está com ele diz para quem, onde estão e tira a foto da troca.
import { abrir, api, apiLogin, apiComFoto, escolher, check, toast, OUT, FRONT, tirarFoto } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const cargo = (await api("GET", "/api/collections/cargos/records?perPage=1", token)).data.items?.[0]?.id || "";
const fun = {};
for (const [nome, email] of [["Ana Servente", "ana@teste.local"], ["Beto Servente", "beto@teste.local"], ["Caio Servente", "caio@teste.local"]]) {
  fun[nome] = (await api("POST", "/api/collections/funcionarios/records", token, { matricula: "M-" + nome.slice(0, 3), nome, nome_completo: nome,
    cargoId: cargo, company_id: cid })).data;
  await api("POST", "/api/collections/users/records", token, { email, username: email.split("@")[0], password: "Senha12345", passwordConfirm: "Senha12345",
    company_id: cid, cargo: "Servente", role: "Servente", status: "Ativo", funcionario_id: fun[nome].id, name: nome });
}
const eq = (await api("POST", "/api/collections/equipamentos/records", token, { nome: "Carrinho de mão", codigo_interno: "CARR-1",
  situacao: "Disponível", company_id: cid })).data;
await apiComFoto("POST", "/api/collections/emprestimos/records", token, { equipment_id: eq.id, funcionario_id: fun["Ana Servente"].id, company_id: cid });
const eqAgora = async () => (await api("GET", "/api/collections/equipamentos/records/" + eq.id, token)).data;
const painel = (page) => page.locator('[data-testid="emprestimo-aberto"]', { hasText: "Carrinho de mão" });

// Caio não está com o carrinho: não vê o botão
let s = await abrir("caio@teste.local");
await s.page.goto(FRONT + "/equipamentos"); await s.page.waitForTimeout(2500);
check("Quem não está com o equipamento não vê 'Passar para outra pessoa'", (await painel(s.page).count()) === 1
  && !(await painel(s.page).getByRole("button", { name: /Passar para outra pessoa/ }).count()));
await s.browser.close();

// Ana passa para o Beto no 3º andar, com foto
s = await abrir("ana@teste.local");
const page = s.page;
await page.goto(FRONT + "/equipamentos"); await page.waitForTimeout(2500);
await painel(page).getByRole("button", { name: /Passar para outra pessoa/ }).click();
const d = page.getByRole("dialog");
await escolher(page, "Para quem *", "Beto Servente", d);
await d.locator("#rep_local").fill("3º andar, torre B");
check("Sem a foto da troca o botão fica travado", await d.getByRole("button", { name: "Confirmar troca" }).isDisabled());
await tirarFoto(page, d);
await page.screenshot({ path: OUT + "equip-repasse-1.png" });
await d.getByRole("button", { name: "Confirmar troca" }).click();
const t = await toast(page);
await page.waitForTimeout(1500);
const x = await eqAgora();
check("Troca registrada: o carrinho fica com o Beto, no 3º andar", x.funcionario_id === fun["Beto Servente"].id && /3º andar/.test(x.local_atual) && x.situacao === "Emprestado", t);
check("O painel mostra com quem está e onde", /Beto Servente/.test(await painel(page).innerText()) && /3º andar, torre B/.test(await painel(page).innerText()));
await page.screenshot({ path: OUT + "equip-repasse-2.png" });
check("Sem erro de consulta na tela", !s.erros.some((e) => /400|404|500/.test(e)), s.erros.slice(0, 2).join(" | "));
await s.browser.close();
