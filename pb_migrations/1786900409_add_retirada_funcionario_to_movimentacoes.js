/// <reference path="../pb_data/types.d.ts" />
// ETAPA 15 — Adiciona os tipos "Retirada por Funcionário" e "Devolução de
// Funcionário" ao select `tipo` da collection `movimentacoes`, para integrar
// o controle de saldo por funcionário ao fluxo de Estoque existente.
// Não altera outros campos nem dados existentes.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("movimentacoes");
  const tipoField = collection.fields.getByName("tipo");
  if (!tipoField) {
    throw new Error("Campo 'tipo' não encontrado em movimentacoes");
  }
  const current = tipoField.values || [];
  const desired = [
    "Entrada",
    "Saída",
    "Transferência",
    "Devolução",
    "Perda",
    "Ajuste de Estoque",
    "Inventário",
    "Consumo de Obra",
    "Retorno ao Almoxarifado",
    "Retirada por Funcionário",
    "Devolução de Funcionário",
  ];
  // Só recriia o campo se faltar algum valor — idempotente.
  const missing = desired.filter((v) => !current.includes(v));
  if (missing.length === 0) return;

  collection.fields.removeByName("tipo");
  collection.fields.add(
    new SelectField({
      name: "tipo",
      maxSelect: 1,
      values: desired,
    }),
  );
  app.save(collection);
}, (app) => {
  // Down: remove apenas os dois novos valores, restaurando a lista original.
  const collection = app.findCollectionByNameOrId("movimentacoes");
  const tipoField = collection.fields.getByName("tipo");
  if (!tipoField) return;
  const original = (tipoField.values || []).filter(
    (v) => v !== "Retirada por Funcionário" && v !== "Devolução de Funcionário",
  );
  collection.fields.removeByName("tipo");
  collection.fields.add(
    new SelectField({
      name: "tipo",
      maxSelect: 1,
      values: original,
    }),
  );
  app.save(collection);
});
