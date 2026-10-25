/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Quem recebe o quê do servidor (G1 da checagem de segurança, 22/10/2026,
// aprovado pelo Diego). Antes, dentro da mesma empresa, qualquer cargo (até
// Pedreiro e Cliente) lia pela API CPF e salário dos funcionários, contas a
// pagar/receber, compras, propostas e custos — a tela escondia, o servidor
// entregava. Agora o servidor só entrega a quem trabalha com aquilo
// (mesmos cargos que abrem a tela correspondente, em frontend/src/lib/permissoes.js):
//
//  1. Tabelas inteiras (regra de listar/ver): financeiro, compras, comercial,
//     frota, documentos e perdas/ganhos. Quem não é do grupo recebe lista vazia.
//  2. Campos (escondidos na resposta): CPF, salário, nascimento, endereço e
//     contato de emergência dos funcionários; CPF dos acessos; custos e
//     valores de materiais, equipamentos, EPIs, obras e saldo do funcionário.
//
// O filtro é feito no pedido (e não nas regras das tabelas), porque outros
// arquivos regravam as regras ao ligar (ex.: seguranca-etapa1.pb.js) e a
// ordem entre eles não é garantida. O dono do sistema e o administrador da
// empresa sempre recebem tudo.
// ============================================================

// Tabelas inteiras: quem não é do grupo recebe lista vazia (e "não encontrado"
// ao abrir um registro). Grupos em acesso-dados-lib.js.
onRecordsListRequest((e) => {
  if (!require(`${__hooks}/acesso-dados-lib.js`).pode(e.auth, e.collection.name)) {
    e.records = [];
    e.result.items = [];
    e.result.totalItems = 0;
    e.result.totalPages = 0;
  }
  e.next();
}, ...require(`${__hooks}/acesso-dados-lib.js`).TABELAS);

onRecordViewRequest((e) => {
  if (!require(`${__hooks}/acesso-dados-lib.js`).pode(e.auth, e.collection.name)) {
    throw new NotFoundError("The requested resource wasn't found.");
  }
  e.next();
}, ...require(`${__hooks}/acesso-dados-lib.js`).TABELAS);

// Campos sensíveis escondidos na resposta para quem não trabalha com eles
// (lista em acesso-dados-lib.js).
onRecordEnrich((e) => {
  const a = e.requestInfo && e.requestInfo.auth;
  const campos = require(`${__hooks}/acesso-dados-lib.js`).escondidos(a, e.record.collection().name);
  // users: a própria pessoa continua vendo o próprio CPF.
  if (campos.length && !(e.record.collection().name === "users" && a && e.record.id === a.id)) e.record.hide(...campos);
  e.next();
}, "funcionarios", "users", "materiais", "equipamentos", "equipamentos_manutencao", "epis", "obras", "saldo_funcionario");

// ------------------------------------------------------------
// Item A5 da auditoria de 24/10/2026 (aprovado pelo Diego): fechar os
// caminhos que ainda vazavam o que está escondido.
// ------------------------------------------------------------

// 1. Busca e ordenação por campo escondido (ex.: ?filter=salario>5000 para
//    descobrir o salário por tentativa) são recusadas para quem não vê o campo.
onRecordsListRequest((e) => {
  const lib = require(`${__hooks}/acesso-dados-lib.js`);
  const q = e.requestInfo().query || {};
  const campo = lib.buscaProibida(e.auth, e.collection.name, String(q.filter || "") + " " + String(q.sort || ""));
  if (campo) throw new BadRequestError("Não é possível buscar por este campo.");
  e.next();
});

// 2. Tempo real: inscrição em tabela que a pessoa não pode ver (ou com filtro
//    por campo escondido) é ignorada; as demais inscrições seguem.
onRealtimeSubscribeRequest((e) => {
  const lib = require(`${__hooks}/acesso-dados-lib.js`);
  const auth = e.auth;
  const ok = [];
  const subs = e.subscriptions || [];
  for (let i = 0; i < subs.length; i++) {
    const topico = String(subs[i]);
    const tabela = topico.split("?")[0].split("/")[0];
    if (lib.TABELAS.includes(tabela) && !lib.pode(auth, tabela)) continue;
    let filtro = "";
    const k = topico.indexOf("options=");
    if (k >= 0) {
      try {
        const op = JSON.parse(decodeURIComponent(topico.slice(k + 8)));
        filtro = String((op.query && (op.query.filter || "")) || "") + " " + String((op.query && op.query.sort) || "");
      } catch (_) { filtro = topico; }
    }
    if (filtro && lib.buscaProibida(auth, tabela, filtro)) continue;
    ok.push(topico);
  }
  e.subscriptions = ok;
  e.next();
});

// 3. Dados vinculados (expand): registro de tabela bloqueada chega vazio, só
//    com o código. A tela continua abrindo, sem a informação restrita.
onRecordEnrich((e) => {
  const lib = require(`${__hooks}/acesso-dados-lib.js`);
  const a = e.requestInfo && e.requestInfo.auth;
  const tabela = e.record.collection().name;
  if (lib.TABELAS.includes(tabela) && !lib.pode(a, tabela)) {
    const nomes = [];
    const fields = e.record.collection().fields;
    for (let i = 0; i < fields.length; i++) if (fields[i].name !== "id") nomes.push(fields[i].name);
    e.record.hide(...nomes);
  }
  e.next();
});
