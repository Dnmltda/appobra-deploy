/// <reference path="../pb_data/types.d.ts" />

// ============================================================
// Gravação por cargo no servidor (auditoria de 24/10/2026, item A3, aprovado
// pelo Diego). O servidor já escondia a leitura (acesso-dados.pb.js); a
// gravação pela API continuava aberta a qualquer pessoa da empresa. Agora
// criar e alterar só passa para quem tem a tela (grupos em
// gravacao-cargo-lib.js). Vale só para pedidos pela API: as gravações que o
// próprio servidor faz (baixa de estoque, histórico) não passam por aqui.
// Apagar continua só com o Administrador (regras das tabelas).
// ============================================================

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/gravacao-cargo-lib.js`);
  if (!lib.pode(e.auth, e.collection.name)) {
    require(`${__hooks}/nada-se-apaga-lib.js`).registrarTentativa(e.app, e.auth, "gravar sem permissão", e.collection.name, e.record && e.record.id, `Cargo sem permissão tentou gravar em ${e.collection.name}`);
    throw new ForbiddenError(lib.recusa(e.collection.name));
  }
  e.next();
}, ...require(`${__hooks}/gravacao-cargo-lib.js`).TABELAS);

onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/gravacao-cargo-lib.js`);
  if (!lib.pode(e.auth, e.collection.name)) {
    require(`${__hooks}/nada-se-apaga-lib.js`).registrarTentativa(e.app, e.auth, "gravar sem permissão", e.collection.name, e.record && e.record.id, `Cargo sem permissão tentou gravar em ${e.collection.name}`);
    throw new ForbiddenError(lib.recusa(e.collection.name));
  }
  e.next();
}, ...require(`${__hooks}/gravacao-cargo-lib.js`).TABELAS);

onRecordDeleteRequest((e) => {
  const lib = require(`${__hooks}/gravacao-cargo-lib.js`);
  if (!lib.pode(e.auth, e.collection.name)) {
    require(`${__hooks}/nada-se-apaga-lib.js`).registrarTentativa(e.app, e.auth, "gravar sem permissão", e.collection.name, e.record && e.record.id, `Cargo sem permissão tentou gravar em ${e.collection.name}`);
    throw new ForbiddenError(lib.recusa(e.collection.name));
  }
  e.next();
}, ...require(`${__hooks}/gravacao-cargo-lib.js`).TABELAS);
