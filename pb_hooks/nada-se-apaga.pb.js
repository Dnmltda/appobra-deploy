/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Regra do Diego (25/10/2026): durante o uso NADA se apaga. Os registros são
// a auditoria da obra e ficam fixos.
//  1. Apagar pela API é recusado em todas as tabelas (nem o Administrador).
//     Os "Excluir" das telas continuam funcionando como ARQUIVAR (some da
//     lista, fica guardado) — seguranca-etapa1.pb.js. Exceção: itens de um
//     pedido ou de uma compra que ainda não foram aprovados (é rascunho).
//  2. Material que está no saldo de algum funcionário não pode ser alterado
//     (nem nome, nem tamanho, nada); o saldo só baixa pelo uso registrado.
//  3. Edição de cadastro guarda o histórico (quem, quando, antes e depois).
//  4. Toda tentativa barrada fica registrada (tentativas_bloqueadas) para o
//     aviso ao titular e ao responsável da empresa.
// Só o fechamento da empresa (a construir) vai apagar de verdade.
// ============================================================

onBootstrap((e) => {
  e.next();
  const app = e.app;
  const ADMIN = '(@request.auth.cargo = "Administrador" || @request.auth.role = "admin" || @request.auth.role = "Administrador")';
  const LER = `(@request.auth.company_id = company_id && ${ADMIN}) || @request.auth.dono_sistema = true`;
  const criar = (nome, campos) => {
    try { app.findCollectionByNameOrId(nome); return; } catch (_) {}
    const companies = app.findCollectionByNameOrId("companies");
    app.save(new Collection({
      type: "base", name: nome, listRule: LER, viewRule: LER, createRule: null, updateRule: null, deleteRule: null,
      fields: [
        { name: "company_id", type: "relation", collectionId: companies.id, maxSelect: 1 },
        { name: "usuario_id", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1 },
        { name: "usuario_nome", type: "text" },
        { name: "tabela", type: "text" },
        { name: "registro_id", type: "text" },
        ...campos,
        { name: "created", type: "autodate", onCreate: true },
      ],
      indexes: [`CREATE INDEX idx_${nome}_empresa ON ${nome} (company_id, created)`],
    }));
    console.log(`[nada-se-apaga] coleção ${nome} criada.`);
  };
  try {
    criar("tentativas_bloqueadas", [{ name: "acao", type: "text" }, { name: "detalhe", type: "text" }]);
    criar("historico_alteracoes", [{ name: "campo", type: "text" }, { name: "antes", type: "text" }, { name: "depois", type: "text" }]);
  } catch (err) {
    console.log("[nada-se-apaga] Erro:", err);
  }
});

// 1a. Antes de tudo (até quem nem tem permissão de apagar): pedido de apagar
//     numa tabela que não arquiva é recusado e REGISTRADO como tentativa. Sem
//     isto o PocketBase recusaria sozinho, sem deixar rastro.
routerUse((e) => {
  try {
    const m = e.request && e.request.method === "DELETE" && /^\/api\/collections\/([^/]+)\/records\/([^/]+)$/.exec(e.request.url.path);
    if (m && e.auth && !e.auth.isSuperuser()) {
      const ARQUIVAM = ["materiais", "funcionarios", "empresas", "epis", "equipamentos", "fornecedores", "clientes", "veiculos",
        "solicitacoes", "compras", "propostas", "contas_receber", "treinamentos", "users",
        "notificacoes", "obra_mensagens", "solicitacoes_anexos", "compras_anexos", "solicitacoes_itens", "compras_itens"];
      let tabela = decodeURIComponent(m[1]);
      try { tabela = $app.findCollectionByNameOrId(tabela).name; } catch (_) {}
      if (!ARQUIVAM.includes(tabela)) {
        require(`${__hooks}/nada-se-apaga-lib.js`).registrarTentativa($app, e.auth, "apagar", tabela, decodeURIComponent(m[2]), `Tentou apagar um registro de ${tabela}`);
        throw new ForbiddenError("Os registros do app não podem ser apagados: eles são a auditoria da obra. A tentativa foi registrada.");
      }
    }
  } catch (err) {
    if (err instanceof ForbiddenError) throw err;
  }
  return e.next();
});

// 1. Apagar: recusado (as tabelas que arquivam são tratadas em seguranca-etapa1.pb.js).
onRecordDeleteRequest((e) => {
  if (e.auth && e.auth.isSuperuser()) return e.next();
  const ARQUIVAM = ["materiais", "funcionarios", "empresas", "epis", "equipamentos", "fornecedores", "clientes", "veiculos",
    "solicitacoes", "compras", "propostas", "contas_receber", "treinamentos", "users",
    "notificacoes", "obra_mensagens", "solicitacoes_anexos", "compras_anexos"];
  const tabela = e.collection.name;
  if (ARQUIVAM.includes(tabela)) return e.next();
  // Rascunho: itens de pedido (regra em fluxo-material.pb.js) e de compra ainda não aprovada.
  if (tabela === "solicitacoes_itens") return e.next();
  if (tabela === "compras_itens") {
    let status = "";
    try { status = e.app.findRecordById("compras", e.record.get("compra_id")).get("status"); } catch (_) {}
    if (["Solicitado", "Rascunho", ""].includes(String(status || ""))) return e.next();
  }
  const lib = require(`${__hooks}/nada-se-apaga-lib.js`);
  lib.registrarTentativa(e.app, e.auth, "apagar", tabela, e.record.id, `Tentou apagar um registro de ${tabela}`);
  throw new ForbiddenError("Os registros do app não podem ser apagados: eles são a auditoria da obra. A tentativa foi registrada.");
});

// 2. Material no saldo de funcionário: nada muda.
onRecordUpdateRequest((e) => {
  if (!(e.auth && e.auth.isSuperuser())) {
    const lib = require(`${__hooks}/nada-se-apaga-lib.js`);
    if (lib.diferencas(e.record).length && lib.materialEmSaldo(e.app, e.record.id)) {
      lib.registrarTentativa(e.app, e.auth, "alterar", "materiais", e.record.id, `Alterar o material "${e.record.original().get("name")}", que está no saldo de funcionário`);
      throw new ForbiddenError("Este material está com funcionários (no saldo) e não pode ser alterado.");
    }
  }
  e.next();
}, "materiais");

// 3. Histórico de edição dos cadastros.
onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/nada-se-apaga-lib.js`);
  const dif = lib.CADASTROS.includes(e.collection.name) ? lib.diferencas(e.record) : [];
  e.next();
  if (!dif.length) return;
  try {
    const col = e.app.findCollectionByNameOrId("historico_alteracoes");
    const quem = e.auth && !e.auth.isSuperuser() ? e.auth : null;
    const empresa = e.collection.name === "companies" ? e.record.id : (e.record.get("company_id") || (quem && quem.get("company_id")) || "");
    dif.forEach((d) => {
      const h = new Record(col);
      h.set("company_id", empresa);
      h.set("usuario_id", quem ? quem.id : "");
      h.set("usuario_nome", quem ? (quem.get("name") || quem.get("email")) : "suporte");
      h.set("tabela", e.collection.name);
      h.set("registro_id", e.record.id);
      h.set("campo", d.campo);
      h.set("antes", d.antes);
      h.set("depois", d.depois);
      e.app.save(h);
    });
  } catch (err) {
    console.log("[nada-se-apaga] Erro ao gravar histórico:", err);
  }
});
