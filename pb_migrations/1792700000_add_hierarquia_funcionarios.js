/// <reference path="../pb_data/types.d.ts" />
// Adiciona a hierarquia dentro do cargo (pedido do Diego: separar os
// funcionários por nível dentro da própria função). Dois conjuntos de
// valores convivem no mesmo campo — a tela (EmployeeManagement.jsx) decide
// qual oferecer de acordo com o cargo escolhido:
//   - Cargos de obra (Servente, Pedreiro, Encanador, Eletricista,
//     Mestre de Obras, Faxina): Ajudante / Oficial / Encarregado.
//   - Cargos técnicos/administrativos (Engenheiro, Almoxarife,
//     Administrador): Júnior / Pleno / Sênior.
// Campo opcional: não quebra os funcionários já cadastrados.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("funcionarios");

  if (!collection.fields.getByName("hierarquia")) {
    collection.fields.add(new SelectField({
      name: "hierarquia",
      required: false,
      maxSelect: 1,
      values: ["Ajudante", "Oficial", "Encarregado", "Júnior", "Pleno", "Sênior"],
    }));
  }

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("funcionarios");
    collection.fields.removeByName("hierarquia");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
