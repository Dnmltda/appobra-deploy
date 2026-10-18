/// <reference path="../pb_data/types.d.ts" />
// Adiciona os cargos de execução de obra (Pedreiro, Servente, Encanador,
// Eletricista) e o novo cargo "Faxina" à lista de valores aceitos no login
// (collection "users", campo "cargo"). Antes dessa migration, qualquer
// funcionário com um desses cargos virava "Funcionário" genérico ao criar
// o acesso (ver mapCargoParaLogin em EmployeeManagement.jsx), perdendo a
// possibilidade de ter um conjunto de permissões próprio.
// Também garante que "Faxina" exista na collection "cargos" (cargos de
// obra usados no cadastro de funcionário), já que os outros 4 já tinham
// sido semeados em 1781740245_005_seed_cargos_8_records.js.
migrate((app) => {
  // 1) Garante o registro "Faxina" em cargos (os outros 4 já existem)
  const cargosCollection = app.findCollectionByNameOrId("cargos");
  const faxina = new Record(cargosCollection);
  faxina.set("nome", "Faxina");
  try {
    app.save(faxina);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Cargo 'Faxina' já existe, pulando");
    } else {
      throw e;
    }
  }

  // 2) Expande os valores aceitos no SelectField users.cargo
  const usersCollection = app.findCollectionByNameOrId("users");
  const cargoField = usersCollection.fields.getByName("cargo");
  if (cargoField) {
    const atuais = cargoField.values || [];
    const novos = ["Pedreiro", "Servente", "Encanador", "Eletricista", "Faxina"];
    cargoField.values = [...atuais, ...novos.filter((v) => !atuais.includes(v))];
    app.save(usersCollection);
  }
}, (app) => {
  try {
    const usersCollection = app.findCollectionByNameOrId("users");
    const cargoField = usersCollection.fields.getByName("cargo");
    if (cargoField) {
      cargoField.values = ["Administrador", "Funcionário", "Engenheiro", "Almoxarife", "Mestre de Obras"];
      app.save(usersCollection);
    }
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
  // Revert não remove o registro "Faxina" de cargos (poderia já estar em
  // uso por funcionários cadastrados) — remoção manual, se necessário.
})
