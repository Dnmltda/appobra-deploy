/// <reference path="../pb_data/types.d.ts" />

// Lista de sugestões para cadastrar materiais (ver catalogo-lib.js).
routerAdd("GET", "/api/custom/catalogo-materiais", (e) => {
  if (!e.auth) throw new UnauthorizedError("Faça login.");
  const { CATALOGO_PADRAO } = require(`${__hooks}/catalogo-lib.js`);
  return e.json(200, CATALOGO_PADRAO);
});
