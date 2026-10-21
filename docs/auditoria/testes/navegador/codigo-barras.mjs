// Código de barras da embalagem: a câmera (de teste) mostra o código EAN-13
// do saco de cimento e o app acha o material no Estoque e na tela QR Code.
import { abrir, api, apiLogin, check, FRONT, OUT, videoY4m } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const EAN = "7891234567895";
const mat = (await api("POST", "/api/collections/materiais/records", token, { name: "Cimento CP II 50kg", unit: "sc", category: "Materiais de Construção",
  codigo_barras: EAN, status: "active", company_id: cid })).data;
check("Material cadastrado com o código de barras", mat.codigo_barras === EAN, JSON.stringify(mat).slice(0, 120));

// EAN-13 desenhado à mão (padrões L/G/R da norma) para a câmera de teste.
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = L.map((p) => [...p].map((b) => (b === "1" ? "0" : "1")).reverse().join(""));
const R = L.map((p) => [...p].map((b) => (b === "1" ? "0" : "1")).join(""));
const PARIDADE = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];
const d = [...EAN].map(Number);
let bits = "101";
for (let i = 1; i <= 6; i++) bits += (PARIDADE[d[0]][i - 1] === "L" ? L : G)[d[i]];
bits += "01010";
for (let i = 7; i <= 12; i++) bits += R[d[i]];
bits += "101";
const video = videoY4m(OUT + "barras-camera.y4m", (pinta, W, H) => {
  const m = 4, x0 = Math.floor((W - bits.length * m) / 2);
  for (let i = 0; i < bits.length; i++) if (bits[i] === "1") for (let x = 0; x < m; x++) for (let y = 140; y < 340; y++) pinta(x0 + i * m + x, y);
});

// 1. Estoque → Registrar Entrada → ler o código: o material é escolhido sozinho
let s = await abrir("a@teste.local", "Senha12345", { video });
let page = s.page;
await page.goto(FRONT + "/estoque"); await page.waitForTimeout(2500);
await page.getByRole("button", { name: /Registrar Entrada/ }).first().click();
const dlg = page.getByRole("dialog");
await dlg.getByRole("button", { name: /Ler código de barras/ }).click();
await page.getByText("Material: Cimento CP II 50kg").waitFor({ timeout: 20000 }).catch(() => {});
check("Registrar Entrada: a câmera lê o código e escolhe o material", /Cimento CP II 50kg/.test(await dlg.locator("#ent_material").innerText()),
  await dlg.locator("#ent_material").innerText());
await page.screenshot({ path: OUT + "barras-1-entrada.png" });
await s.browser.close();

// 2. Tela QR Code → Escanear: o código de barras da embalagem abre o material
s = await abrir("a@teste.local", "Senha12345", { video });
page = s.page;
await page.goto(FRONT + "/qrcode"); await page.waitForTimeout(1500);
await page.getByRole("tab", { name: /Escanear/ }).click(); await page.waitForTimeout(1500);
const pedir = page.getByRole("button", { name: /Request Camera Permissions/i });
if (await pedir.count()) { await pedir.first().click(); await page.waitForTimeout(1500); }
const iniciar = page.getByRole("button", { name: /Start Scanning/i });
if (await iniciar.count()) await iniciar.first().click();
await page.locator('[data-testid="item-lido"]').waitFor({ timeout: 20000 }).catch(() => {});
check("QR Code → Escanear: o código de barras da embalagem abre o material", (await page.locator('[data-testid="item-lido"]').count()) === 1
  && /Cimento CP II 50kg/.test(await page.locator('[data-testid="item-lido"]').innerText()));
await page.screenshot({ path: OUT + "barras-2-qrcode.png" });
check("Sem erro de consulta na tela", !s.erros.some((e) => /\b400\b|\b403\b|\b404\b|\b500\b/.test(e)), s.erros.join(" | ").slice(0, 200));
await s.browser.close();
