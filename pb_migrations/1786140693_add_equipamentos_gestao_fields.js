/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const fornecedores = app.findCollectionByNameOrId("fornecedores");
    const obras = app.findCollectionByNameOrId("obras");
    const funcionarios = app.findCollectionByNameOrId("funcionarios");

    const collection = app.findCollectionByNameOrId("equipamentos");

    const hasField = (name) => {
      try {
        collection.fields.getByName(name);
        return true;
      } catch (_) {
        return false;
      }
    };

    const addIfMissing = (field) => {
      if (!hasField(field.name)) collection.fields.add(field);
    };

    // Identificação
    addIfMissing(new TextField({ name: "numero_patrimonial", required: true, max: 100 }));
    addIfMissing(new TextField({ name: "codigo_interno", max: 100 }));
    addIfMissing(new TextField({ name: "codigo_qr", max: 100 }));
    addIfMissing(new TextField({ name: "codigo_barras", max: 100 }));
    addIfMissing(new TextField({ name: "nome", required: true, max: 200 }));
    addIfMissing(new TextField({ name: "descricao", max: 2000 }));
    addIfMissing(new TextField({ name: "categoria", required: true, max: 120 }));
    addIfMissing(new TextField({ name: "marca", max: 120 }));
    addIfMissing(new TextField({ name: "modelo", max: 120 }));
    addIfMissing(new TextField({ name: "fabricante", max: 120 }));
    addIfMissing(new TextField({ name: "numero_serie", max: 120 }));

    // Aquisição
    addIfMissing(new RelationField({ name: "fornecedor_id", collectionId: fornecedores.id, maxSelect: 1, cascadeDelete: false }));
    addIfMissing(new DateField({ name: "data_compra" }));
    addIfMissing(new TextField({ name: "nota_fiscal", max: 120 }));
    addIfMissing(new TextField({ name: "garantia", max: 120 }));
    addIfMissing(new NumberField({ name: "vida_util", min: 0 }));
    addIfMissing(new NumberField({ name: "valor_compra", min: 0 }));
    addIfMissing(new NumberField({ name: "valor_atual", min: 0 }));
    addIfMissing(new NumberField({ name: "depreciacao", min: 0 }));

    // Estado e situação
    addIfMissing(new SelectField({ name: "estado_conservacao", maxSelect: 1, values: ["Excelente", "Bom", "Regular", "Ruim", "Crítico"] }));
    addIfMissing(new SelectField({ name: "situacao", maxSelect: 1, values: ["Disponível", "Em Uso", "Reservado", "Em Manutenção", "Em Transporte", "Emprestado", "Extraviado", "Danificado", "Inativo", "Baixado"] }));

    // Localização e responsabilidade
    addIfMissing(new TextField({ name: "local_atual", max: 200 }));
    addIfMissing(new RelationField({ name: "obra_atual_id", collectionId: obras.id, maxSelect: 1, cascadeDelete: false }));
    addIfMissing(new RelationField({ name: "responsavel_id", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
    addIfMissing(new RelationField({ name: "funcionario_id", collectionId: funcionarios.id, maxSelect: 1, cascadeDelete: false }));
    addIfMissing(new TextField({ name: "centro_custo", max: 120 }));

    // Anexos
    addIfMissing(new FileField({ name: "fotos", maxSelect: 10, maxSize: 10485760, mimeTypes: ["image/jpeg", "image/png", "image/webp"] }));
    addIfMissing(new FileField({ name: "documentos", maxSelect: 10, maxSize: 20971520 }));
    addIfMissing(new FileField({ name: "manual", maxSelect: 1, maxSize: 20971520 }));
    addIfMissing(new FileField({ name: "certificados", maxSelect: 10, maxSize: 20971520 }));

    // Observações e auditoria
    addIfMissing(new TextField({ name: "observacoes", max: 2000 }));
    addIfMissing(new RelationField({ name: "criado_por", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
    addIfMissing(new RelationField({ name: "atualizado_por", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
    addIfMissing(new AutodateField({ name: "data_criacao", onCreate: true, onUpdate: false }));
    addIfMissing(new AutodateField({ name: "data_atualizacao", onCreate: true, onUpdate: true }));
    addIfMissing(new TextField({ name: "motivo_baixa", max: 500 }));

    app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId("equipamentos");
    const removable = [
      "numero_patrimonial", "codigo_interno", "codigo_qr", "codigo_barras",
      "nome", "descricao", "categoria", "marca", "modelo", "fabricante",
      "numero_serie", "fornecedor_id", "data_compra", "nota_fiscal", "garantia",
      "vida_util", "valor_compra", "valor_atual", "depreciacao",
      "estado_conservacao", "situacao", "local_atual", "obra_atual_id",
      "responsavel_id", "funcionario_id", "centro_custo", "fotos", "documentos",
      "manual", "certificados", "observacoes", "criado_por", "atualizado_por",
      "data_criacao", "data_atualizacao", "motivo_baixa",
    ];
    removable.forEach((name) => {
      try { collection.fields.removeByName(name); } catch (_) {}
    });
    ["idx_equip_patrimonial_company", "idx_equip_codigo_interno_company",
      "idx_equip_codigo_qr_company", "idx_equip_codigo_barras_company",
      "idx_equip_serie_company", "idx_equip_situacao", "idx_equip_categoria",
      "idx_equip_obra", "idx_equip_responsavel"].forEach((n) => {
      try { collection.removeIndex(n); } catch (_) {}
    });
    app.save(collection);
  },
);
