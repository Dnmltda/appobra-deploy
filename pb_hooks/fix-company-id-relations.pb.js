/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Correção — company_id apontando para a collection errada.
//
// "solicitacoes_aprovacao", "solicitacoes_anexos", "compras_itens",
// "compras_aprovacao", "compras_recebimento" e "compras_anexos" foram
// criadas (em 1786150430_solicitacoes_modulo.js e 1786148600_compras_modulo.js)
// com o campo "company_id" apontando (collectionId) para "empresas" — o
// cadastro de empresas clientes/parceiras, sem relação com o usuário
// logado — em vez de "companies" (a empresa/conta de quem está logado,
// mesma collection usada em users.company_id, materiais.company_id etc).
// Como o front sempre envia o ID de "companies", a validação do
// relacionamento falhava sempre, com o genérico "Failed to create record."
//
// ("solicitacoes" em si NÃO tem esse problema: seu company_id já aponta
// para "companies" desde 1781749478_013_add_company_id_to_solicitacoes.js
// — confirmado também por 1782357250, que já filtra por "company_id.name",
// campo que só existe em "companies". A tentativa anterior de corrigir
// "solicitacoes" aqui também foi o que derrubou o servidor.)
//
// PocketBase recusa trocar o collectionId de um campo relation já
// existente (erro: "The relation collection cannot be changed."), mesmo
// removendo e recriando o campo com o mesmo nome dentro de um único
// app.save(). A correção real exige DOIS app.save() separados: um só
// para remover o campo (e os índices que o referenciam), outro — já
// com o campo oficialmente ausente da collection salva — para recriar
// apontando para "companies" e devolver os mesmos índices.
//
// Cada collection é tratada em seu próprio try/catch: um erro em uma
// não derruba as demais nem o boot do servidor. Roda a cada início do
// servidor; é IDEMPOTENTE (se já estiver correto, não faz nada).
onBootstrap((e) => {
  e.next();

  let companies;
  try {
    companies = $app.findCollectionByNameOrId("companies");
  } catch (err) {
    console.log("[fix-company-id-relations] Erro ao localizar companies:", err);
    return;
  }

  // Índices que referenciam company_id, para remover junto com o campo
  // e devolver depois que o campo voltar a existir (mesmo nome, então o
  // mesmo SQL volta a ser válido).
  const companyIdIndexes = {
    solicitacoes_aprovacao: [
      "CREATE INDEX idx_solicitacoes_aprov_company ON solicitacoes_aprovacao (company_id)",
    ],
    solicitacoes_anexos: [
      "CREATE INDEX idx_solicitacoes_anexos_company ON solicitacoes_anexos (company_id)",
    ],
    compras_itens: [
      "CREATE INDEX idx_compras_itens_company ON compras_itens (company_id)",
    ],
    compras_aprovacao: [
      "CREATE INDEX idx_compras_aprov_company ON compras_aprovacao (company_id)",
    ],
    compras_recebimento: [
      "CREATE UNIQUE INDEX idx_compras_receb_numero ON compras_recebimento (numero_recebimento, company_id) WHERE numero_recebimento != ''",
      "CREATE INDEX idx_compras_receb_company ON compras_recebimento (company_id)",
    ],
    compras_anexos: [
      "CREATE INDEX idx_compras_anexos_company ON compras_anexos (company_id)",
    ],
  };

  const RULE_FIELDS = ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"];

  // col.listRule (e as demais regras) não são strings JS comuns — são
  // um tipo nullable do Go exposto como objeto (typeof "object"). Dá
  // pra LER o texto normalmente (concatena/serializa certo), mas
  // devolver esse valor direto para outra atribuição de regra é
  // ignorado em silêncio (nem dá erro, nem troca o valor — fica como
  // estava). Por isso captura com String(...) explícito (só quando não
  // é null/undefined) antes de neutralizar, e restaura esse texto puro.
  const captureRule = (value) => (value === null || value === undefined ? null : String(value));

  Object.keys(companyIdIndexes).forEach((name) => {
    try {
      const col = $app.findCollectionByNameOrId(name);
      const field = col.fields.getByName("company_id");
      if (!field || field.collectionId === companies.id) {
        return; // já correto ou sem o campo — nada a fazer
      }

      // As regras de acesso (list/view/create/update) citam "company_id"
      // como campo da própria collection (ex.: "@request.auth.company_id
      // = company_id") — com o campo removido, salvar a collection com
      // essas regras intactas é rejeitado ("unknown field company_id").
      // Guarda o texto de cada regra (ver captureRule acima) para
      // devolver depois.
      const savedRules = {};
      RULE_FIELDS.forEach((rf) => {
        savedRules[rf] = captureRule(col[rf]);
      });
      const idxToRestore = (col.indexes || []).filter((idx) => idx.indexOf("company_id") !== -1);

      // Passo 1: neutraliza (só durante este boot, antes do servidor
      // aceitar requisições) todas as regras, remove os índices que
      // referenciam company_id e remove o campo. Grava.
      RULE_FIELDS.forEach((rf) => {
        col[rf] = null;
      });
      col.indexes = (col.indexes || []).filter((idx) => idx.indexOf("company_id") === -1);
      col.fields.removeByName("company_id");
      $app.save(col);

      // Passo 2: com o campo já removido e persistido (passo acima),
      // recria apontando para "companies" e devolve os índices e as
      // regras originais (agora válidas de novo, com o campo
      // existindo), em outro save. Reaproveita o mesmo objeto "col" —
      // buscar de novo via findCollectionByNameOrId faria o mesmo
      // problema de "devolver a regra" acontecer de novo.
      col.fields.add(
        new RelationField({
          name: "company_id",
          collectionId: companies.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
      );
      col.indexes = (col.indexes || []).concat(idxToRestore);
      RULE_FIELDS.forEach((rf) => {
        col[rf] = savedRules[rf];
      });
      $app.save(col);

      console.log("[fix-company-id-relations] " + name + ": company_id agora aponta para companies.");
    } catch (err) {
      console.log("[fix-company-id-relations] Erro em " + name + ":", err);
    }
  });

  // ------------------------------------------------------------
  // Campos órfãos nunca preenchidos pelo app atual — sobras de
  // migrações antigas (quantity: substituído por "quantidade";
  // company_id_new: duplicata de company_id de uma tentativa de
  // multi-tenant incompleta). Nenhuma tela usa esses campos, então
  // toda criação de movimentação/empréstimo falhava com
  // "Cannot be blank." para eles. Nenhum índice os referencia
  // (confirmado), então a remoção é direta, sem o cuidado acima.
  //
  // "equipamentos.company_id_new" já é removido em todo boot por
  // outro hook (log-security-event.pb.js) — não repetido aqui.
  const removeOrphanField = (collectionName, fieldName) => {
    try {
      const col = $app.findCollectionByNameOrId(collectionName);
      if (!col.fields.getByName(fieldName)) return; // já removido — nada a fazer
      col.fields.removeByName(fieldName);
      $app.save(col);
      console.log("[fix-orphan-fields] " + collectionName + "." + fieldName + " removido.");
    } catch (err) {
      console.log("[fix-orphan-fields] Erro em " + collectionName + "." + fieldName + ":", err);
    }
  };

  removeOrphanField("movimentacoes", "quantity");
  removeOrphanField("movimentacoes", "company_id_new");
  removeOrphanField("emprestimos", "company_id_new");
});
