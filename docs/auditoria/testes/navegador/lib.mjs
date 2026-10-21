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

export async function abrir(email = "a@teste.local", pass = "Senha12345", { video } = {}) {
  // Câmera de mentira do Chromium (imagem de teste) para a foto da retirada;
  // com "video" (arquivo .y4m), a câmera mostra essa imagem (ex.: um código de barras).
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", ...(video ? [`--use-file-for-fake-video-capture=${video}`] : [])] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 }, permissions: ["camera"] });
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

// Foto da retirada: abre a câmera (de teste) e espera ela tirar sozinha.
// (se a contagem automática não terminar a tempo, aperta "Tirar agora").
export async function tirarFoto(page, escopo) {
  const e = escopo || page;
  await e.getByRole("button", { name: /Abrir câmera/ }).click();
  const foto = e.getByAltText("Foto tirada");
  try {
    await foto.waitFor({ timeout: 8000 });
  } catch (_) {
    const agora = e.getByRole("button", { name: /Tirar agora/ });
    if (await agora.count()) await agora.click();
    await foto.waitFor({ timeout: 8000 });
  }
}

// Igual a api(), mas manda junto a foto obrigatória de quem retira (foto_retirada).
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
export async function apiComFoto(method, path, token, body) {
  const fd = new FormData();
  fd.append("@jsonPayload", JSON.stringify(body));
  fd.append("foto_retirada", new Blob([JPEG], { type: "image/jpeg" }), "foto.jpg");
  const r = await fetch(API + path, { method, headers: token ? { Authorization: token } : {}, body: fd });
  const txt = await r.text();
  return { status: r.status, data: txt ? JSON.parse(txt) : {} };
}

// Vídeo .y4m (câmera de teste) com uma imagem em preto e branco: linhas[y][x] = true para preto.
export function videoY4m(arquivo, pintar, W = 640, H = 480) {
  const Y = Buffer.alloc(W * H, 235);
  pintar((x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) Y[y * W + x] = 16; }, W, H);
  const UV = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const partes = [Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`)];
  for (let i = 0; i < 10; i++) partes.push(Buffer.from("FRAME\n"), Y, UV);
  fs.writeFileSync(arquivo, Buffer.concat(partes));
  return arquivo;
}
