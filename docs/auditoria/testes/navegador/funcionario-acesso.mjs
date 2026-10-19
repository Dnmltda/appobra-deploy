// Funcionário com acesso ao sistema: convite por e-mail em todas as situações
// (novo, recadastrado depois de excluído, criar acesso na edição, reenviar convite).
import { abrir, api, apiLogin, check, OUT, FRONT, fs } from "./lib.mjs";
const SINK = process.env.SINK;
const su = await api("POST", "/api/collections/_superusers/auth-with-password", null, { identity: "audit@local.test", password: "AuditPass123!" });
await api("PATCH", "/api/settings", su.data.token, { smtp: { enabled: true, host: "127.0.0.1", port: 2525, tls: false, username: "", password: "" } });
const { token } = await apiLogin("a@teste.local");
const S = su.data.token;

const { browser, page, erros } = await abrir();
const toasts = async () => {
  await page.locator("[data-sonner-toast]", { hasText: /convite enviado|não pôde|já está em uso|já existe|Erro/i }).first().waitFor({ timeout: 12000 }).catch(() => {});
  return (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" || ");
};
const limparToasts = async () => page.waitForFunction(() => !document.querySelector("[data-sonner-toast]"), null, { timeout: 30000 }).catch(() => {});
const convitePara = async (email, antes) => {
  for (let i = 0; i < 20; i++) {
    const novos = fs.readdirSync(SINK).filter((f) => !antes.has(f));
    const eml = novos.map((f) => fs.readFileSync(SINK + "/" + f, "utf8")).find((x) => x.includes(email) && /Seu acesso ao APP OBRA/.test(x));
    if (eml) return eml;
    await new Promise((r) => setTimeout(r, 300));
  }
  return "";
};
const linhaFuncionario = (nome) => page.locator("tr", { hasText: nome });

async function cadastrar({ mat, nome, cpf, email, acesso = true }) {
  await page.goto(FRONT + "/employees"); await page.waitForTimeout(2000);
  await page.getByRole("button", { name: /Adicionar Funcionário/ }).first().click();
  const d = page.getByRole("dialog");
  await d.locator("#matricula").fill(mat);
  await d.locator("#nome").fill(nome);
  await d.locator("#cpf").fill(cpf);
  await d.locator("div", { has: page.locator('label:text-is("Cargo")') }).last().locator('button[role="combobox"]').click();
  await page.getByRole("option", { name: "Almoxarife", exact: true }).click();
  await d.locator("div", { has: page.locator('label:text-is("Hierarquia")') }).last().locator('button[role="combobox"]').click();
  await page.getByRole("option", { name: "Pleno" }).click();
  await d.locator("#email").fill(email);
  const marca = d.locator("#criarAcesso");
  if (acesso !== (await marca.isChecked())) await marca.click();
  await limparToasts();
  await d.getByRole("button", { name: /Adicionar Funcionário/ }).click();
  await page.waitForTimeout(3000);
  return toasts();
}

// 1. Novo funcionário com acesso
let antes = new Set(fs.readdirSync(SINK));
let t = await cadastrar({ mat: "M-1", nome: "Ana Almoxarife", cpf: "529.982.247-25", email: "ana@teste.local" });
check("Novo funcionário: salvo e convite enviado", /convite enviado/.test(t) && !/não pôde/.test(t), t.slice(0, 120));
check("Novo funcionário: convite chega", !!(await convitePara("ana@teste.local", antes)));
check("Lista mostra cargo e hierarquia (Almoxarife · Pleno)", /Pleno/.test(await linhaFuncionario("Ana Almoxarife").innerText()));

// 2. Excluído e recadastrado com o mesmo e-mail
const f1 = (await api("GET", "/api/collections/funcionarios/records?filter=" + encodeURIComponent('email="ana@teste.local"'), token)).data.items[0];
const u1 = (await api("GET", "/api/collections/users/records?filter=" + encodeURIComponent('email="ana@teste.local"'), S)).data.items[0];
await api("DELETE", "/api/collections/users/records/" + u1.id, token);
await api("DELETE", "/api/collections/funcionarios/records/" + f1.id, token);
antes = new Set(fs.readdirSync(SINK));
t = await cadastrar({ mat: "M-2", nome: "Ana Almoxarife", cpf: "529.982.247-25", email: "ana@teste.local" });
check("Recadastrado com o mesmo e-mail: salvo e convite enviado (antes dava 'Failed to create record')", /convite enviado/.test(t) && !/não pôde/.test(t), t.slice(0, 160));
check("Recadastrado: convite chega", !!(await convitePara("ana@teste.local", antes)));

// 3. Funcionário sem acesso; criar acesso depois, na edição
await cadastrar({ mat: "M-3", nome: "Bruno Pedreiro", cpf: "111.444.777-35", email: "bruno@teste.local", acesso: false });
await linhaFuncionario("Bruno Pedreiro").getByRole("button").nth(1).click(); // editar
let d = page.getByRole("dialog");
await page.waitForTimeout(1500);
check("Edição sem acesso: aparece 'Criar acesso ... e enviar convite'", (await d.getByText(/Criar acesso ao sistema e enviar convite/).count()) === 1);
antes = new Set(fs.readdirSync(SINK));
await d.locator("#criarAcesso").click();
await limparToasts();
await d.getByRole("button", { name: /Atualizar Funcionário/ }).click();
await page.waitForTimeout(3000);
t = await toasts();
check("Edição: cria o acesso e envia o convite", /convite enviado/.test(t) && !/não pôde/.test(t), t.slice(0, 160));
check("Edição: convite chega", !!(await convitePara("bruno@teste.local", antes)));

// 4. Convite não aceito: reenviar pela edição (o link antigo deixa de valer)
const uB1 = (await api("GET", "/api/collections/users/records?filter=" + encodeURIComponent('email="bruno@teste.local"'), S)).data.items[0];
await linhaFuncionario("Bruno Pedreiro").getByRole("button").nth(1).click();
d = page.getByRole("dialog");
await page.waitForTimeout(1500);
check("Convite pendente: edição oferece reenviar", (await d.getByText(/reenviar, se o convite não chegou/).count()) === 1);
antes = new Set(fs.readdirSync(SINK));
await d.locator("#criarAcesso").click();
await limparToasts();
await d.getByRole("button", { name: /Atualizar Funcionário/ }).click();
await page.waitForTimeout(3000);
t = await toasts();
check("Reenviar convite: sem erro", /convite enviado/.test(t) && !/não pôde/.test(t), t.slice(0, 160));
check("Reenviar convite: novo convite chega", !!(await convitePara("bruno@teste.local", antes)));
const velho = await api("POST", "/api/custom/get-invite-details", null, { token: uB1.password_reset_token });
check("Link do convite antigo deixa de valer", velho.status >= 400, `status ${velho.status}`);

// 5. Acesso ativo: mensagem clara (sem 'Failed to create record')
await api("PATCH", "/api/collections/users/records/" + (await api("GET", "/api/collections/users/records?filter=" + encodeURIComponent('email="ana@teste.local"'), S)).data.items[0].id, S, { status: "Ativo", is_active: true });
t = await cadastrar({ mat: "M-4", nome: "Outra Ana", cpf: "390.533.447-05", email: "ana@teste.local" });
check("E-mail de outro funcionário ativo: mensagem clara", /Já existe um funcionário com este e-mail/.test(t) && !/Value must be unique|já está em uso/.test(t), t.slice(0, 200));
await page.screenshot({ path: OUT + "func-acesso.png", fullPage: true });
check("Sem erro de consulta na tela", !erros.some((e) => /404|500/.test(e)), erros.slice(0, 3).join(" | "));
await browser.close();
