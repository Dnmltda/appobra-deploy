import { abrir, api, apiLogin, check, OUT, FRONT, garantirMaterial } from "./lib.mjs";

const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const criar = async (cargo, n) => {
  const email = `${cargo.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@teste.local`;
  await api("POST", "/api/collections/users/records", token, {
    email, username: email.split("@")[0], password: "Senha12345", passwordConfirm: "Senha12345",
    company_id: cid, cargo, role: cargo, status: "Ativo", id_unico: String(10 + n), name: `${cargo} Teste`,
  });
  return email;
};

const CASOS = [
  { cargo: "Almoxarife", menu: ["Estoque", "Movimentações", "Compras"], semMenu: ["Financeiro", "Gestão de Acessos"],
    pode: ["/estoque", "/movimentacoes", "/qrcode", "/perdas-ganhos"], naoPode: ["/empresas", "/financeiro/contas-pagar", "/frota/veiculos", "/clientes", "/usuarios"] },
  { cargo: "Gerência", menu: ["Obras", "Financeiro", "Movimentações"], semMenu: ["Gestão de Acessos"],
    pode: ["/movimentacoes", "/empresas", "/clientes", "/frota/veiculos"], naoPode: ["/usuarios", "/auditoria"] },
  { cargo: "Pedreiro", menu: ["Solicitações", "EPIs", "Equipamentos", "Ocorrências"], semMenu: ["Materiais", "Estoque", "Compras", "Financeiro"],
    pode: ["/solicitacoes", "/saldo-funcionario"], naoPode: ["/estoque", "/compras", "/empresas", "/rh/equipes", "/perdas-ganhos"] },
];

let n = 0;
for (const caso of CASOS) {
  const email = await criar(caso.cargo, ++n);
  const { browser, page } = await abrir(email);
  await page.waitForTimeout(1500);
  const menu = (await page.locator("aside, nav").first().innerText()).replace(/\s+/g, " ");
  const faltando = caso.menu.filter((m) => !menu.includes(m));
  const sobrando = caso.semMenu.filter((m) => menu.includes(m));
  check(`${caso.cargo}: menu certo`, !faltando.length && !sobrando.length, `falta ${faltando} | sobra ${sobrando}`);
  for (const r of [...caso.pode, ...caso.naoPode]) {
    await page.goto(FRONT + r);
    await page.waitForTimeout(1300);
    const negado = await page.getByText("Acesso Negado").isVisible().catch(() => false);
    const esperado = caso.naoPode.includes(r);
    check(`${caso.cargo}: ${r} ${esperado ? "bloqueado" : "liberado"}`, negado === esperado);
  }
  if (caso.cargo === "Gerência") {
    const m0 = await garantirMaterial(token, cid, "Cimento CP II 50kg");
    await api("POST", "/api/collections/movimentacoes/records", token, { material_id: m0.id, company_id: cid,
      tipo: "Entrada", quantidade: 5, unidade: "un", status: "Pendente", numero_movimentacao: "MOV-GER-1" });
    await page.goto(FRONT + "/movimentacoes");
    await page.waitForTimeout(2000);
    await page.locator("tr", { hasText: "MOV-GER-1" }).locator('button[role="combobox"]').click();
    await page.getByRole("option", { name: "Aprovado" }).click();
    const ok = await page.getByText(/Status alterado para "Aprovado"/).first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    check("Gerência: aprova movimentação (antes era tratada como funcionário)", ok);
  }
  await browser.close();
}

// Admin: cargo como lista na Gestão de Acessos
const { browser, page } = await abrir();
const cab = await page.locator("header").innerText();
check("Cabeçalho mostra o cargo (Administrador), não 'admin'", /Administrador/.test(cab) && !/\badmin\b/.test(cab), cab.replace(/\s+/g, " ").slice(0, 80));
await page.goto(FRONT + "/usuarios");
await page.waitForTimeout(1500);
await page.locator("tr", { hasText: "Almoxarife Teste" }).getByTitle("Editar").first().click();
const d = page.getByRole("dialog");
const bloco = d.locator("div", { has: page.locator('label:text-is("Cargo *")') }).last();
check("Gestão de Acessos: Cargo é uma lista", await bloco.locator('button[role="combobox"]').count() === 1);
await page.screenshot({ path: OUT + "usuarios-form.png" });
await browser.close();
