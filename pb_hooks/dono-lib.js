// "Dono do sistema" (Administrador Master): antes era o e-mail
// dnmltda@hotmail.com escrito em cada regra e hook; agora é o campo
// users.dono_sistema (Etapa 5 da auditoria). Quem é dono vê todas as empresas.
// Só o superusuário (painel /_/ do PocketBase) liga ou desliga esse campo.
// Módulo à parte porque cada handler do JSVM roda isolado.

const REGRA = "@request.auth.dono_sistema = true";
const EMAIL_ANTIGO = "dnmltda@hotmail.com";

// Cria o campo se faltar (chamado antes de gravar qualquer regra que o use,
// porque a ordem dos onBootstrap entre arquivos não é garantida) e, na
// primeira vez, marca a conta que já era o Master.
function garantir(app) {
  const users = app.findCollectionByNameOrId("users");
  if (users.fields.getByName("dono_sistema")) return;
  users.fields.add(new BoolField({ name: "dono_sistema" }));
  app.save(users);
  app.db().newQuery("UPDATE users SET dono_sistema = TRUE WHERE email = {:e}").bind({ e: EMAIL_ANTIGO }).execute();
  console.log("[dono-sistema] campo dono_sistema criado; conta Master marcada.");
}

function ehDono(u) {
  return !!(u && u.get("dono_sistema") === true);
}

module.exports = { REGRA, EMAIL_ANTIGO, garantir, ehDono };
