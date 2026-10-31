// Estrutura da obra: andares, unidades e serviços (pedido do Diego, 31/10/2026).
// Funções usadas por estrutura-obra.pb.js (cada handler do JSVM roda isolado).

const STATUS = ["Não iniciado", "Em andamento", "Concluído"];
const PADRAO = ["Alvenaria/Estrutura", "Hidráulica", "Elétrica", "Esquadrias", "Acabamento/Revestimento", "Pintura"];
// Quem monta a estrutura e muda o status (Almoxarife, Funcionário, Diretoria e
// Cliente só veem).
const EDITA = ["Administrador", "Gerência", "Engenheiro", "Mestre de Obras"];

function ehAdmin(a) {
  return !!a && (a.get("dono_sistema") === true || a.get("cargo") === "Administrador" || a.get("role") === "admin" || a.get("role") === "Administrador");
}

function podeEditar(a) {
  if (!a) return false;
  if (a.isSuperuser && a.isSuperuser()) return true;
  return ehAdmin(a) || EDITA.includes(a.get("cargo") || a.get("role"));
}

// Catálogo inicial da empresa (só se ela ainda não tem nenhum serviço).
function semearCatalogo(app, companyId) {
  if (!companyId) return 0;
  const ja = app.findRecordsByFilter("servicos_padrao", "company_id = {:c}", "", 1, 0, { c: companyId });
  if (ja.length) return 0;
  const col = app.findCollectionByNameOrId("servicos_padrao");
  PADRAO.forEach((nome, i) => {
    const r = new Record(col);
    r.set("company_id", companyId);
    r.set("nome", nome);
    r.set("ordem", i + 1);
    r.set("ativo", true);
    app.save(r);
  });
  return PADRAO.length;
}

// Unidade nova recebe os serviços ativos do catálogo, todos "Não iniciado".
function servicosIniciais(app, unidade) {
  const cat = app.findRecordsByFilter("servicos_padrao", "company_id = {:c} && ativo = true", "ordem,nome", 0, 0, { c: unidade.get("company_id") });
  const col = app.findCollectionByNameOrId("obras_unidade_servicos");
  cat.forEach((s) => {
    const r = new Record(col);
    r.set("company_id", unidade.get("company_id"));
    r.set("obra_id", unidade.get("obra_id"));
    r.set("unidade_id", unidade.id);
    r.set("servico_id", s.id);
    r.set("servico_nome", s.get("nome"));
    r.set("status", "Não iniciado");
    r.set("ativo", true);
    app.save(r);
  });
}

// % da unidade = concluídos ÷ serviços ativos; andar = média das unidades;
// obra = média dos andares (Prédio) ou das unidades (Casa).
function progresso(app, obraId) {
  const unidades = app.findRecordsByFilter("obras_unidades", "obra_id = {:o} && ativo = true", "", 0, 0, { o: obraId });
  const servs = app.findRecordsByFilter("obras_unidade_servicos", "obra_id = {:o} && ativo = true", "", 0, 0, { o: obraId });
  const porUnidade = {};
  servs.forEach((s) => {
    const u = s.get("unidade_id");
    porUnidade[u] = porUnidade[u] || { t: 0, c: 0 };
    porUnidade[u].t++;
    if (s.get("status") === "Concluído") porUnidade[u].c++;
  });
  const pctUnidade = (u) => (porUnidade[u.id] && porUnidade[u.id].t ? (porUnidade[u.id].c / porUnidade[u.id].t) * 100 : 0);
  const media = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);
  const andares = app.findRecordsByFilter("obras_andares", "obra_id = {:o} && ativo = true", "", 0, 0, { o: obraId });
  let geral;
  if (andares.length) {
    geral = media(andares.map((a) => media(unidades.filter((u) => u.get("andar_id") === a.id).map(pctUnidade))));
  } else {
    geral = media(unidades.map(pctUnidade));
  }
  return Math.round(geral * 10) / 10;
}

function gravarProgresso(app, obraId) {
  if (!obraId) return;
  try {
    const obra = app.findRecordById("obras", obraId);
    const t = obra.get("tipo_estrutura");
    if (t !== "Prédio" && t !== "Casa") return; // obra sem estrutura: nada muda
    const p = progresso(app, obraId);
    if (Number(obra.get("progress_percentage") || 0) !== p) {
      obra.set("progress_percentage", p);
      app.saveNoValidate(obra);
    }
  } catch (err) {
    console.log("[estrutura-obra] Erro ao calcular o progresso:", err);
  }
}

// Campo opcional "para qual andar/unidade" no pedido e no uso de material.
function conferirUnidade(e) {
  const r = e.record;
  const u = String(r.get("unidade_id") || "");
  if (!u) return;
  let un;
  try { un = e.app.findRecordById("obras_unidades", u); } catch (_) { throw new BadRequestError("Andar/unidade não encontrado."); }
  if (!r.get("obra_id") || un.get("obra_id") !== r.get("obra_id")) throw new BadRequestError("O andar/unidade escolhido não é desta obra.");
}

module.exports = { conferirUnidade,  STATUS, PADRAO, EDITA, ehAdmin, podeEditar, semearCatalogo, servicosIniciais, progresso, gravarProgresso };
