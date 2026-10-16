/// <reference path="../pb_data/types.d.ts" />

// Módulo de Compras — APP OBRA
// 1) Estende a collection `compras` existente com campos de gestão completa.
// 2) Atualiza regras de acesso para isolamento por company_id.
// 3) Atualiza o select `status` com o fluxo completo de compras.
// 4) Cria 4 novas collections: compras_itens, compras_aprovacao,
//    compras_recebimento, compras_anexos.

const COMPANY_RULE = "@request.auth.company_id = company_id";
const COMPANY_WRITE = "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"";

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const empresas = app.findCollectionByNameOrId("empresas");
    const obras = app.findCollectionByNameOrId("obras");
    const fornecedores = app.findCollectionByNameOrId("fornecedores");
    const materiais = app.findCollectionByNameOrId("materiais");

    // ---------- 1) Estender `compras` ----------
    const compras = app.findCollectionByNameOrId("compras");

    const addFieldIfMissing = (field) => {
      if (!compras.fields.getByName(field.name)) {
        compras.fields.add(field);
      }
    };

    addFieldIfMissing(new TextField({ name: "numero_compra", max: 60 }));
    addFieldIfMissing(
      new RelationField({
        name: "fornecedor_id",
        collectionId: fornecedores.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addFieldIfMissing(
      new RelationField({
        name: "obra_id",
        collectionId: obras.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addFieldIfMissing(
      new RelationField({
        name: "solicitante_id",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addFieldIfMissing(
      new RelationField({
        name: "comprador_id",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addFieldIfMissing(new TextField({ name: "categoria", max: 120 }));
    addFieldIfMissing(new TextField({ name: "subcategoria", max: 120 }));
    addFieldIfMissing(new TextField({ name: "centro_custo", max: 120 }));
    addFieldIfMissing(
      new SelectField({
        name: "prioridade",
        maxSelect: 1,
        values: ["Baixa", "Normal", "Alta", "Urgente"],
      }),
    );
    addFieldIfMissing(new TextField({ name: "justificativa", max: 1000 }));
    addFieldIfMissing(new TextField({ name: "observacoes", max: 2000 }));
    addFieldIfMissing(new DateField({ name: "data_solicitacao" }));
    addFieldIfMissing(new DateField({ name: "data_entrega_prevista" }));
    addFieldIfMissing(new DateField({ name: "data_entrega_real" }));
    addFieldIfMissing(new NumberField({ name: "valor_previsto", min: 0 }));
    addFieldIfMissing(new NumberField({ name: "valor_aprovado", min: 0 }));
    addFieldIfMissing(new NumberField({ name: "valor_final", min: 0 }));
    addFieldIfMissing(
      new SelectField({
        name: "forma_pagamento",
        maxSelect: 1,
        values: ["À Vista", "Parcelado", "Cartão", "Cheque", "Boleto", "Transferência"],
      }),
    );
    addFieldIfMissing(new NumberField({ name: "parcelas", min: 1 }));
    addFieldIfMissing(
      new RelationField({
        name: "responsavel_aprovacao_id",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addFieldIfMissing(new DateField({ name: "data_aprovacao" }));
    addFieldIfMissing(
      new RelationField({
        name: "criado_por",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addFieldIfMissing(
      new RelationField({
        name: "atualizado_por",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
      }),
    );
    addFieldIfMissing(
      new AutodateField({ name: "data_criacao", onCreate: true, onUpdate: false }),
    );
    addFieldIfMissing(
      new AutodateField({ name: "data_atualizacao", onCreate: true, onUpdate: true }),
    );

    // Atualiza o select `status` com o fluxo completo
    const statusField = compras.fields.getByName("status");
    if (statusField) {
      statusField.values = [
        "Solicitado",
        "Em Cotação",
        "Aguardando Aprovação",
        "Aprovado",
        "Pedido Emitido",
        "Em Transporte",
        "Recebido",
        "Parcialmente Recebido",
        "Cancelado",
      ];
    }

    // Regras de acesso — isolamento por company_id
    compras.listRule = COMPANY_RULE;
    compras.viewRule = COMPANY_RULE;
    compras.createRule = COMPANY_WRITE;
    compras.updateRule = COMPANY_WRITE;
    compras.deleteRule = "@request.auth.role = \"admin\"";

    app.save(compras);

    // ---------- Helper para criar collections ----------
    const createCollection = (name, fields, indexes, rules) => {
      let col;
      try {
        col = app.findCollectionByNameOrId(name);
      } catch (_) {
        col = new Collection({ type: "base", name });
        col.listRule = rules.list;
        col.viewRule = rules.view;
        col.createRule = rules.create;
        col.updateRule = rules.update;
        col.deleteRule = rules.delete;
        fields.forEach((f) => col.fields.add(f));
        if (indexes && indexes.length) col.indexes = indexes;
        app.save(col);
      }
      return col;
    };

    const baseRules = {
      list: COMPANY_RULE,
      view: COMPANY_RULE,
      create: COMPANY_WRITE,
      update: COMPANY_WRITE,
      delete: '@request.auth.role = "admin"',
    };

    // ---------- 2) compras_itens ----------
    createCollection(
      "compras_itens",
      [
        new RelationField({
          name: "company_id",
          collectionId: empresas.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new RelationField({
          name: "compra_id",
          collectionId: compras.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        }),
        new RelationField({
          name: "material_id",
          collectionId: materiais.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new TextField({ name: "codigo", max: 80 }),
        new TextField({ name: "descricao", max: 300, required: true }),
        new TextField({ name: "unidade", max: 30, required: true }),
        new NumberField({ name: "quantidade", min: 0, required: true }),
        new NumberField({ name: "preco_unitario", min: 0, required: true }),
        new NumberField({ name: "desconto", min: 0 }),
        new NumberField({ name: "frete", min: 0 }),
        new NumberField({ name: "ipi", min: 0 }),
        new NumberField({ name: "icms", min: 0 }),
        new NumberField({ name: "valor_total", min: 0, required: true }),
        new RelationField({
          name: "fornecedor_id",
          collectionId: fornecedores.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
        new TextField({ name: "observacoes", max: 1000 }),
        new RelationField({
          name: "criado_por",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
        new AutodateField({ name: "data_criacao", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
      ],
      [
        "CREATE INDEX idx_compras_itens_company ON compras_itens (company_id)",
        "CREATE INDEX idx_compras_itens_compra ON compras_itens (compra_id)",
      ],
      baseRules,
    );

    // ---------- 3) compras_aprovacao ----------
    createCollection(
      "compras_aprovacao",
      [
        new RelationField({
          name: "company_id",
          collectionId: empresas.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new RelationField({
          name: "compra_id",
          collectionId: compras.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        }),
        new SelectField({
          name: "nivel_aprovacao",
          maxSelect: 1,
          required: true,
          values: ["Funcionário", "Supervisor", "Engenheiro", "Gerente", "Administrador"],
        }),
        new RelationField({
          name: "usuario_id",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new DateField({ name: "data_aprovacao", required: true }),
        new TextField({ name: "hora_aprovacao", max: 8, required: true }),
        new SelectField({
          name: "status_aprovacao",
          maxSelect: 1,
          values: ["Aprovado", "Rejeitado", "Pendente"],
        }),
        new TextField({ name: "observacao", max: 1000 }),
        new RelationField({
          name: "criado_por",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
        new AutodateField({ name: "data_criacao", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
      ],
      [
        "CREATE INDEX idx_compras_aprov_company ON compras_aprovacao (company_id)",
        "CREATE INDEX idx_compras_aprov_compra ON compras_aprovacao (compra_id)",
      ],
      { ...baseRules, update: null, delete: null },
    );

    // ---------- 4) compras_recebimento ----------
    createCollection(
      "compras_recebimento",
      [
        new RelationField({
          name: "company_id",
          collectionId: empresas.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new RelationField({
          name: "compra_id",
          collectionId: compras.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        }),
        new TextField({ name: "numero_recebimento", max: 60, required: true }),
        new DateField({ name: "data_recebimento", required: true }),
        new TextField({ name: "hora_recebimento", max: 8, required: true }),
        new RelationField({
          name: "responsavel_id",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new NumberField({ name: "quantidade_recebida", min: 0, required: true }),
        new NumberField({ name: "quantidade_prevista", min: 0, required: true }),
        new SelectField({
          name: "status_recebimento",
          maxSelect: 1,
          values: ["Completo", "Parcial", "Devolvido"],
        }),
        new TextField({ name: "observacoes", max: 2000 }),
        new FileField({
          name: "foto_recebimento",
          maxSelect: 1,
          maxSize: 10485760,
          mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        }),
        new RelationField({
          name: "criado_por",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
        new AutodateField({ name: "data_criacao", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
      ],
      [
        "CREATE UNIQUE INDEX idx_compras_receb_numero ON compras_recebimento (numero_recebimento, company_id) WHERE numero_recebimento != ''",
        "CREATE INDEX idx_compras_receb_company ON compras_recebimento (company_id)",
        "CREATE INDEX idx_compras_receb_compra ON compras_recebimento (compra_id)",
      ],
      baseRules,
    );

    // ---------- 5) compras_anexos ----------
    createCollection(
      "compras_anexos",
      [
        new RelationField({
          name: "company_id",
          collectionId: empresas.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new RelationField({
          name: "compra_id",
          collectionId: compras.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        }),
        new SelectField({
          name: "tipo_anexo",
          maxSelect: 1,
          required: true,
          values: ["Orçamento", "Nota Fiscal", "Boleto", "Contrato", "Foto", "PDF", "Excel", "Word"],
        }),
        new FileField({
          name: "arquivo",
          maxSelect: 1,
          maxSize: 20971520,
          required: true,
        }),
        new TextField({ name: "descricao", max: 500 }),
        new RelationField({
          name: "criado_por",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
        new AutodateField({ name: "data_criacao", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
      ],
      [
        "CREATE INDEX idx_compras_anexos_company ON compras_anexos (company_id)",
        "CREATE INDEX idx_compras_anexos_compra ON compras_anexos (compra_id)",
      ],
      baseRules,
    );
  },
  (app) => {
    // Down — best effort
    ["compras_anexos", "compras_recebimento", "compras_aprovacao", "compras_itens"].forEach(
      (name) => {
        try {
          const col = app.findCollectionByNameOrId(name);
          app.delete(col);
        } catch (_) {}
      },
    );
  },
);
