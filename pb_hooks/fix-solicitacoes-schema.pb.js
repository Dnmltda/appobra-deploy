/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Correção — "solicitacoes" nunca recebeu os campos em português.
//
// A collection "solicitacoes" foi criada originalmente (em inglês) por
// 1781748905_004_created_solicitacoes.js: request_number (obrigatório),
// obra_id (obrigatório), status (select: draft/pending/approved/
// rejected/completed), priority (select: low/medium/high/urgent),
// description, deleted_at, company_id (companies — correto).
//
// Depois, 1786150430_solicitacoes_modulo.js tentou recriar a mesma
// collection com campos em português (numero_solicitacao, tipo,
// categoria, solicitante_id, departamento, centro_custo,
// responsavel_id, prioridade, descricao, justificativa,
// data_solicitacao, data_prazo, observacoes, criado_por,
// atualizado_por) — mas seu helper "createCollection" só cria quando a
// collection NÃO existe ainda; como "solicitacoes" já existia, essa
// chamada não fez nada, e nenhum desses campos chegou a ser criado de
// verdade. O front (SolicitacoesPage.jsx / useSolicitacoes.js) foi
// construído já assumindo o schema em português, e sempre envia esses
// nomes — que a collection real não tem (PocketBase ignora campos
// desconhecidos em silêncio) — e nunca envia "request_number" nem
// "obra_id" (que a collection real exige), nem "status" com um valor
// aceito pela lista em inglês. Resultado: toda tentativa de cadastrar
// uma Solicitação falhava.
//
// Esta correção:
//  1) Torna request_number e obra_id OPCIONAIS (o front não os usa).
//  2) Estende os valores aceitos em "status" para incluir também os
//     em português já usados pelo front (mantém os em inglês, caso
//     algum registro antigo exista — não há necessidade de remover).
//  3) Adiciona "prioridade" (select, português) como campo novo — o
//     campo antigo "priority" (inglês) fica intocado, sem uso.
//  4) Adiciona os demais campos em português que a collection real
//     ainda não tem, sem remover nada existente.
//
// Idempotente (cada campo só é adicionado se ainda não existir; a
// lista de "status" só cresce) e tolerante a erro (try/catch — uma
// falha aqui não derruba o boot do servidor). Roda a cada início do
// servidor.
onBootstrap((e) => {
  e.next();
  try {
    const col = $app.findCollectionByNameOrId("solicitacoes");
    const users = $app.findCollectionByNameOrId("users");
    let changed = false;

    // 1) request_number / obra_id deixam de ser obrigatórios.
    const requestNumberField = col.fields.getByName("request_number");
    if (requestNumberField && requestNumberField.required) {
      requestNumberField.required = false;
      changed = true;
    }
    const obraIdField = col.fields.getByName("obra_id");
    if (obraIdField && obraIdField.required) {
      obraIdField.required = false;
      changed = true;
    }

    // 2) "status" — estende valores (inglês legado + português real).
    const statusField = col.fields.getByName("status");
    if (statusField) {
      const desired = [
        "draft", "pending", "approved", "rejected", "completed",
        "Aberta", "Em análise", "Aguardando aprovação", "Aprovada",
        "Em execução", "Concluída", "Cancelada", "Rejeitada",
      ];
      const current = statusField.values || [];
      const merged = current.concat(desired.filter((v) => current.indexOf(v) === -1));
      if (merged.length !== current.length) {
        statusField.values = merged;
        changed = true;
      }
    }

    // 3) + 4) Campos em português ainda ausentes.
    const addIfMissing = (field) => {
      if (!col.fields.getByName(field.name)) {
        col.fields.add(field);
        changed = true;
      }
    };

    addIfMissing(new TextField({ name: "numero_solicitacao", max: 60 }));
    addIfMissing(
      new SelectField({
        name: "tipo",
        maxSelect: 1,
        values: [
          "Material", "Compra", "Equipamento", "Ferramenta", "EPI",
          "Financeiro", "RH", "Transporte", "Documento", "Manutenção",
          "Administrativo", "Outro",
        ],
      }),
    );
    addIfMissing(new TextField({ name: "categoria", max: 120 }));
    addIfMissing(
      new RelationField({
        name: "solicitante_id",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addIfMissing(new TextField({ name: "departamento", max: 120 }));
    addIfMissing(new TextField({ name: "centro_custo", max: 120 }));
    addIfMissing(
      new RelationField({
        name: "responsavel_id",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addIfMissing(
      new SelectField({
        name: "prioridade",
        maxSelect: 1,
        values: ["Baixa", "Normal", "Alta", "Urgente", "Emergencial"],
      }),
    );
    addIfMissing(new TextField({ name: "descricao", max: 2000 }));
    addIfMissing(new TextField({ name: "justificativa", max: 2000 }));
    addIfMissing(new DateField({ name: "data_solicitacao" }));
    addIfMissing(new DateField({ name: "data_prazo" }));
    addIfMissing(new TextField({ name: "observacoes", max: 2000 }));
    addIfMissing(
      new RelationField({
        name: "criado_por",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addIfMissing(
      new RelationField({
        name: "atualizado_por",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );

    if (changed) {
      $app.save(col);
      console.log("[fix-solicitacoes-schema] solicitacoes: campos em portugues adicionados/atualizados.");
    }
  } catch (err) {
    console.log("[fix-solicitacoes-schema] Erro:", err);
  }
});
