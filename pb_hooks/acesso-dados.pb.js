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

// Campos sensíveis escondidos na resposta para quem não trabalha com eles.
onRecordEnrich((e) => {
  const a = e.requestInfo && e.requestInfo.auth;
  if (!a || a.isSuperuser()) return e.next();
  const cargo = a.get("cargo") || a.get("role");
  const admin = a.get("dono_sistema") === true || a.get("role") === "admin" || a.get("role") === "Administrador" || cargo === "Administrador";
  if (admin) return e.next();
  const em = (lista) => lista.includes(cargo);
  const PESSOAS = ["Diretoria", "Gerência", "RH", "Mestre de Obras"];
  const VALORES = ["Diretoria", "Gerência", "Engenheiro", "Mestre de Obras", "Almoxarife", "Comprador", "Financeiro"];
  const CAMPOS = {
    funcionarios: [PESSOAS, ["cpf", "salario", "data_nascimento", "endereco", "cep", "contato_emergencia"]],
    users: [["RH"], ["cpf"]],
    materiais: [VALORES, ["unit_cost"]],
    equipamentos: [VALORES, ["acquisition_cost", "valor_compra", "valor_atual"]],
    equipamentos_manutencao: [VALORES, ["custos"]],
    epis: [VALORES.concat(["RH"]), ["valor_unitario", "valor_medio"]],
    obras: [["Diretoria", "Gerência", "Engenheiro", "Financeiro"], ["budget", "actual_cost"]],
    saldo_funcionario: [VALORES, ["valor_unitario", "valor_total"]],
  };
  const tabela = e.record.collection().name;
  const regra = CAMPOS[tabela];
  if (regra && !em(regra[0])) {
    // users: a própria pessoa continua vendo o próprio CPF.
    if (!(tabela === "users" && e.record.id === a.id)) e.record.hide(...regra[1]);
  }
  e.next();
}, "funcionarios", "users", "materiais", "equipamentos", "equipamentos_manutencao", "epis", "obras", "saldo_funcionario");
