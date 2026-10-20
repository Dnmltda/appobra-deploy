// QR Code gerado no próprio app (sem sites de fora), leitura que abre o item
// e fica registrada por empresa, e leitura de verdade pela câmera (câmera de
// teste do Chromium mostrando a etiqueta gerada).
import { createRequire } from "module";
import { abrir, api, apiLogin, escolher, check, FRONT, OUT, fs } from "./lib.mjs";
const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const mat = (await api("POST", "/api/collections/materiais/records", token, { name: "Areia média (m³)", code: "QR-AREIA", unit: "m3",
  quantity_in_stock: 0, status: "active", company_id: cid })).data;
const leituras = async (t = token) => (await api("GET", "/api/collections/qrcode_leituras/records?sort=-created", t)).data.items || [];

const { browser, page, erros } = await abrir();
const externos = [];
page.on("request", (r) => { if (/qrserver|bwipjs/.test(r.url())) externos.push(r.url()); });

// 1. Gerar a etiqueta de um material cadastrado
await page.goto(FRONT + "/qrcode"); await page.waitForTimeout(2000);
check("Menu tem a entrada 'QR Code'", (await page.getByRole("link", { name: "QR Code" }).count()) > 0);
await escolher(page, "Item", /Areia média/);
const img = page.getByAltText("QR Code").first();
await img.waitFor({ timeout: 8000 });
const src = await img.getAttribute("src");
check("Etiqueta gerada no próprio aparelho (imagem local, nenhum site de fora)", src.startsWith("data:image/png") && externos.length === 0, externos.join(", "));
await page.screenshot({ path: OUT + "qrcode-1-etiqueta.png" });

// 2. Link do QR (câmera comum do celular abre o app no item)
await page.goto(FRONT + `/qrcode?ler=material:${mat.id}`); await page.waitForTimeout(2500);
const lido = page.locator('[data-testid="item-lido"]');
check("Abrir o link do QR mostra o item", (await lido.count()) === 1 && /Areia média/.test(await lido.innerText()), await lido.count() ? (await lido.innerText()).slice(0, 80) : "");
await page.waitForTimeout(800);
let ls = await leituras();
check("A leitura fica registrada na empresa, com quem leu", ls.length === 1 && ls[0].company_id === cid && ls[0].item_id === mat.id && ls[0].usuario_id === user.id,
  JSON.stringify(ls[0] || {}).slice(0, 120));

// 3. Histórico
await page.getByRole("tab", { name: /Histórico/ }).click(); await page.waitForTimeout(1500);
check("Histórico mostra a leitura", (await page.getByText(/Areia média/).count()) > 0);
await browser.close();

// 4. Outra empresa não abre o item pelo QR
const sB = await abrir("b@teste.local");
await sB.page.goto(FRONT + `/qrcode?ler=material:${mat.id}`); await sB.page.waitForTimeout(2500);
check("Empresa B lê o QR da Empresa A e não vê o item", (await sB.page.locator("text=Item não encontrado").count()) === 1);
await sB.browser.close();

// 5. Leitura de verdade pela câmera: a câmera de teste mostra a etiqueta.
let qrlib = null;
for (const dir of [process.env.FRONTEND_DIR && process.env.FRONTEND_DIR + "/node_modules/", new URL("../../../../frontend/node_modules/", import.meta.url).pathname]) {
  try { if (dir && !qrlib) qrlib = createRequire(dir)("qrcode"); } catch (_) { /* tenta a próxima */ }
}
if (!qrlib) console.log("AVISO  sem a biblioteca qrcode (FRONTEND_DIR): pulando a leitura pela câmera");
if (qrlib) {
  const texto = `${FRONT}/qrcode?ler=material:${mat.id}`;
  const m = qrlib.create(texto, { errorCorrectionLevel: "M" }).modules;
  const esc = 8, borda = 4, n = m.size, lado = (n + borda * 2) * esc;
  const W = 640, H = 480, ox = (W - lado) >> 1, oy = (H - lado) >> 1;
  const Y = Buffer.alloc(W * H, 235);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (m.get(x, y)) {
    for (let dy = 0; dy < esc; dy++) Y.fill(16, (oy + (y + borda) * esc + dy) * W + ox + (x + borda) * esc, (oy + (y + borda) * esc + dy) * W + ox + (x + borda + 1) * esc);
  }
  const UV = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const arq = OUT + "qr-camera.y4m";
  const quadros = [Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`)];
  for (let i = 0; i < 10; i++) quadros.push(Buffer.from("FRAME\n"), Y, UV);
  fs.writeFileSync(arq, Buffer.concat(quadros));

  const { createRequire: cr } = await import("module");
  const { chromium } = cr("/opt/node22/lib/node_modules/")("playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${arq}`] });
  const p = await b.newPage({ viewport: { width: 1366, height: 860 }, permissions: ["camera"] });
  await p.goto(FRONT + "/login");
  await p.locator('input[type="email"], input[name="email"], input#email').first().fill("a@teste.local");
  await p.locator('input[type="password"]').first().fill("Senha12345");
  await p.locator('button[type="submit"]').first().click();
  await p.waitForURL(/dashboard/, { timeout: 15000 });
  await p.goto(FRONT + "/qrcode"); await p.waitForTimeout(1500);
  await p.getByRole("tab", { name: /Escanear/ }).click(); await p.waitForTimeout(1500);
  const pedir = p.getByRole("button", { name: /Request Camera Permissions|Permiss/i });
  if (await pedir.count()) { await pedir.first().click(); await p.waitForTimeout(1500); }
  const iniciar = p.getByRole("button", { name: /Start Scanning|Iniciar/i });
  if (await iniciar.count()) await iniciar.first().click();
  await p.locator('[data-testid="item-lido"]').waitFor({ timeout: 20000 }).catch(() => {});
  const ok = (await p.locator('[data-testid="item-lido"]').count()) === 1;
  check("Câmera lê a etiqueta e abre o item", ok && /Areia média/.test(await p.locator('[data-testid="item-lido"]').innerText()));
  await p.screenshot({ path: OUT + "qrcode-2-lido-camera.png" });
  await b.close();
  ls = await leituras();
  check("A leitura pela câmera também fica registrada", ls.length === 2, `${ls.length}`);
}

check("Sem erro de consulta na tela", !erros.some((e) => /Failed to fetch|\b400\b|\b403\b|\b500\b/.test(e) && !/realtime|submitSubscriptions/.test(e)), erros.join(" | ").slice(0, 200));
