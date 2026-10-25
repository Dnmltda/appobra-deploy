// Arquivos protegidos (auditoria A6): fotos e documentos só abrem com o passe de
// quem está logado, e as telas continuam mostrando tudo.
import { abrir, api, apiLogin, check, FRONT, API } from "./lib.mjs";

const { token, user } = await apiLogin("a@teste.local");
const cid = user.company_id;
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
async function comArquivo(col, campo, body) {
  const fd = new FormData();
  fd.append("@jsonPayload", JSON.stringify(body));
  fd.append(campo, new Blob([JPEG], { type: "image/jpeg" }), "arquivo.jpg");
  const r = await fetch(`${API}/api/collections/${col}/records`, { method: "POST", headers: { Authorization: token }, body: fd });
  return r.json();
}
const mat = await comArquivo("materiais", "foto", { name: "Cimento com foto", code: "ARQ-1", unit: "sc", company_id: cid });
const obra = await comArquivo("obras", "fotos", { nome: "Obra com foto", company_id: cid });
const doc = await comArquivo("documentos_central", "arquivo", { titulo: "Contrato com arquivo", nome: "Contrato com arquivo", company_id: cid });
check("(preparo) material, obra e documento com arquivo", mat.id && obra.id && doc.id, JSON.stringify([mat.message, obra.message, doc.message]));

const semLogin = await fetch(`${API}/api/files/${mat.collectionId}/${mat.id}/${mat.foto}`);
check("Foto do material não abre sem login", semLogin.status === 404 || semLogin.status === 403, String(semLogin.status));

const { browser, page, erros } = await abrir("a@teste.local");
// Espera as imagens da tela carregarem e conta as que não abriram.
async function imagens(rota, filtro) {
  await page.goto(FRONT + rota); await page.waitForTimeout(3000);
  return page.evaluate((f) => {
    const imgs = [...document.querySelectorAll("img")].filter((i) => i.src.includes("/api/files/") && (!f || i.src.includes(f)));
    return { total: imgs.length, quebradas: imgs.filter((i) => !i.complete || i.naturalWidth === 0).length, comPasse: imgs.filter((i) => i.src.includes("token=")).length };
  }, filtro);
}
let r = await imagens("/materiais", mat.id);
check("Materiais: a foto aparece (com o passe)", r.total > 0 && r.quebradas === 0 && r.comPasse === r.total, JSON.stringify(r));
r = await imagens(`/obras/${obra.id}`, obra.id);
check("Página da obra: a foto aparece (com o passe)", r.total > 0 && r.quebradas === 0, JSON.stringify(r));
r = await imagens("/projects", obra.id);
check("Lista de obras: a capa aparece", r.total > 0 && r.quebradas === 0, JSON.stringify(r));
await page.goto(FRONT + "/documentos"); await page.waitForTimeout(3000);
const href = await page.locator(`a[href*="${doc.id}"]`).first().getAttribute("href").catch(() => "");
const baixa = href ? await fetch(href) : { status: 0 };
check("Central de documentos: o link do arquivo abre (com o passe)", href.includes("token=") && baixa.status === 200, `${baixa.status} ${href.slice(-40)}`);
check("Sem erro de tela", !erros.some((e) => /PAGEERROR/.test(e)), erros.filter((e) => /PAGEERROR/.test(e)).join(" | ").slice(0, 200));
await browser.close();
