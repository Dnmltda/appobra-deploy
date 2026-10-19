import { createRequire } from "module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");
export const fs = require("fs");

export const FRONT = process.env.FRONT || "http://127.0.0.1:4173";
export const API = process.env.API || "http://127.0.0.1:8097";
export const OUT = new URL("./shots_flow/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

export async function api(method, path, token, body) {
  const r = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  return { status: r.status, data: txt ? JSON.parse(txt) : {} };
}

export async function apiLogin(email, pass = "Senha12345") {
  const r = await api("POST", "/api/collections/users/auth-with-password", null, { identity: email, password: pass });
  return { token: r.data.token, user: r.data.record };
}

export async function abrir(email = "a@teste.local", pass = "Senha12345") {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 220)); });
  page.on("pageerror", (e) => erros.push("PAGEERROR " + e.message.slice(0, 220)));
  await page.goto(FRONT + "/login");
  await page.locator('input[type="email"], input[name="email"], input#email').first().fill(email);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  return { browser, page, erros };
}

// Escolhe uma opção num Select (Radix) identificado pelo texto do Label.
export async function escolher(page, label, opcao, escopo = page) {
  const bloco = escopo.locator("div", { has: page.locator(`label:text-is("${label}")`) }).last();
  await bloco.locator('button[role="combobox"]').first().click();
  await page.getByRole("option", { name: opcao, exact: false }).first().click();
}

export async function preencher(page, label, valor, escopo = page) {
  const bloco = escopo.locator("div", { has: page.locator(`label:text-is("${label}")`) }).last();
  await bloco.locator("input, textarea").first().fill(String(valor));
}

export async function toast(page) {
  const t = page.locator("[data-sonner-toast]").last();
  await t.waitFor({ timeout: 8000 }).catch(() => {});
  return ((await t.textContent().catch(() => "")) || "").trim();
}

export const resultados = [];
export function check(nome, ok, detalhe = "") {
  resultados.push({ nome, ok: !!ok, detalhe });
  console.log((ok ? "OK    " : "FALHA ") + nome + (detalhe ? " | " + detalhe : ""));
}

// Empresa nova começa sem materiais: cria o material de teste se não existir.
export async function garantirMaterial(token, cid, nome, extra = {}) {
  const f = encodeURIComponent(`company_id="${cid}" && name="${nome}"`);
  const achou = (await api("GET", "/api/collections/materiais/records?perPage=1&filter=" + f, token)).data.items?.[0];
  if (achou) return achou;
  return (await api("POST", "/api/collections/materiais/records", token, {
    name: nome, code: "T-" + nome.slice(0, 3).toUpperCase(), unit: "un", category: "Materiais de Construção", status: "active", company_id: cid, ...extra,
  })).data;
}
