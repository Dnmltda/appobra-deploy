/// <reference path="../pb_data/types.d.ts" />

// Módulo de Solicitações — APP OBRA
// Cria 3 novas collections: solicitacoes, solicitacoes_aprovacao, solicitacoes_anexos.
// Isolamento multitenant por company_id. Não altera collections existentes.

const COMPANY_RULE = "@request.auth.company_id = company_id";
const COMPANY_WRITE = "@request.auth.company_id = company_id && @request.auth.role != \"viewer\"";

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const empresas = app.findCollectionByNameOrId("empresas");
    const obras = app.findCollectionByNameOrId("obras");

    const baseRules = {
      list: COMPANY_RULE,
      view: COMPANY_RULE,
      create: COMPANY_WRITE,
      update: COMPANY_WRITE,
      delete: '@request.auth.role = "admin"',
    };

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

    // ---------- 1) solicitacoes ----------
    createCollection(
      "solicitacoes",
      [
        new TextField({ name: "numero_solicitacao", max: 60, required: true }),
        new RelationField({
          name: "company_id",
          collectionId: empresas.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new SelectField({
          name: "tipo",
          maxSelect: 1,
          required: true,
          values: [
            "Material", "Compra", "Equipamento", "Ferramenta", "EPI",
            "Financeiro", "RH", "Transporte", "Documento", "Manutenção",
            "Administrativo", "Outro",
          ],
        }),
        new TextField({ name: "categoria", max: 120 }),
        new RelationField({
          name: "solicitante_id",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new TextField({ name: "departamento", max: 120 }),
        new TextField({ name: "centro_custo", max: 120 }),
        new RelationField({
          name: "obra_id",
          collectionId: obras.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
        new RelationField({
          name: "responsavel_id",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
        new SelectField({
          name: "prioridade",
          maxSelect: 1,
          values: ["Baixa", "Normal", "Alta", "Urgente", "Emergencial"],
        }),
        new TextField({ name: "descricao", max: 2000, required: true }),
        new TextField({ name: "justificativa", max: 2000 }),
        new DateField({ name: "data_solicitacao", required: true }),
        new DateField({ name: "data_prazo" }),
        new SelectField({
          name: "status",
          maxSelect: 1,
          values: [
            "Aberta", "Em análise", "Aguardando aprovação", "Aprovada",
            "Em execução", "Concluída", "Cancelada", "Rejeitada",
          ],
        }),
        new TextField({ name: "observacoes", max: 2000 }),
        new RelationField({
          name: "criado_por",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
        new RelationField({
          name: "atualizado_por",
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
        new AutodateField({ name: "data_criacao", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "data_atualizacao", onCreate: true, onUpdate: true }),
        new AutodateField({ name: "created", onCreate: true, onUpdate: false }),
        new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
      ],
      [
        "CREATE UNIQUE INDEX idx_solicitacoes_numero ON solicitacoes (numero_solicitacao, company_id) WHERE numero_solicitacao != ''",
        "CREATE INDEX idx_solicitacoes_company ON solicitacoes (company_id)",
        "CREATE INDEX idx_solicitacoes_solicitante ON solicitacoes (solicitante_id)",
        "CREATE INDEX idx_solicitacoes_obra ON solicitacoes (obra_id)",
        "CREATE INDEX idx_solicitacoes_status ON solicitacoes (status)",
      ],
      baseRules,
    );

    const solicitacoes = app.findCollectionByNameOrId("solicitacoes");

    // ---------- 2) solicitacoes_aprovacao ----------
    createCollection(
      "solicitacoes_aprovacao",
      [
        new RelationField({
          name: "company_id",
          collectionId: empresas.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new RelationField({
          name: "solicitacao_id",
          collectionId: solicitacoes.id,
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
        "CREATE INDEX idx_solicitacoes_aprov_company ON solicitacoes_aprovacao (company_id)",
        "CREATE INDEX idx_solicitacoes_aprov_sol ON solicitacoes_aprovacao (solicitacao_id)",
      ],
      { ...baseRules, update: null, delete: null },
    );

    // ---------- 3) solicitacoes_anexos ----------
    createCollection(
      "solicitacoes_anexos",
      [
        new RelationField({
          name: "company_id",
          collectionId: empresas.id,
          maxSelect: 1,
          cascadeDelete: false,
          required: true,
        }),
        new RelationField({
          name: "solicitacao_id",
          collectionId: solicitacoes.id,
          maxSelect: 1,
          cascadeDelete: true,
          required: true,
        }),
        new SelectField({
          name: "tipo_anexo",
          maxSelect: 1,
          required: true,
          values: ["Foto", "PDF", "Word", "Excel", "Vídeo", "Documento", "Comprovante"],
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
        "CREATE INDEX idx_solicitacoes_anexos_company ON solicitacoes_anexos (company_id)",
        "CREATE INDEX idx_solicitacoes_anexos_sol ON solicitacoes_anexos (solicitacao_id)",
      ],
      baseRules,
    );
  },
  (app) => {
    ["solicitacoes_anexos", "solicitacoes_aprovacao", "solicitacoes"].forEach((name) => {
      try {
        const col = app.findCollectionByNameOrId(name);
        app.delete(col);
      } catch (_) {}
    });
  },
);
